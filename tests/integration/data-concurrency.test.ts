import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";
import { executeIdempotent } from "../../src/server/commands/idempotency";
import { getRedis, closeRedis } from "../../src/server/cache/redis";
import { loadSnapshot, updateSnapshot } from "../../src/server/repositories/session-store";
import { readDomain, updateDomain } from "../../src/server/repositories/domain-store";
import { getDatabase, closeDatabase } from "../../src/server/database/client";
const counterSchema = z.object({ count: z.number().int().nonnegative() });
const seedCounter = () => ({ count: 0 });
const tenant = process.argv[3] ?? `concurrency-${crypto.randomUUID()}`;
const redis = await getRedis();
try {
  if (process.argv[2] === "worker") {
    for (let i = 0; i < 3; i++)
      await updateDomain(tenant, "concurrency-test", counterSchema, seedCounter, (current) => ({
        count: current.count + 1,
      }));
    for (let i = 0; i < 3; i++)
      await updateSnapshot(tenant, (s) => ({
        ...s,
        sessions: [...s.sessions, { ...s.sessions[0], sessionId: crypto.randomUUID() }],
      }));
  } else {
    const key = `johnbot:idem:${tenant}:test:expiry`;
    let release!: () => void;
    let entered!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const options = {
      sessionId: tenant,
      command: "test",
      idempotencyKey: "expiry",
      payload: {},
      resultSchema: z.string(),
    };
    const old = executeIdempotent({
      ...options,
      run: async () => {
        entered();
        await gate;
        return "old";
      },
    });
    await started;
    await redis.pExpire(key, 1);
    await delay(25);
    const fresh = await executeIdempotent({ ...options, run: async () => "new" });
    assert.equal(fresh.finalized, true);
    release();
    assert.equal((await old).finalized, false);
    const replay = await executeIdempotent({
      ...options,
      run: async () => {
        throw new Error("duplicate executed");
      },
    });
    assert.equal(replay.data, "new");
    assert.equal(replay.replayed, true);
    console.log("PASS: expired owner cannot overwrite newer result");
    const initial = await loadSnapshot(tenant);
    await Promise.all(
      Array.from(
        { length: 4 },
        () =>
          new Promise<void>((resolve, reject) => {
            const worker = spawn(process.execPath, [import.meta.filename, "worker", tenant], {
              env: process.env,
              stdio: "inherit",
            });
            worker.on("error", reject);
            worker.on("exit", (code) =>
              code === 0 ? resolve() : reject(new Error(`Worker exit ${code}`)),
            );
          }),
      ),
    );
    const saved = await loadSnapshot(tenant);
    assert.equal(saved.sessions.length, initial.sessions.length + 12);
    assert.equal(saved.version, initial.version + 12);
    console.log("PASS: four processes preserve all 12 concurrent updates");
    assert.equal(
      (await readDomain(tenant, "concurrency-test", counterSchema, seedCounter)).count,
      12,
    );
    assert.equal(
      (await readDomain(`${tenant}-other`, "concurrency-test", counterSchema, seedCounter)).count,
      0,
    );
    await assert.rejects(
      updateDomain(tenant, "concurrency-test", counterSchema, seedCounter, () => ({ count: -1 })),
    );
    assert.equal(
      (await readDomain(tenant, "concurrency-test", counterSchema, seedCounter)).count,
      12,
    );
    console.log("PASS: domain CAS, tenant isolation and invalid write rejection");
    await getDatabase().domainRecord.deleteMany({
      where: { sessionId: { in: [tenant, `${tenant}-other`] } },
    });
    await redis.del(`johnbot:domain:concurrency-test:${tenant}`);
    await redis.del(`johnbot:domain:concurrency-test:${tenant}-other`);
    await redis.del(key);
    await redis.del(`johnbot:session:${tenant}`);
  }
} finally {
  await Promise.all([closeRedis(), closeDatabase()]);
}
