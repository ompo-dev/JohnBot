import { z } from "zod";
import {
  isWorkflowDetail,
  isWorkflowGraph,
  isWorkflowSaveResult,
  isWorkflowSummary,
  isWorkflowVersion,
  type WorkflowDetail,
  type WorkflowGraph,
  type WorkflowSummary,
  type WorkflowVersion,
} from "./ipc";
const guarded = <T>(check: (value: unknown) => value is T, label: string) =>
  z.custom<T>(check, `${label} is invalid`);
export const workflowGraphSchema = guarded<WorkflowGraph>(isWorkflowGraph, "Workflow graph");
export const workflowSummarySchema = guarded<WorkflowSummary>(
  isWorkflowSummary,
  "Workflow summary",
);
export const workflowDetailSchema = guarded<WorkflowDetail>(isWorkflowDetail, "Workflow detail");
export const workflowVersionSchema = guarded<WorkflowVersion>(
  isWorkflowVersion,
  "Workflow version",
);
export const workflowVersionsSchema = z.array(workflowVersionSchema).max(50);
export const workflowListSchema = z.array(workflowSummarySchema).max(500);
export const workflowSaveResultSchema = guarded(isWorkflowSaveResult, "Workflow save result");
export const workflowIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/u);
export const workflowServerIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/u);
export const workflowTitleSchema = z.string().trim().min(1).max(160);
export const workflowCreateSchema = z
  .object({
    id: workflowIdSchema.optional(),
    title: workflowTitleSchema,
    graph: workflowGraphSchema.optional(),
  })
  .strict();
export const workflowRenameSchema = z
  .object({ workflowId: workflowIdSchema, title: workflowTitleSchema })
  .strict();
export const workflowSaveSchema = z
  .object({
    workflowId: workflowIdSchema,
    baseRevision: z.number().int().nonnegative().safe(),
    graph: workflowGraphSchema,
  })
  .strict();
export const workflowVersionInputSchema = z
  .object({ workflowId: workflowIdSchema, versionId: workflowIdSchema })
  .strict();
