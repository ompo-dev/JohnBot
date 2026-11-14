import { z } from "zod";
import { isRoutine, type Routine } from "./ipc";
import { isRoutineFlowCanvas, type RoutineFlowCanvas } from "./ipc";
import { isWorkflowRunDetail, type WorkflowRunDetail } from "./ipc";
import { workflowDetailSchema } from "./workflows-data";

export const unifiedRoutineListSchema = z.array(z.custom<Routine>(isRoutine));
export const unifiedRoutineCanvasSchema = z.custom<RoutineFlowCanvas>(isRoutineFlowCanvas).and(
  z.object({
    workflowGraphs: workflowDetailSchema.array().optional(),
    workflowRuns: z
      .record(z.string(), z.array(z.custom<WorkflowRunDetail>(isWorkflowRunDetail)))
      .optional(),
  }),
);
export type UnifiedRoutineCanvas = z.infer<typeof unifiedRoutineCanvasSchema>;
