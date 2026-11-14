import { z } from "zod";

const id = z.string().regex(/^[\w:.-]{1,128}$/u);
const text = z.string().trim().min(1).max(200);
const instant = z.iso.datetime();
export const directoryGroupSchema = z
  .object({ id, name: text, parentIds: z.array(id).max(30) })
  .strict();
export const directoryPersonSchema = z
  .object({
    id,
    name: text,
    sectorIds: z.array(id).max(30),
    roleIds: z.array(id).max(30),
    reportsTo: z.array(id).max(20),
    goals: z.array(text).max(20),
  })
  .strict();
export const accessRuleSchema = z
  .object({
    id,
    subjectKind: z.enum(["person", "sector", "role"]),
    subjectId: id,
    resource: z.string().regex(/^(\*|[\w.-]+:(?:[\w:.-]+|\*))$/u),
    actions: z
      .array(z.enum(["read", "write", "execute", "share", "admin"]))
      .min(1)
      .max(5),
    effect: z.enum(["allow", "deny"]),
    sectorIds: z.array(id).max(30),
    reason: z.string().trim().min(1).max(500),
    expiresAt: instant.nullable(),
    approvedBy: id,
  })
  .strict();
export const dashboardWidgetSchema = z
  .object({
    id,
    title: text,
    kind: z.enum(["metric", "table", "chart", "timeline"]),
    source: z.enum(["downtime", "quality", "routines", "notebooks", "actions"]),
    width: z.enum(["half", "full"]),
  })
  .strict();
export const dashboardSchema = z
  .object({
    id,
    personId: id,
    title: text,
    objective: z.string().trim().min(1).max(2000),
    widgets: z.array(dashboardWidgetSchema).max(24).default([]),
    program: z.string().trim().min(1).max(64_000).nullish(),
    messages: z
      .array(
        z
          .object({
            id,
            author: z.enum(["user", "agent"]),
            text: z.string().min(1).max(4000),
            createdAt: instant,
          })
          .strict(),
      )
      .max(100)
      .default([]),
    updatedAt: instant,
    origin: z.enum(["template", "agent", "manual"]),
    producerAgentId: id.nullish(),
  })
  .strict();
export const notebookEntrySchema = z
  .object({
    id,
    notebookId: id,
    authorId: id,
    agentId: id.nullable(),
    createdAt: instant,
    objective: text,
    method: z.string().trim().min(1).max(4000),
    result: z.string().trim().min(1).max(8000),
    limitations: z.string().max(2000),
    importance: z.enum(["normal", "important", "critical"]),
    sourceRefs: z.array(z.string().min(1).max(200)).max(100),
    runId: id.nullable(),
    supersedes: id.nullable(),
  })
  .strict();
export const notebookSchema = z
  .object({
    id,
    title: text,
    ownerKind: z.enum(["agent", "person", "sector", "machine", "case"]),
    ownerId: id,
    sectorIds: z.array(id).max(30),
    entries: z.array(notebookEntrySchema).max(5000),
  })
  .strict();
export const notebookDeliverySchema = z
  .object({
    id,
    entryId: id,
    notebookId: id,
    personId: id,
    createdAt: instant,
    acknowledgedAt: instant.nullable(),
  })
  .strict();
export const connectorSchema = z
  .object({
    id,
    name: text,
    family: z.enum(["data", "industrial", "messaging", "tools", "agents"]),
    implementation: z.enum(["real", "partial", "mock"]),
    status: z.enum(["ready", "not-configured", "unavailable", "simulated"]),
    capabilities: z.array(text).max(20),
    detail: z.string().max(2000),
    installed: z.boolean().optional(),
  })
  .strict();
export const operationalActionSchema = z
  .object({
    id,
    title: text,
    ownerId: id,
    sectorIds: z.array(id),
    status: z.enum(["open", "done"]),
    dueAt: instant.nullable(),
    sourceRef: z.string().max(200),
  })
  .strict();
export const operationsSchema = z
  .object({
    mode: z.literal("simulation"),
    revision: z.number().int().nonnegative(),
    viewerId: id,
    people: z.array(directoryPersonSchema).min(1).max(5000),
    sectors: z.array(directoryGroupSchema).max(500),
    roles: z.array(directoryGroupSchema).max(500),
    agentIds: z.array(id).max(5000),
    rules: z.array(accessRuleSchema).max(5000),
    dashboards: z.array(dashboardSchema).max(5000),
    notebooks: z.array(notebookSchema).max(1000),
    deliveries: z.array(notebookDeliverySchema).max(10000),
    connectors: z.array(connectorSchema).max(200),
    actions: z.array(operationalActionSchema).max(5000),
    audit: z
      .array(
        z
          .object({ id, actorId: id, action: text, resource: z.string().max(200), at: instant })
          .strict(),
      )
      .max(20000)
      .default([]),
    dataset: z
      .object({
        source: z.string(),
        sha256: z.string(),
        records: z.number().int().nonnegative(),
        rejected: z.number().int().nonnegative(),
        duplicates: z.number().int().nonnegative(),
        failures: z.number().int().nonnegative(),
        machines: z.array(
          z.object({
            group: z.string(),
            records: z.number(),
            failures: z.number(),
            failure_rate: z.number(),
          }),
        ),
      })
      .strict(),
  })
  .strict();

export const operationsChangeSchema = z
  .object({
    expectedRevision: z.number().int().nonnegative(),
    change: z.discriminatedUnion("type", [
      z.object({ type: z.literal("viewer"), personId: id }).strict(),
      z.object({ type: z.literal("dashboard"), dashboard: dashboardSchema }).strict(),
      z.object({ type: z.literal("dashboard-delete"), dashboardId: id }).strict(),
      z.object({ type: z.literal("dashboard-rename"), dashboardId: id, title: text }).strict(),
      z.object({ type: z.literal("dashboard-duplicate"), dashboardId: id, newId: id }).strict(),
      z.object({ type: z.literal("person"), person: directoryPersonSchema }).strict(),
      z.object({ type: z.literal("rule"), rule: accessRuleSchema }).strict(),
      z.object({ type: z.literal("revoke-rule"), ruleId: id }).strict(),
      z
        .object({
          type: z.literal("entry"),
          notebookId: id,
          entry: notebookEntrySchema.omit({
            id: true,
            notebookId: true,
            authorId: true,
            agentId: true,
            createdAt: true,
            runId: true,
          }),
        })
        .strict(),
      z.object({ type: z.literal("acknowledge"), deliveryId: id }).strict(),
      z.object({ type: z.literal("complete-action"), actionId: id }).strict(),
      z
        .object({
          type: z.literal("connector-installation"),
          connectorId: id,
          installed: z.boolean(),
        })
        .strict(),
    ]),
  })
  .strict();

export type Operations = z.infer<typeof operationsSchema>;
export type Person = z.infer<typeof directoryPersonSchema>;
export type AccessRule = z.infer<typeof accessRuleSchema>;
export type Dashboard = z.infer<typeof dashboardSchema>;
export type Notebook = z.infer<typeof notebookSchema>;
export type NotebookEntry = z.infer<typeof notebookEntrySchema>;
export type OperationsChange = z.infer<typeof operationsChangeSchema>;
