import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { serverEnv } from "../config/env";

export const JOB_QUEUE = "johnbot-background";
export const JOB_PREFIX = "johnbot:jobs";
export function queueConnection(worker = false) {
  const connection = new Redis(serverEnv().redisUrl, {
    maxRetriesPerRequest: worker ? null : 1,
    enableOfflineQueue: worker,
    connectTimeout: 3000,
    retryStrategy: (attempt) => Math.min(200 * attempt, 3000),
  });
  connection.on("error", () => undefined);
  return connection;
}
export function createJobQueue(name = JOB_QUEUE, prefix = JOB_PREFIX) {
  const connection = queueConnection();
  const queue = new Queue(name, {
    connection,
    prefix,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: { age: 86400, count: 1000 },
      removeOnFail: { age: 604800, count: 1000 },
    },
  });
  queue.on("error", () => undefined);
  return {
    queue,
    connection,
    close: async () => {
      await queue.close();
      connection.disconnect();
    },
  };
}
