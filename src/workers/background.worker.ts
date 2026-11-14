import { loadEnvConfig } from "@next/env";
import { Worker } from "bullmq";
import { writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";
import { closeDatabase, getDatabase } from "../server/database/client";
import { closeRedis } from "../server/cache/redis";
import { createJobQueue, JOB_PREFIX, JOB_QUEUE, queueConnection } from "../server/jobs/queue";
import { dispatchJobs } from "../server/jobs/dispatcher";
import { processJob } from "../server/jobs/processor";

loadEnvConfig(process.cwd());
const concurrency = z.coerce
  .number()
  .int()
  .min(1)
  .max(32)
  .parse(process.env.JOHNBOT_WORKER_CONCURRENCY ?? 4);
const heartbeat = process.env.JOHNBOT_WORKER_HEARTBEAT ?? join(tmpdir(), "johnbot-worker-health");
const producer = createJobQueue();
const connection = queueConnection(true);
const worker = new Worker(JOB_QUEUE, processJob, {
  connection,
  prefix: JOB_PREFIX,
  concurrency,
  limiter: { max: 20, duration: 1000 },
  lockDuration: 30000,
  maxStalledCount: 2,
});
worker.on("error", (error) => console.error("worker connection error", error.message));
worker.on("failed", (job) => console.error("job failed", job?.id, job?.attemptsMade));
worker.on("completed", (job) => console.log("job completed", job.id));
let stopping = false;
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.on(signal, () => {
    stopping = true;
  });
try {
  await worker.waitUntilReady();
  console.log(`worker ready, concurrency=${concurrency}`);
  let maintenanceAt = 0;
  while (!stopping) {
    try {
      await dispatchJobs(producer.queue);
      await producer.connection.ping();
      if (Date.now() > maintenanceAt) {
        await getDatabase().backgroundJob.deleteMany({
          where: {
            status: { in: ["SUCCEEDED", "CANCELLED"] },
            completedAt: { lt: new Date(Date.now() - 7 * 86400000) },
          },
        });
        maintenanceAt = Date.now() + 60000;
      }
      await writeFile(heartbeat, String(Date.now()));
    } catch (error) {
      console.error(
        "outbox dispatcher unavailable",
        error instanceof Error ? error.message : "unknown",
      );
    }
    await delay(1000);
  }
} finally {
  await worker.close();
  connection.disconnect();
  await producer.close();
  await Promise.all([closeDatabase(), closeRedis(), rm(heartbeat, { force: true })]);
}
