import assert from "node:assert/strict";
import { loadEnvConfig } from "@next/env";
import { Worker } from "bullmq";
import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";
import { getDatabase, closeDatabase } from "../../src/server/database/client";
import { readDomain, updateDomain } from "../../src/server/repositories/domain-store";
import { domainCacheKey, publishDomainCache, readDomainCache } from "../../src/server/cache/domain";
import { getRedis, closeRedis } from "../../src/server/cache/redis";
import { createJobQueue, queueConnection } from "../../src/server/jobs/queue";
import { dispatchJobs } from "../../src/server/jobs/dispatcher";
import { processJob } from "../../src/server/jobs/processor";
import { JOB_COMMANDS, listJobs } from "../../src/server/jobs/service";
loadEnvConfig(process.cwd());
const tenant = `jobs-${crypto.randomUUID()}`;
const domain = "jobs-test";
const name = `test-${crypto.randomUUID()}`;
const prefix = "johnbot:jobs:test";
const producer = createJobQueue(name, prefix);
const connection = queueConnection(true);
let worker: Worker | undefined;
const database = getDatabase();
const schema = z.object({ count: z.number().int() });
const seed = () => ({ count: 0 });
async function waitFor(check: () => Promise<boolean>) {
  const deadline = Date.now() + 15000;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error("Job timed out");
    await delay(50);
  }
}
const startWorker = () => {
  const value = new Worker(name, processJob, { prefix, connection, concurrency: 2 });
  value.on("error", () => undefined);
  return value;
};
try {
  await readDomain(tenant, domain, schema, seed);
  const blocker = await database.backgroundJob.create({
    data: { sessionId: tenant, domain, revision: 1 },
  });
  await assert.rejects(updateDomain(tenant, domain, schema, seed, () => ({ count: 1 })));
  assert.equal(
    (
      await database.domainRecord.findUniqueOrThrow({
        where: { sessionId_domain: { sessionId: tenant, domain } },
      })
    ).revision,
    0,
  );
  await database.backgroundJob.delete({ where: { id: blocker.id } });
  await updateDomain(tenant, domain, schema, seed, () => ({ count: 1 }));
  const record = await database.backgroundJob.findFirstOrThrow({ where: { sessionId: tenant } });
  await Promise.all([dispatchJobs(producer.queue, tenant), dispatchJobs(producer.queue, tenant)]);
  assert.equal((await producer.queue.getJobs(["waiting"])).length, 1);
  worker = startWorker();
  await waitFor(
    async () =>
      (await database.backgroundJob.findUnique({ where: { id: record.id } }))?.status ===
      "SUCCEEDED",
  );
  await processJob({
    data: { id: record.id, generation: 0 },
    name: "cache.refresh",
    attemptsMade: 0,
    opts: { attempts: 5 },
  });
  assert.equal(
    (await database.backgroundJob.findUniqueOrThrow({ where: { id: record.id } })).attempts,
    1,
  );
  console.log(
    "PASS: transactional outbox rollback, concurrent dispatch deduplication and idempotent processing",
  );

  await (await getRedis()).set(
    domainCacheKey(tenant, domain),
    JSON.stringify({ revision: "corrupt" }),
  );
  await publishDomainCache(tenant, domain, 2, { count: 2 });
  await publishDomainCache(tenant, domain, 1, { count: -1 });
  assert.deepEqual(await readDomainCache(tenant, domain, 2), { count: 2 });
  console.log("PASS: an older cache publication cannot overwrite a newer revision");

  const bad = await database.backgroundJob.create({
    data: { sessionId: tenant, domain, revision: 99 },
  });
  await producer.queue.add(
    "unsupported",
    { id: bad.id, generation: 0 },
    { jobId: `${bad.id}-0`, attempts: 2, backoff: { type: "fixed", delay: 50 } },
  );
  await waitFor(
    async () =>
      (await database.backgroundJob.findUnique({ where: { id: bad.id } }))?.status === "FAILED",
  );
  assert.equal(
    (await database.backgroundJob.findUniqueOrThrow({ where: { id: bad.id } })).attempts,
    2,
  );
  await assert.rejects(
    JOB_COMMANDS["jobs.retry"].run(
      { sessionId: `${tenant}-other`, signal: new AbortController().signal },
      { id: bad.id },
    ),
  );
  await JOB_COMMANDS["jobs.retry"].run(
    { sessionId: tenant, signal: new AbortController().signal },
    { id: bad.id },
  );
  await dispatchJobs(producer.queue, tenant);
  await waitFor(
    async () =>
      (await database.backgroundJob.findUnique({ where: { id: bad.id } }))?.status === "SUCCEEDED",
  );
  console.log("PASS: bounded retries, failed retention, tenant-scoped manual retry and recovery");
  const exhausted = await database.backgroundJob.create({
    data: { sessionId: tenant, domain, revision: 201, attempts: 5 },
  });
  await assert.rejects(
    processJob({
      data: { id: exhausted.id, generation: 0 },
      name: "cache.refresh",
      attemptsMade: 0,
      opts: { attempts: 5 },
    }),
  );
  assert.equal(
    (await database.backgroundJob.findUniqueOrThrow({ where: { id: exhausted.id } })).status,
    "FAILED",
  );
  await JOB_COMMANDS["jobs.retry"].run(
    { sessionId: tenant, signal: new AbortController().signal },
    { id: exhausted.id },
  );
  await dispatchJobs(producer.queue, tenant);
  await waitFor(
    async () =>
      (await database.backgroundJob.findUnique({ where: { id: exhausted.id } }))?.status ===
      "SUCCEEDED",
  );

  await worker.close();
  worker = undefined;
  const cancelled = await database.backgroundJob.create({
    data: { sessionId: tenant, domain, revision: 200 },
  });
  await dispatchJobs(producer.queue, tenant);
  await JOB_COMMANDS["jobs.cancel"].run(
    { sessionId: tenant, signal: new AbortController().signal },
    { id: cancelled.id },
  );
  await updateDomain(tenant, domain, schema, seed, () => ({ count: 3 }));
  await dispatchJobs(producer.queue, tenant);
  const lost = await database.backgroundJob.findFirstOrThrow({
    where: { sessionId: tenant, revision: 2 },
  });
  await (await producer.queue.getJob(`${lost.id}-0`))?.remove();
  await database.backgroundJob.update({
    where: { id: lost.id },
    data: { dispatchUntil: new Date(0) },
  });
  await dispatchJobs(producer.queue, tenant);
  worker = startWorker();
  await waitFor(
    async () =>
      (await database.backgroundJob.count({
        where: { sessionId: tenant, status: { in: ["PENDING", "ENQUEUED", "RUNNING", "FAILED"] } },
      })) === 0,
  );
  assert.equal((await listJobs(`${tenant}-other`, {})).jobs.length, 0);
  const cancelledState = await database.backgroundJob.findUniqueOrThrow({
    where: { id: cancelled.id },
  });
  assert.equal(cancelledState.status, "CANCELLED");
  assert.equal(cancelledState.attempts, 0);
  console.log(
    "PASS: durable retry budget, lost Redis delivery recovery, worker replacement, cancellation and tenant isolation",
  );
} finally {
  await worker?.close();
  await producer.queue.obliterate({ force: true });
  await producer.close();
  connection.disconnect();
  await database.domainRecord.deleteMany({ where: { sessionId: tenant } });
  await Promise.all([closeRedis(), closeDatabase()]);
}
