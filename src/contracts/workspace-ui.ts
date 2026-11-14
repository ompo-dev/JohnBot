import { z } from "zod";
import { isSidebarLayoutSnapshot, type SidebarLayoutSnapshot, isSidebarPinsSnapshot, type SidebarPinsSnapshot, isAgentMemory, type AgentMemory, isWorkflowRunPage, type WorkflowRunPage } from "./ipc";
import { entityIdSchema } from "./workspace-data";
export const sidebarLayoutSchema = z.custom<SidebarLayoutSnapshot>(isSidebarLayoutSnapshot);
export const sidebarPinsSchema = z.custom<SidebarPinsSnapshot>(isSidebarPinsSnapshot);
export const sidebarSchema = z.object({ layout: sidebarLayoutSchema, pins: sidebarPinsSchema }).strict();
export const sidebarChangeSchema = z.object({
  kind: z.enum(["layout", "pins", "seed-pins"]),
  expectedRevision: z.number().int().nonnegative(), layout: sidebarLayoutSchema.optional(), pins: sidebarPinsSchema.optional(),
}).strict().refine((value) => value.kind === "layout" ? Boolean(value.layout) : Boolean(value.pins));
export const memorySchema = z.custom<AgentMemory>(isAgentMemory);
export const memoriesSchema = z.array(memorySchema).max(1000);
export const memoryChangeSchema = z.object({
  agentId: entityIdSchema, action: z.enum(["create", "update", "delete", "clear"]),
  memoryId: entityIdSchema.optional(), text: z.string().trim().min(1).max(32_000).optional(),
}).strict().refine((value) => value.action === "clear" || Boolean(value.memoryId))
  .refine((value) => !["create", "update"].includes(value.action) || Boolean(value.text));
export const workflowRunPageSchema = z.custom<WorkflowRunPage>(isWorkflowRunPage);
export const workflowSimulationSchema = z.object({
  serverId: entityIdSchema,
  workflowId: entityIdSchema,
  page: workflowRunPageSchema.refine((page) => page.runs.length <= 100 && page.soloSteps.length <= 1000 &&
    page.runs.every((entry) => entry.steps.length <= 1000)),
}).strict().refine(({ workflowId, page }) => page.runs.every((entry) => entry.run.workflowId === workflowId && entry.steps.every((step) => step.workflowId === workflowId)) && page.soloSteps.every((step) => step.workflowId === workflowId));
