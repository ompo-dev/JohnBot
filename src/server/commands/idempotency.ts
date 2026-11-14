import { createHash, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import type { z } from "zod";
import { ApiError, storageUnavailable } from "../errors";
import { getRedis } from "../cache/redis";

const PENDING_TTL_MS = 30_000;
const COMPLETED_TTL_SECONDS = 86_400;
const POLL_BUDGET_MS = 1_500;
const POLL_INTERVAL_MS = 25;

interface PendingEntry {
  state: "pending";
  fingerprint: string;
  /** Unique per claim: a worker may only finish or release the claim it owns. */
  owner: string;
}

interface CompletedEntry {
  state: "completed";
  fingerprint: string;
  data: unknown;
  completedAt: number;
}

type Entry = PendingEntry | CompletedEntry;

const KEY = (sessionId: string, command: string, key: string) =>
  `johnbot:idem:${sessionId}:${command}:${key}`;

/**
 * Replaces a pending claim with its result only while this owner still holds
 * it. An expired claim may already belong to another worker; that worker's
 * entry is never overwritten.
 */
const FINALIZE_SCRIPT = `
local current = redis.call('GET', KEYS[1])
if not current then return 0 end
local ok, entry = pcall(cjson.decode, current)
if not ok or type(entry) ~= 'table' then return -1 end
if entry['state'] ~= 'pending' or entry['owner'] ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
return 1
`;

/** Deletes the claim only while this owner still holds it. */
const RELEASE_SCRIPT = `
local current = redis.call('GET', KEYS[1])
if not current then return 0 end
local ok, entry = pcall(cjson.decode, current)
if not ok or type(entry) ~= 'table' then return 0 end
if entry['state'] ~= 'pending' or entry['owner'] ~= ARGV[1] then return 0 end
redis.call('DEL', KEYS[1])
return 1
`;

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

export function requestFingerprint(command: string, sessionId: string, payload: unknown): string {
  return createHash("sha256")
    .update(`${command}\n${sessionId}\n${canonicalJson(payload)}`)
    .digest("hex");
}

function parseEntry(raw: string): Entry {
  const parsed: unknown = JSON.parse(raw);
  if (
    parsed &&
    typeof parsed === "object" &&
    "state" in parsed &&
    "fingerprint" in parsed &&
    typeof parsed.fingerprint === "string" &&
    (parsed.state === "pending" || parsed.state === "completed")
  ) {
    return parsed as Entry;
  }
  throw new ApiError(500, "internal_error", "The stored idempotency entry is invalid.");
}

async function readEntry(key: string): Promise<Entry | null> {
  const redis = await getRedis();
  try {
    const raw = await redis.get(key);
    return raw ? parseEntry(raw) : null;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw storageUnavailable(error);
  }
}

function replay<T>(entry: CompletedEntry, fingerprint: string, schema: z.ZodType<T>): T {
  if (entry.fingerprint !== fingerprint) {
    throw new ApiError(
      409,
      "idempotency_conflict",
      "This idempotency key was used with a different request payload.",
    );
  }
  return schema.parse(entry.data);
}

export interface IdempotentOptions<T> {
  sessionId: string;
  command: string;
  idempotencyKey: string;
  payload: unknown;
  resultSchema: z.ZodType<T>;
  run: () => Promise<T>;
}

export interface IdempotentResult<T> {
  data: T;
  replayed: boolean;
  /**
   * False when the claim expired before the result could be stored. The command
   * did run; the caller must not treat a later retry as a guaranteed replay.
   */
  finalized: boolean;
}

/**
 * Claims a scoped key with SET NX, runs the command once, and stores the
 * validated result for replay. A concurrent duplicate waits briefly and then
 * receives `idempotency_in_progress`; it never runs the mutating handler.
 */
export async function executeIdempotent<T>(
  options: IdempotentOptions<T>,
): Promise<IdempotentResult<T>> {
  const { sessionId, command, idempotencyKey, payload, resultSchema, run } = options;
  const redis = await getRedis();
  const key = KEY(sessionId, command, idempotencyKey);
  const fingerprint = requestFingerprint(command, sessionId, payload);
  const owner = randomUUID();
  const pending: PendingEntry = { state: "pending", fingerprint, owner };

  const claim = async (): Promise<boolean> => {
    try {
      const claimed = await redis.set(key, JSON.stringify(pending), {
        condition: "NX",
        expiration: { type: "PX", value: PENDING_TTL_MS },
      });
      return claimed === "OK";
    } catch (error) {
      throw storageUnavailable(error);
    }
  };

  if (!(await claim())) {
    const deadline = Date.now() + POLL_BUDGET_MS;
    for (;;) {
      const entry = await readEntry(key);
      if (!entry) break;
      if (entry.fingerprint !== fingerprint) {
        throw new ApiError(
          409,
          "idempotency_conflict",
          "This idempotency key was used with a different request payload.",
        );
      }
      if (entry.state === "completed") {
        return { data: replay(entry, fingerprint, resultSchema), replayed: true, finalized: true };
      }
      if (Date.now() >= deadline) {
        throw new ApiError(
          409,
          "idempotency_in_progress",
          "A request with this idempotency key is still running.",
          { retryAfterSeconds: 1 },
        );
      }
      await delay(POLL_INTERVAL_MS);
    }
    // The claim expired between the failed SET and the read: try once more.
    if (!(await claim())) {
      throw new ApiError(
        409,
        "idempotency_in_progress",
        "A request with this idempotency key is still running.",
        { retryAfterSeconds: 1 },
      );
    }
  }

  let data: T;
  try {
    data = await run();
  } catch (error) {
    try {
      await redis.eval(RELEASE_SCRIPT, { keys: [key], arguments: [owner] });
    } catch {
      // The claim expires on its own; another owner's claim is left untouched.
    }
    throw error;
  }

  const validated = resultSchema.parse(data);
  const completed: CompletedEntry = {
    state: "completed",
    fingerprint,
    data: validated,
    completedAt: Date.now(),
  };
  try {
    const finalized = await redis.eval(FINALIZE_SCRIPT, {
      keys: [key],
      arguments: [owner, JSON.stringify(completed), String(COMPLETED_TTL_SECONDS)],
    });
    if (finalized !== 1) {
      // The claim expired or was replaced while the command ran. The mutation
      // already happened, so report it instead of pretending it failed, but
      // never overwrite the newer owner's entry.
      return { data: validated, replayed: false, finalized: false };
    }
  } catch (error) {
    throw storageUnavailable(error);
  }
  return { data: validated, replayed: false, finalized: true };
}
