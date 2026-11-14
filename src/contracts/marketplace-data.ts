import { z } from "zod";
import { AVATAR_HUES } from "./ipc-agent-identity";
import { INPUT_LIMITS } from "./input-limits";
import type {
  AgentPublicationPreview,
  AgentSubmission,
  MarketplaceAgentDetail,
  MarketplaceAgentPage,
} from "./ipc-marketplace-agents";

const categorySchema = z.enum([
  "coding",
  "design",
  "data-analytics",
  "documents",
  "productivity",
  "research",
  "automation",
  "other",
]);
const avatarHueSchema = z
  .union([z.literal(AVATAR_HUES[0]), ...AVATAR_HUES.slice(1).map((hue) => z.literal(hue))])
  .nullable();
const summarySchema = z.object({
  id: z.string(),
  name: z.string(),
  title: z.string(),
  description: z.string(),
  creatorName: z.string(),
  creatorAvatarUrl: z.string().nullable().optional(),
  category: categorySchema.optional(),
  version: z.number(),
  installs: z.number(),
  featured: z.boolean(),
  verified: z.boolean().optional(),
  avatarSeed: z.string(),
  avatarHue: avatarHueSchema,
  avatarUrl: z.string().nullable(),
  skillCount: z.number(),
  routineCount: z.number(),
  activeRoutineCount: z.number(),
  updatedAt: z.string(),
});
const skillSchema = z.object({
  skillId: z.string(),
  versionId: z.string(),
  slug: z.string(),
  name: z.string(),
  version: z.number(),
});
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const intervalAmountSchema = z.number().int().min(1).max(100_000);
const routineScheduleSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("hourly"), minute: z.number().int().min(0).max(59) }).strict(),
  z.object({ kind: z.literal("daily"), time: timeSchema }).strict(),
  z.object({ kind: z.literal("weekdays"), time: timeSchema }).strict(),
  z
    .object({
      kind: z.literal("weekly"),
      weekday: z.number().int().min(0).max(6),
      time: timeSchema,
    })
    .strict(),
  z
    .object({ kind: z.literal("monthly"), day: z.number().int().min(1).max(31), time: timeSchema })
    .strict(),
  z
    .object({
      kind: z.literal("interval"),
      amount: intervalAmountSchema,
      unit: z.enum(["minutes", "hours", "days"]),
      anchorAt: z
        .string()
        .max(100)
        .refine((value) => Number.isFinite(Date.parse(value))),
    })
    .strict(),
  z
    .object({
      kind: z.literal("advanced"),
      months: z.array(z.number().int().min(1).max(12)).min(1).max(12),
      days: z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("every-day") }).strict(),
        z
          .object({
            kind: z.literal("days-of-week"),
            days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
          })
          .strict(),
        z
          .object({
            kind: z.literal("days-of-month"),
            days: z.array(z.number().int().min(1).max(31)).min(1).max(31),
          })
          .strict(),
      ]),
      time: z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("at-time"), time: timeSchema }).strict(),
        z
          .object({
            kind: z.literal("every"),
            amount: intervalAmountSchema,
            unit: z.enum(["minutes", "hours"]),
          })
          .strict(),
      ]),
    })
    .strict(),
  z
    .object({
      kind: z.literal("custom"),
      expression: z.string().min(1).max(INPUT_LIMITS.routineCron),
    })
    .strict(),
]);
const routineSchema = z.object({
  name: z.string(),
  instruction: z.string(),
  active: z.boolean(),
  schedule: routineScheduleSchema,
});
export const marketplaceAgentDetailSchema = summarySchema.extend({
  versionId: z.string(),
  pending: z.boolean().optional(),
  cardUrl: z.string().nullable().optional(),
  skills: z.array(skillSchema),
  routines: z.array(routineSchema),
}) satisfies z.ZodType<MarketplaceAgentDetail>;
export const marketplaceAgentPageSchema = z.object({
  agents: z.array(summarySchema),
  nextCursor: z.string().nullable(),
}) satisfies z.ZodType<MarketplaceAgentPage>;
export const agentSubmissionSchema = z.object({
  id: z.string(),
  listingId: z.string(),
  name: z.string(),
  title: z.string(),
  description: z.string(),
  version: z.number(),
  status: z.enum(["pending", "approved", "rejected"]),
  rejectionNote: z.string().nullable(),
  avatarSeed: z.string(),
  avatarHue: avatarHueSchema,
  avatarUrl: z.string().nullable(),
  skillCount: z.number(),
  routineCount: z.number(),
  activeRoutineCount: z.number(),
  createdAt: z.string(),
  category: categorySchema.optional(),
  showCreatorAvatar: z.boolean().optional(),
}) satisfies z.ZodType<AgentSubmission>;
export const marketplaceSubmissionsSchema = z.array(agentSubmissionSchema);
export const marketplaceDomainSchema = z.object({ submissions: marketplaceSubmissionsSchema });
const queryBooleanSchema = z.enum(["true", "false"]).transform((value) => value === "true");
export const marketplaceListQuerySchema = z
  .object({
    query: z.string().max(200).optional(),
    category: categorySchema.optional(),
    featured: queryBooleanSchema.optional(),
    verified: queryBooleanSchema.optional(),
    sort: z.enum(["installs"]).optional(),
    cursor: z
      .string()
      .max(16)
      .regex(/^\d+$/)
      .refine((value) => Number.isSafeInteger(Number(value)))
      .optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();
export const marketplaceAgentIdSchema = z.string().min(1).max(200);
/** Demo publication metadata only; this grants no authority at an external service. */
export const marketplacePublicationPreviewSchema = z
  .object({
    agentId: marketplaceAgentIdSchema,
    name: z.string().trim().min(1).max(INPUT_LIMITS.agentName),
    title: z.string().max(INPUT_LIMITS.agentTitle),
    description: z.string().max(INPUT_LIMITS.agentDescription),
    avatarSeed: z.string().min(1).max(128),
    avatarHue: avatarHueSchema,
    avatarUrl: z.string().max(INPUT_LIMITS.avatarUrl).nullable(),
    skills: z
      .array(
        skillSchema
          .extend({
            skillId: marketplaceAgentIdSchema,
            versionId: marketplaceAgentIdSchema,
            slug: z.string().min(1).max(64),
            name: z.string().min(1).max(80),
            version: z.number().int().min(1),
          })
          .strict(),
      )
      .max(INPUT_LIMITS.agentSkills),
    routines: z
      .array(
        routineSchema
          .extend({
            name: z.string().min(1).max(INPUT_LIMITS.routineName),
            instruction: z.string().max(INPUT_LIMITS.routineInstruction),
          })
          .strict(),
      )
      .max(INPUT_LIMITS.agentRoutines),
  })
  .strict()
  .refine(
    (value) => new TextEncoder().encode(JSON.stringify(value)).byteLength <= 1_000_000,
    "The publication preview is too large.",
  ) satisfies z.ZodType<AgentPublicationPreview>;
export const submitMarketplaceAgentSchema = z
  .object({
    agentId: z.string().min(1).max(200),
    category: categorySchema.optional(),
    showCreatorAvatar: z.boolean().optional(),
    listingId: z.string().min(1).max(200).optional(),
    preview: marketplacePublicationPreviewSchema.optional(),
  })
  .strict();
