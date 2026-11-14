import { z } from "zod";
export const jobStatusSchema = z.enum([
  "PENDING",
  "ENQUEUED",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
]);
export const jobSummarySchema = z.object({
  id: z.uuid(),
  domain: z.string(),
  revision: z.number().int(),
  type: z.literal("cache.refresh"),
  status: jobStatusSchema,
  attempts: z.number().int().nonnegative(),
  generation: z.number().int().nonnegative(),
  lastError: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().nullable(),
});
export const jobsPageSchema = z.object({
  jobs: z.array(jobSummarySchema),
  counts: z.record(jobStatusSchema, z.number().int().nonnegative()),
});
export const jobActionSchema = z.object({ id: z.uuid() }).strict();
