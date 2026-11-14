import axios, { type AxiosRequestConfig, type AxiosResponse } from "axios";
import { z } from "zod";
import { dataErrorBodySchema, dataSuccessBodySchema } from "../../src/contracts/data-api";
import {
  agentDefaultsSchema,
  PREFERENCE_COMMANDS,
  preferencesDataSchema,
} from "../../src/contracts/preferences-data";

const baseURL = process.env.JOHNBOT_TEST_BASE_URL ?? "http://127.0.0.1:3000";
const http = axios.create({ baseURL, timeout: 20_000, validateStatus: () => true });
type Jar = { cookie: string };
const jar = (): Jar => ({ cookie: "" });
async function call<T = unknown>(
  session: Jar,
  config: AxiosRequestConfig,
): Promise<AxiosResponse<T>> {
  const headers = {
    ...(config.headers as Record<string, string> | undefined),
    ...(session.cookie ? { Cookie: session.cookie } : {}),
  };
  const response = await http.request<T>({ ...config, headers });
  const setCookies = response.headers["set-cookie"];
  if (Array.isArray(setCookies)) {
    const cookie = setCookies.find((value) => value.startsWith("johnbot_session="));
    if (cookie) session.cookie = cookie.split(";")[0] ?? "";
  }
  return response;
}
function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(`FAIL: ${message}`);
  console.log(`ok - ${message}`);
}
function data<T>(response: AxiosResponse<unknown>, schema: { parse(value: unknown): T }): T {
  return schema.parse(dataSuccessBodySchema.parse(response.data).data);
}
let sequence = 0;
const id = crypto.randomUUID().replaceAll("-", "");
const key = () => `pref-${id}-${++sequence}`;
const post = (session: Jar, command: string, payload: unknown, idempotencyKey: string) =>
  call(session, {
    method: "POST",
    url: `/api/commands/${command}`,
    data: { payload },
    headers: { "Idempotency-Key": idempotencyKey },
  });

async function main() {
  const a = jar();
  const b = jar();
  const initialA = await call(a, { method: "GET", url: "/api/preferences" });
  const initialB = await call(b, { method: "GET", url: "/api/preferences" });
  const seeded = data(initialA, preferencesDataSchema);
  data(initialB, preferencesDataSchema);
  check(seeded.analytics.enabled === false, "analytics is opt-out by default");

  const defaults = { ...seeded.agentDefaults, allowAutomation: true, planStartAfterMs: null };
  check(agentDefaultsSchema.safeParse(defaults).success, "agent defaults fixture validates");
  check(
    !agentDefaultsSchema.safeParse({ ...defaults, automationRunsPerHour: 0 }).success,
    "invalid agent defaults fixture is rejected",
  );

  const writeKey = key();
  const write = await post(a, PREFERENCE_COMMANDS.setAgentDefaults, defaults, writeKey);
  check(write.status === 200, "agent defaults command succeeds");
  const stored = data(
    write,
    z.object({ preferences: preferencesDataSchema, value: agentDefaultsSchema }),
  );
  check(stored.value.allowAutomation, "agent defaults persist in session A");
  const replay = await post(a, PREFERENCE_COMMANDS.setAgentDefaults, defaults, writeKey);
  check(
    replay.status === 200 && replay.headers["idempotency-replayed"] === "true",
    "same command key replays",
  );

  const mismatch = await post(
    a,
    PREFERENCE_COMMANDS.setAgentDefaults,
    seeded.agentDefaults,
    writeKey,
  );
  check(
    mismatch.status === 409 &&
      dataErrorBodySchema.parse(mismatch.data).error.code === "idempotency_conflict",
    "reused key with different payload conflicts",
  );
  const invalid = await post(a, PREFERENCE_COMMANDS.setBusyMessageMode, { mode: "invalid" }, key());
  check(
    invalid.status === 400 &&
      dataErrorBodySchema.parse(invalid.data).error.code === "invalid_input",
    "invalid preference input is rejected",
  );

  const readA = data(
    await call(a, { method: "GET", url: "/api/preferences" }),
    preferencesDataSchema,
  );
  const readB = data(
    await call(b, { method: "GET", url: "/api/preferences" }),
    preferencesDataSchema,
  );
  check(readA.agentDefaults.allowAutomation, "write remains persisted after a later request");
  check(!readB.agentDefaults.allowAutomation, "sessions cannot read another session's preferences");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
