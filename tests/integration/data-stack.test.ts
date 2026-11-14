// End-to-end checks for the Redis-backed data layer. It talks to a real server
// over HTTP and a real Redis over the server process: no in-memory stand-ins.
//
//   bun run build && bun run test:data-stack
//   JOHNBOT_TEST_BASE_URL=http://127.0.0.1:3000 bun run test:data-stack
//
// Set JOHNBOT_TEST_REDIS_OUTAGE=1 when the server runs from `docker compose` to
// include the fail-closed check (it stops and starts the redis service only).
import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import axios, { type AxiosRequestConfig, type AxiosResponse } from "axios";
import {
  accountSessionsResponseSchema,
  accountUsageSchema,
  appInfoSchema,
  centralAuthStateSchema,
  dataErrorBodySchema,
  dataSuccessBodySchema,
  settingsSnapshotSchema,
} from "../../src/contracts/data-api";

const externalBaseUrl = process.env.JOHNBOT_TEST_BASE_URL;
const port = Number(process.env.JOHNBOT_TEST_PORT ?? 3210);
const baseURL = externalBaseUrl ?? `http://127.0.0.1:${port}`;
const outage = process.env.JOHNBOT_TEST_REDIS_OUTAGE === "1";
const databaseOutage = process.env.JOHNBOT_TEST_POSTGRES_OUTAGE === "1";

const http = axios.create({ baseURL, timeout: 20_000, validateStatus: () => true });

interface Jar {
  cookie: string;
}

function jar(): Jar {
  return { cookie: "" };
}

async function call(
  requestJar: Jar,
  config: AxiosRequestConfig,
  signal?: AbortSignal,
): Promise<AxiosResponse<unknown>> {
  const headers: Record<string, string> = {
    ...(config.headers as Record<string, string> | undefined),
  };
  if (requestJar.cookie) headers.Cookie = requestJar.cookie;
  const response = await http.request({ ...config, headers, signal });
  const setCookies = response.headers["set-cookie"];
  if (Array.isArray(setCookies)) {
    for (const value of setCookies) {
      const pair = value.split(";")[0];
      if (pair.startsWith("johnbot_session=")) requestJar.cookie = pair;
    }
  }
  return response;
}

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`ok - ${message}`);
}

function body<T>(response: AxiosResponse<unknown>, schema: { parse: (value: unknown) => T }): T {
  const parsed = dataSuccessBodySchema.parse(response.data);
  return schema.parse(parsed.data);
}

function errorBody(response: AxiosResponse<unknown>) {
  return dataErrorBodySchema.parse(response.data).error;
}

function commandHeaders(key: string): Record<string, string> {
  return { "Idempotency-Key": key };
}

const runId = crypto.randomUUID().replaceAll("-", "");
let sequence = 0;
function key(label: string): string {
  sequence += 1;
  return `${label}-${runId}-${sequence}`;
}

async function postCommand(
  requestJar: Jar,
  command: string,
  payload: unknown,
  idempotencyKey: string,
): Promise<AxiosResponse<unknown>> {
  return call(requestJar, {
    method: "POST",
    url: `/api/commands/${command}`,
    data: { payload },
    headers: commandHeaders(idempotencyKey),
  });
}

