import type { Queue } from "bullmq";
import { getDatabase } from "../database/client";

/** A SQL lease plus deterministic queue ID makes dispatch safe across replicas and crashes. */
export async function dispatchJobs(queue: Queue, sessionId?: string): Promise<number> {
  const database = getDatabase();
  const now = new Date();
  const eligible = {
    ...(sessionId ? { sessionId } : {}),
    status: { in: ["PENDING", "ENQUEUED", "RUNNING"] as ("PENDING" | "ENQUEUED" | "RUNNING")[] },
    OR: [{ dispatchUntil: null }, { dispatchUntil: { lt: now } }],
  };
  const rows = await database.backgroundJob.findMany({
    where: eligible,
    orderBy: { createdAt: "asc" },
    take: 50,
  });
  let dispatched = 0;
  for (const row of rows) {
    const token = crypto.randomUUID();
    const claimed = await database.backgroundJob.updateMany({
      where: { id: row.id, generation: row.generation, ...eligible },
      data: { dispatchToken: token, dispatchUntil: new Date(Date.now() + 60000) },
    });
    if (!claimed.count) continue;
    try {
      const id = `${row.id}-${row.generation}`;
      const existing = await queue.getJob(id);
      if (existing) {
        const state = await existing.getState();
        if (state === "completed") await existing.remove();
        else if (state === "failed") {
          await database.backgroundJob.updateMany({
            where: { id: row.id, dispatchToken: token },
            data: {
              status: "FAILED",
              lastError: "Queue retry budget exhausted.",
              dispatchToken: null,
              dispatchUntil: null,
            },
          });
          continue;
        }
      }
      await queue.add("cache.refresh", { id: row.id, generation: row.generation }, { jobId: id });
      await database.backgroundJob.updateMany({
        where: { id: row.id, dispatchToken: token, status: { in: ["PENDING", "ENQUEUED"] } },
        data: { status: "ENQUEUED" },
      });
      dispatched++;
    } catch (error) {
      await database.backgroundJob.updateMany({
        where: { id: row.id, dispatchToken: token },
        data: {
          dispatchToken: null,
          dispatchUntil: new Date(Date.now() + 5000),
          lastError: "Queue dispatch unavailable; will retry.",
        },
      });
      throw error;
    }
  }
  return dispatched;
}
