import { UnrecoverableError, type Job } from "bullmq";
import { z } from "zod";
import { getDatabase } from "../database/client";
import { publishDomainCache } from "../cache/domain";

const jobData = z.object({ id: z.uuid(), generation: z.number().int().nonnegative() }).strict();
/** Only database-backed, allowlisted jobs execute; payloads never contain arbitrary commands. */
export async function processJob(
  job: Pick<Job, "data" | "name" | "attemptsMade" | "opts">,
): Promise<void> {
  const input = jobData.parse(job.data);
  const database = getDatabase();
  const token = crypto.randomUUID();
  const claimed = await database.backgroundJob.updateMany({
    where: {
      id: input.id,
      generation: input.generation,
      attempts: { lt: 5 },
      status: { in: ["PENDING", "ENQUEUED", "RUNNING"] },
    },
    data: {
      status: "RUNNING",
      runToken: token,
      dispatchToken: null,
      dispatchUntil: new Date(Date.now() + 60000),
      attempts: { increment: 1 },
    },
  });
  if (!claimed.count) {
    const exhausted = await database.backgroundJob.updateMany({
      where: {
        id: input.id,
        generation: input.generation,
        attempts: { gte: 5 },
        status: { in: ["PENDING", "ENQUEUED", "RUNNING"] },
      },
      data: {
        status: "FAILED",
        lastError: "Durable retry budget exhausted.",
        runToken: null,
        dispatchToken: null,
        dispatchUntil: null,
      },
    });
    if (exhausted.count) throw new UnrecoverableError("Durable retry budget exhausted.");
    return;
  }
  const owned = {
    id: input.id,
    generation: input.generation,
    runToken: token,
    status: "RUNNING" as const,
  };
  try {
    const record = await database.backgroundJob.findUniqueOrThrow({
      where: { id: input.id },
      include: { record: true },
    });
    if (job.name !== "cache.refresh" || record.type !== "cache.refresh")
      throw new Error("Unsupported job type.");
    // Refresh the latest database revision, never an old job's snapshot.
    await publishDomainCache(
      record.sessionId,
      record.domain,
      record.record.revision,
      record.record.payload,
    );
    await database.backgroundJob.updateMany({
      where: owned,
      data: {
        status: "SUCCEEDED",
        completedAt: new Date(),
        lastError: null,
        runToken: null,
        dispatchUntil: null,
      },
    });
  } catch (error) {
    const exhausted = job.attemptsMade + 1 >= (job.opts.attempts ?? 5);
    await database.backgroundJob.updateMany({
      where: owned,
      data: {
        status: exhausted ? "FAILED" : "ENQUEUED",
        lastError: "Job processing failed; inspect worker logs.",
        runToken: null,
        dispatchUntil: new Date(Date.now() + 60000),
      },
    });
    throw error;
  }
}
