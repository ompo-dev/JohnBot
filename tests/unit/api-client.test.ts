import assert from "node:assert/strict";
import { z } from "zod";
import { getData, http, runCommand } from "../../src/lib/api/client";
import { ApiError } from "../../src/lib/api/errors";
const original = http.defaults.adapter;
try {
  http.defaults.adapter = async (config) => ({
    status: 200,
    statusText: "OK",
    headers: {},
    config,
    data: { ok: true, data: { count: "wrong" } },
  });
  await assert.rejects(
    getData("/invalid", z.object({ count: z.number() })),
    (error) => error instanceof ApiError && error.status === 502 && error.code === "internal_error",
  );
  const keys: string[] = [];
  http.defaults.adapter = async (config) => {
    keys.push(String(config.headers.get("Idempotency-Key")));
    return {
      status: 200,
      statusText: "OK",
      headers: {},
      config,
      data: { ok: true, data: { count: 1 } },
    };
  };
  const options = { idempotencyKey: crypto.randomUUID() };
  await runCommand("test", {}, z.object({ count: z.number() }), options);
  await runCommand("test", {}, z.object({ count: z.number() }), options);
  assert.equal(keys[0], options.idempotencyKey);
  assert.equal(keys[1], options.idempotencyKey);
  let handshakes = 0;
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { value: {}, configurable: true });
  try {
    http.defaults.adapter = async (config) => {
      if (config.url === "/api/account/state") handshakes++;
      return {
        status: 200,
        statusText: "OK",
        headers: {},
        config,
        data: {
          ok: true,
          data: config.url === "/api/account/state" ? { status: "signed_out" } : { count: 1 },
        },
      };
    };
    await Promise.all([
      getData("/first", z.object({ count: z.number() })),
      getData("/second", z.object({ count: z.number() })),
    ]);
    assert.equal(handshakes, 1);
  } finally {
    if (windowDescriptor) Object.defineProperty(globalThis, "window", windowDescriptor);
    else Reflect.deleteProperty(globalThis, "window");
  }
  console.log(
    "PASS: invalid response is distinct from network failure; logical retries keep their idempotency key",
  );
} finally {
  http.defaults.adapter = original;
}
