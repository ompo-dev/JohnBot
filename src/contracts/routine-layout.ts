import { z } from "zod";
import { workflowIdSchema } from "./workflows-data";

export const routineLayoutSchema = z
  .object({
    positions: z
      .array(
        z
          .object({
            nodeKey: z.string().regex(/^(agent|routine):[A-Za-z0-9_-]{1,128}$/u),
            x: z.number().finite(),
            y: z.number().finite(),
          })
          .strict(),
      )
      .max(1000),
    placedAgentIds: z.array(workflowIdSchema).max(500),
  })
  .strict();
export const routinePositionSchema = z
  .object({
    agentId: workflowIdSchema,
    nodeKey: z.string().regex(/^(agent|routine):[A-Za-z0-9_-]{1,128}$/u),
    position: z
      .object({
        x: z.number().finite().min(-1_000_000).max(1_000_000),
        y: z.number().finite().min(-1_000_000).max(1_000_000),
      })
      .strict()
      .nullable(),
  })
  .strict();
