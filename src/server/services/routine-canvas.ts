import { getDatabase } from "../database/client";
import { readStore } from "./workflows";
import { workflowRunPageSchema } from "../../contracts/workspace-ui";
import { unifiedRoutineCanvasSchema } from "../../contracts/unified-routines";
import { workflowRoutineCanvas, routineCanvasLinks } from "../../lib/routine-canvas";
import { workflowToRoutine } from "../../lib/routine-unification";
import { routineLayoutSchema } from "../../contracts/routine-layout";
import { readDomain } from "../repositories/domain-store";

export async function readRoutineCanvas(sessionId: string, serverId: string, agentId: string) {
  const details = (await readStore(sessionId, serverId)).map((record) => record.detail);
  const records = await getDatabase().domainRecord.findMany({
    where: {
      sessionId,
      domain: { in: details.map((detail) => `workflow-runs:${serverId}:${detail.summary.id}`) },
    },
  });
  const runs = Object.fromEntries(
    records.map((record) => [
      record.domain.slice(`workflow-runs:${serverId}:`.length),
      workflowRunPageSchema.parse(record.payload).runs,
    ]),
  );
  const canvas = workflowRoutineCanvas(details, agentId, runs);
  const workflowGraphs = details.filter(
    (detail) =>
      !workflowToRoutine(detail) &&
      (!detail.graph.nodes.some((node) => node.kind === "agent") ||
        detail.graph.nodes.some(
          (node) => node.kind === "agent" && node.fields.agentId === agentId,
        )),
  );
  canvas.links.push(
    ...workflowGraphs.flatMap((detail) => routineCanvasLinks(detail).map((item) => item.link)),
  );
  const layout = await readDomain(
    sessionId,
    `routine-layout:${agentId}`,
    routineLayoutSchema,
    () => ({ positions: [], placedAgentIds: [] }),
  );
  const overrides = new Set(layout.positions.map((position) => position.nodeKey));
  return unifiedRoutineCanvasSchema.parse({
    ...canvas,
    positions: [
      ...canvas.positions.filter((position) => !overrides.has(position.nodeKey)),
      ...layout.positions,
    ],
    placedAgentIds: layout.placedAgentIds,
    workflowGraphs,
    workflowRuns: Object.fromEntries(
      workflowGraphs.map((detail) => [
        detail.summary.id,
        (runs[detail.summary.id] ?? []).slice(0, 20),
      ]),
    ),
  });
}