async function waitForServer(child: ChildProcess | null): Promise<void> {
  const deadline = Date.now() + 90_000;
  for (;;) {
    try {
      const response = await http.get("/api/app-info");
      if (response.status === 200) return;
    } catch {
      // The server is still starting.
    }
    if (Date.now() > deadline) {
      child?.kill();
      throw new Error(`The server at ${baseURL} did not become ready.`);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

async function main(): Promise<void> {
  let child: ChildProcess | null = null;

  if (!externalBaseUrl) {
    child = spawn(
      process.execPath,
      ["node_modules/next/dist/bin/next", "start", "-p", String(port)],
      {
        stdio: "inherit",
        env: { ...process.env, NODE_ENV: "production" },
      },
    );
  }

  try {
    await waitForServer(child);
    console.log(`Server ready at ${baseURL}`);

    const page = await http.get("/");
    check(
      page.status === 200 && String(page.data).includes("<!DOCTYPE html>"),
      "serves the app page",
    );

    // App info is a global safe read: the same cache entry is reused.
    const appInfoJar = jar();
    const appInfoFirst = await call(appInfoJar, { method: "GET", url: "/api/app-info" });
    const appInfoSecond = await call(appInfoJar, { method: "GET", url: "/api/app-info" });
    check(appInfoFirst.status === 200, "GET /api/app-info returns 200");
    check(
      appInfoFirst.headers["x-data-generated-at"] === appInfoSecond.headers["x-data-generated-at"],
      "app info is served from the same cache entry",
    );
    check(
      appInfoSchema.parse(body(appInfoFirst, appInfoSchema)).name.length > 0,
      "app info validates",
    );
    check(Boolean(appInfoFirst.headers["x-request-id"]), "responses carry a request id");

    const tenantA = jar();
    const tenantB = jar();

    const stateA = await call(tenantA, { method: "GET", url: "/api/account/state" });
    const stateB = await call(tenantB, { method: "GET", url: "/api/account/state" });
    const authA = body(stateA, centralAuthStateSchema);
    const authB = body(stateB, centralAuthStateSchema);
    check(
      authA.status === "signed_in" && authB.status === "signed_in",
      "both tenants start signed in",
    );
    check(
      stateA.headers["set-cookie"] !== undefined && stateB.headers["set-cookie"] !== undefined,
      "each new tenant receives an explicit session cookie",
    );

    const settingsRead = await call(tenantA, { method: "GET", url: "/api/settings" });
    check(
      body(settingsRead, settingsSnapshotSchema).language.language === "system",
      "settings default",
    );

    const languageKey = key("settings-language");
    const language = await postCommand(
      tenantA,
      "settings.set-language",
      { language: "pt" },
      languageKey,
    );
    check(language.status === 200, "settings.set-language succeeds");
    check(
      body(language, settingsSnapshotSchema).language.language === "pt",
      "settings write is persisted",
    );

    const replay = await postCommand(
      tenantA,
      "settings.set-language",
      { language: "pt" },
      languageKey,
    );
    check(replay.status === 200, "same idempotency key replays successfully");
    check(replay.headers["idempotency-replayed"] === "true", "replay is marked");

    const conflict = await postCommand(
      tenantA,
      "settings.set-language",
      { language: "fr" },
      languageKey,
    );
    check(conflict.status === 409, "same key with a different payload returns 409");
    check(errorBody(conflict).code === "idempotency_conflict", "conflict code is explicit");

    const invalid = await postCommand(
      tenantA,
      "settings.set-language",
      { language: "xx" },
      key("bad"),
    );
    check(invalid.status === 400, "invalid payload returns 400");
    check(errorBody(invalid).code === "invalid_input", "invalid payload code is explicit");

    const unknown = await call(tenantA, {
      method: "POST",
      url: "/api/commands/does.not-exist",
      data: { payload: {} },
      headers: commandHeaders(key("unknown")),
    });
    check(unknown.status === 404, "unlisted command returns 404");

    const concurrentKey = key("concurrent");
    const concurrent = await Promise.all(
      Array.from({ length: 8 }, () =>
        postCommand(tenantA, "account.update-name", { name: "Concurrent" }, concurrentKey),
      ),
    );
    check(
      concurrent.every((response) => response.status === 200),
      "concurrent duplicates all complete",
    );
    check(
      concurrent.filter((response) => response.headers["idempotency-replayed"] !== "true")
        .length === 1,
      "the mutating handler runs exactly once",
    );
    const stateAfterConcurrent = await call(tenantA, { method: "GET", url: "/api/account/state" });
    const authAfterConcurrent = body(stateAfterConcurrent, centralAuthStateSchema);
    check(
      authAfterConcurrent.status === "signed_in" && authAfterConcurrent.user.name === "Concurrent",
      "the concurrent write is visible once",
    );

    const tenantBState = await call(tenantB, { method: "GET", url: "/api/account/state" });
    const authBAfter = body(tenantBState, centralAuthStateSchema);
    check(
      authBAfter.status === "signed_in" && authBAfter.user.name === "Norbert",
      "one tenant cannot see another tenant's write",
    );

    const sessions = await call(tenantB, { method: "GET", url: "/api/account/sessions" });
    check(
      body(sessions, accountSessionsResponseSchema).sessions.length > 0,
      "account sessions can be listed",
    );

    const usageFirst = await call(tenantA, { method: "GET", url: "/api/usage" });
    const usageSecond = await call(tenantA, { method: "GET", url: "/api/usage" });
    check(body(usageFirst, accountUsageSchema).limits.length > 0, "usage is seeded");
    check(
      usageFirst.headers["x-data-generated-at"] === usageSecond.headers["x-data-generated-at"],
      "usage is served from cache",
    );

    const logout = await postCommand(tenantA, "account.logout", {}, key("logout"));
    check(logout.status === 200, "logout succeeds");
    check(
      body(logout, centralAuthStateSchema).status === "signed_out",
      "logout returns signed out",
    );
    const usageAfterLogout = await call(tenantA, { method: "GET", url: "/api/usage" });
    const usage = body(usageAfterLogout, accountUsageSchema);
    check(usage.limits.length === 0, "logout invalidates the usage cache");
    check(
      usageAfterLogout.headers["x-data-generated-at"] !== usageFirst.headers["x-data-generated-at"],
      "invalidated usage is generated again",
    );

    const controller = new AbortController();
    controller.abort();
    let cancelled = false;
    try {
      await call(jar(), { method: "GET", url: "/api/account/state" }, controller.signal);
    } catch (error) {
      cancelled = axios.isCancel(error);
    }
    check(cancelled, "an aborted request is cancelled before it reaches the server");

    if (outage || databaseOutage) {
      const service = databaseOutage ? "postgres" : "redis";
      const before = body(
        await call(tenantA, { method: "GET", url: "/api/account/state" }),
        centralAuthStateSchema,
      );
      console.log(`Stopping ${service} for the fail-closed check...`);
      execFileSync("docker", ["compose", "stop", service], { stdio: "inherit" });
      try {
        const unavailable = await call(jar(), { method: "GET", url: "/api/account/state" });
        check(unavailable.status === 503, `${service} outage fails closed with 503`);
        check(
          errorBody(unavailable).code === "storage_unavailable",
          "outage code is storage_unavailable",
        );

        const existing = await call(tenantA, { method: "GET", url: "/api/account/state" });
        check(
          existing.status === (databaseOutage ? 503 : 200),
          databaseOutage
            ? "existing PostgreSQL data is not replaced with a seed during outage"
            : "existing PostgreSQL data remains readable during Redis outage",
        );

        const unavailableWrite = await postCommand(
          jar(),
          "account.update-name",
          { name: "Outage" },
          key("outage"),
        );
        check(unavailableWrite.status === 503, `writes fail closed while ${service} is down`);
      } finally {
        console.log(`Starting ${service} again...`);
        execFileSync("docker", ["compose", "start", service], { stdio: "inherit" });
      }
      const deadline = Date.now() + 60_000;
      for (;;) {
        const recovered = await call(jar(), { method: "GET", url: "/api/account/state" });
        if (recovered.status === 200) break;
        if (Date.now() > deadline)
          throw new Error(`The service did not recover after ${service} restarted.`);
        await new Promise((resolve) => setTimeout(resolve, 1_000));
      }
      const after = body(
        await call(tenantA, { method: "GET", url: "/api/account/state" }),
        centralAuthStateSchema,
      );
      check(
        JSON.stringify(before) === JSON.stringify(after),
        "confirmed account data survives the storage restart",
      );
      check(true, `the service recovers after ${service} restarts`);
    }

    console.log("All data stack checks passed.");
  } finally {
    child?.kill();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
