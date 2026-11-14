import axios, { type AxiosError } from "axios";
import type { z } from "zod";
import {
  centralAuthStateSchema,
  dataErrorBodySchema,
  dataSuccessBodySchema,
} from "../../contracts/data-api";
import { ApiError } from "./errors";
import {
  beginOptimistic,
  dataStoreEpoch,
  invalidateQueries,
  putQuery,
  queryFailed,
  readConfirmed,
  readEntry,
  resetDataStore,
} from "../../stores/data-store";
import { commandScope, optimisticPlans } from "./mutations/optimistic-plans";
import { commandQueryPrefixes, queryTtlMs } from "../../contracts/data-cache";

const READ_TIMEOUT_MS = 8_000;
const WRITE_TIMEOUT_MS = 15_000;
let browserSessionReady = false;
let sessionHandshake: Promise<void> | undefined;

/** Establish the HttpOnly cookie before parallel startup reads create different sessions. */
async function ensureBrowserSession(): Promise<void> {
  if (typeof window === "undefined" || browserSessionReady) return;
  if (!sessionHandshake) {
    sessionHandshake = http
      .get("/api/account/state", { timeout: READ_TIMEOUT_MS })
      .then((response) => {
        parseSuccess(response.data, centralAuthStateSchema);
        browserSessionReady = true;
      })
      .finally(() => {
        sessionHandshake = undefined;
      });
  }
  await sessionHandshake;
}

export const http = axios.create({
  baseURL: "",
  timeout: WRITE_TIMEOUT_MS,
  withCredentials: true,
  headers: { Accept: "application/json" },
});

function cancelled(error: unknown): boolean {
  return (
    (error instanceof ApiError && error.code === "cancelled") ||
    axios.isCancel(error) ||
    (error instanceof DOMException && error.name === "AbortError") ||
    (typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ERR_CANCELED")
  );
}

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (cancelled(error)) {
    return new ApiError(0, "cancelled", "The request was cancelled.", { cause: error });
  }
  const axiosError = error as AxiosError;
  const response = axiosError.response;
  if (response) {
    const parsed = dataErrorBodySchema.safeParse(response.data);
    if (parsed.success) {
      return new ApiError(response.status, parsed.data.error.code, parsed.data.error.message, {
        requestId: parsed.data.error.requestId,
        retryAfterSeconds: parsed.data.error.retryAfterSeconds,
        details: parsed.data.error.details,
        cause: error,
      });
    }
    return new ApiError(
      response.status,
      "internal_error",
      `The server answered HTTP ${response.status}.`,
      {
        cause: error,
      },
    );
  }
  return new ApiError(0, "network_error", "The server could not be reached.", { cause: error });
}

function rethrow(error: unknown): never {
  throw toApiError(error);
}

function parseSuccess<T>(value: unknown, schema: z.ZodType<T>): T {
  const body = dataSuccessBodySchema.safeParse(value);
  const parsed = body.success ? schema.safeParse(body.data.data) : null;
  if (!parsed?.success) {
    throw new ApiError(
      502,
      "internal_error",
      "The server returned data that does not match the contract.",
    );
  }
  return parsed.data;
}

export interface RequestOptions {
  signal?: AbortSignal;
  force?: boolean;
  timeoutMs?: number;
}

const pendingQueries = new Map<string, Promise<unknown>>();
export async function getData<T>(path: string, schema: z.ZodType<T>, options: RequestOptions = {}): Promise<T> {
  const cached = readEntry(path);
  if (!options.signal?.aborted && !options.force && cached && !cached.error && !cached.invalidated &&
      !cached.pending && cached.fetchedAt && Date.now() - cached.fetchedAt < queryTtlMs(path)) {
    const parsed = schema.safeParse(cached.data);
    if (parsed.success) return parsed.data;
  }
  // Abortable reads have their own request so one consumer cannot cancel another.
  if (options.signal) return fetchData(path, schema, options);
  const key = JSON.stringify([dataStoreEpoch(), path]);
  let pending = pendingQueries.get(key);
  if (!pending) {
    pending = fetchData(path, schema, options).finally(() => {
      if (pendingQueries.get(key) === pending) pendingQueries.delete(key);
    });
    pendingQueries.set(key, pending);
  }
  const parsed = schema.safeParse(await pending);
  if (!parsed.success) throw new ApiError(502, "internal_error", "The server returned data that does not match the contract.");
  return parsed.data;
}

