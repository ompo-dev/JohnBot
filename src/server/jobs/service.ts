import { z } from "zod";
import { jobActionSchema, jobStatusSchema } from "../../contracts/jobs";
import type { RegisteredCommand } from "../commands/types";
import { getDatabase } from "../database/client";
import { ApiError, storageUnavailable } from "../errors";

export async function listJobs(sessionId: string, raw: unknown) {
  const query = z
    .object({
      status: jobStatusSchema.optional(),
      limit: z.coerce.number().int().min(1).max(100).default(50),
    })
    .strict()
    .parse(raw);
  try {
    const database = getDatabase();
    const [jobs, grouped] = await database.$transaction([
      database.backgroundJob.findMany({
        where: { sessionId, status: query.status },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: query.limit,
      }),
      database.backgroundJob.groupBy({
        by: ["status"],
        where: { sessionId },
        _count: { _all: true },
      }),
    ]);
    const counts = Object.fromEntries(
      jobStatusSchema.options.map((status) => [
        status,
        grouped.find((g) => g.status === status)?._count._all ?? 0,
      ]),
    );
    return {
      jobs: jobs.map(
        ({
          id,
          domain,
          revision,
          type,
          status,
          attempts,
          generation,
          lastError,
          createdAt,
          updatedAt,
          completedAt,
        }) => ({
          id,
          domain,
          revision,
          type,
          status,
          attempts,
          generation,
          lastError,
          createdAt: createdAt.toISOString(),
          updatedAt: updatedAt.toISOString(),
          completedAt: completedAt?.toISOString() ?? null,
        }),
      ),
      counts,
    };
  } catch (error) {
    throw storageUnavailable(error);
  }
}
async function act(sessionId: string, raw: unknown, retry: boolean) {
  const { id } = jobActionSchema.parse(raw);
  const result = await getDatabase().backgroundJob.updateMany({
    where: { id, sessionId, status: retry ? "FAILED" : { in: ["PENDING", "ENQUEUED"] } },
    data: retry
      ? {
          status: "PENDING",
          generation: { increment: 1 },
          attempts: 0,
          lastError: null,
          dispatchToken: null,
          dispatchUntil: null,
          runToken: null,
          completedAt: null,
        }
      : {
          status: "CANCELLED",
          completedAt: new Date(),
          dispatchToken: null,
          dispatchUntil: null,
          runToken: null,
        },
  });
  if (!result.count)
    throw new ApiError(
      409,
      "conflict",
      "Job is unavailable or its state does not allow this action.",
    );
  return null;
}
export const JOB_COMMANDS: Readonly<Record<string, RegisteredCommand>> = {
  "jobs.retry": {
    payloadSchema: jobActionSchema,
    resultSchema: z.null(),
    idempotent: true,
    run: (ctx, input) => act(ctx.sessionId, input, true),
  },
  "jobs.cancel": {
    payloadSchema: jobActionSchema,
    resultSchema: z.null(),
    idempotent: true,
    run: (ctx, input) => act(ctx.sessionId, input, false),
  },
};
