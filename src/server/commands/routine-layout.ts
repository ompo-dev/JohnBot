import { z } from "zod";
import { routineLayoutSchema, routinePositionSchema } from "../../contracts/routine-layout";
import { updateDomain } from "../repositories/domain-store";
import type { RegisteredCommand } from "./types";
import { requireAgent } from "../services/workspace";

export const ROUTINE_LAYOUT_COMMANDS: Record<string, RegisteredCommand> = {
  "routines.position": {
    idempotent: true,
    payloadSchema: routinePositionSchema,
    resultSchema: z.null(),
    run: async (context, raw) => {
      const input = routinePositionSchema.parse(raw);
      await requireAgent(context.sessionId, input.agentId);
      await updateDomain(
        context.sessionId,
        `routine-layout:${input.agentId}`,
        routineLayoutSchema,
        () => ({ positions: [], placedAgentIds: [] }),
        (current) => {
          const positions = current.positions.filter(
            (position) => position.nodeKey !== input.nodeKey,
          );
          if (input.position) positions.push({ nodeKey: input.nodeKey, ...input.position });
          const placed = new Set(current.placedAgentIds);
          if (input.nodeKey.startsWith("agent:")) {
            const id = input.nodeKey.slice(6);
            if (input.position) placed.add(id);
            else placed.delete(id);
          }
          return { positions, placedAgentIds: [...placed] };
        },
      );
      return null;
    },
  },
};