async function fetchData<T>(
  path: string,
  schema: z.ZodType<T>,
  options: RequestOptions = {},
): Promise<T> {
  const observedRevision = readEntry(path)?.revision ?? 0;
  const epoch = dataStoreEpoch();
  try {
    if (options.signal?.aborted) throw new ApiError(0, "cancelled", "The request was cancelled.");
    await ensureBrowserSession();
    if (options.signal?.aborted) throw new ApiError(0, "cancelled", "The request was cancelled.");
    const pending = readEntry(path);
    if (pending?.pending && schema.safeParse(pending.data).success)
      return schema.parse(pending.data);
    const response = await http.get(path, { signal: options.signal, timeout: READ_TIMEOUT_MS });
    const parsed = parseSuccess(response.data, schema);
    if (epoch !== dataStoreEpoch())
      throw new ApiError(0, "cancelled", "The session changed while loading.");
    const current = putQuery(path, parsed, observedRevision);
    const validated = schema.safeParse(current);
    return validated.success ? validated.data : parsed;
  } catch (error) {
    if (epoch === dataStoreEpoch() && !cancelled(error)) queryFailed(path, observedRevision, error);
    return rethrow(error);
  }
}

export interface CommandResult<T> {
  data: T;
  replayed: boolean;
  idempotencyKey: string;
}
const commandTails = new Map<string, Promise<void>>();

/**
 * Sends one explicit command. The idempotency key is created once per logical
 * call and reused only if the caller passes it back; the client never retries a
 * write on its own.
 */
export async function runCommand<T>(
  command: string,
  payload: unknown,
  schema: z.ZodType<T>,
  options: RequestOptions & { idempotencyKey?: string } = {},
): Promise<CommandResult<T>> {
  const idempotencyKey = options.idempotencyKey ?? crypto.randomUUID();
  const plans = optimisticPlans(command, payload);
  const pending = plans.map((plan) => ({ plan, token: beginOptimistic(plan.key, plan.update) }));
  const scope = commandScope(command, payload);
  const previous = commandTails.get(scope) ?? Promise.resolve();
  let release!: () => void;
  const tail = new Promise<void>((resolve) => {
    release = resolve;
  });
  commandTails.set(scope, tail);
  try {
    await previous;
    if (options.signal?.aborted) throw new ApiError(0, "cancelled", "The request was cancelled.");
    await ensureBrowserSession();
    const response = await http.post(
      `/api/commands/${encodeURIComponent(command)}`,
      { payload },
      {
        signal: options.signal,
        timeout: options.timeoutMs ?? WRITE_TIMEOUT_MS,
        headers: { "Idempotency-Key": idempotencyKey },
      },
    );
    const data = parseSuccess(response.data, schema);
    const conflict = typeof data === "object" && data !== null && "ok" in data && data.ok === false;
    if (conflict) {
      for (const { token } of pending)
        token.rollback(new Error("The resource changed in another client."));
    } else {
      for (const { plan, token } of pending)
        token.commit(plan.confirm(data, readConfirmed(plan.key)));
    }
    // A conflict leaves the confirmed base stale, so readers must reload the server value too.
    for (const prefix of commandQueryPrefixes(command)) invalidateQueries(prefix);
    if (command === "account.logout") {
      resetDataStore();
      putQuery("/api/account/state", data);
    }
    return {
      data,
      replayed: response.headers["idempotency-replayed"] === "true",
      idempotencyKey,
    };
  } catch (error) {
    const failure = toApiError(error);
    for (const { token } of pending) token.rollback(failure);
    // Only a refused write leaves a stale base; a failed request keeps the confirmed value.
    if (failure.code === "conflict")
      for (const prefix of commandQueryPrefixes(command)) invalidateQueries(prefix);
    throw failure;
  } finally {
    release();
    if (commandTails.get(scope) === tail) commandTails.delete(scope);
  }
}
