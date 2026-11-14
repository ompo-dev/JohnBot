import type {
  Routine,
  RoutineFlowCanvas,
  RoutineFlowLink,
  RoutineRun,
  WorkflowDetail,
  WorkflowRunDetail,
} from "../contracts/ipc";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { workflowToRoutine } from "./routine-unification";

export function routineCanvasLinks(
  detail: WorkflowDetail,
): { link: RoutineFlowLink; edgeIds: string[]; targetNodeId: string }[] {
  const nodes = new Map(detail.graph.nodes.map((node) => [node.id, node]));
  const result: { link: RoutineFlowLink; edgeIds: string[]; targetNodeId: string }[] = [];
  for (const source of detail.graph.nodes.filter(
    (node) => node.kind === "agent" && typeof node.fields.agentId === "string",
  )) {
    const queue = detail.graph.edges
      .filter((edge) => edge.from === source.id)
      .map((edge) => ({ target: edge.to, path: [edge.id] }));
    const visited = new Set<string>();
    for (let index = 0; index < queue.length; index++) {
      const next = queue[index]!;
      if (visited.has(next.target)) continue;
      visited.add(next.target);
      const target = nodes.get(next.target);
      if (!target) continue;
      if (target.kind === "agent" && typeof target.fields.agentId === "string") {
        const prefix = next.path.length === 1 ? "routine-link:" : "routine-path:";
        const id =
          prefix +
          bytesToHex(
            sha256(
              new TextEncoder().encode(
                JSON.stringify([detail.summary.id, source.id, target.id, next.path]),
              ),
            ),
          );
        result.push({
          link: {
            id,
            routineId: detail.summary.id,
            fromAgentId: String(source.fields.agentId),
            toAgentId: target.fields.agentId,
            instruction: String(target.fields.task ?? ""),
            createdAt: detail.summary.updatedAt,
          },
          edgeIds: next.path,
          targetNodeId: target.id,
        });
      } else
        for (const edge of detail.graph.edges.filter((edge) => edge.from === target.id))
          queue.push({ target: edge.to, path: [...next.path, edge.id] });
    }
  }
  return result;
}

/** The overview remains the original routine/agent diagram; detailed steps are edited within it. */
export function workflowRoutineCanvas(
  details: WorkflowDetail[],
  agentId: string,
  runs: Record<string, WorkflowRunDetail[]> = {},
): RoutineFlowCanvas {
  const selected = details.filter(
    (detail) =>
      workflowToRoutine(detail) &&
      detail.graph.nodes.some((node) => node.kind === "agent" && node.fields.agentId === agentId),
  );
  const canvas: RoutineFlowCanvas = {
    agentId,
    routines: [],
    links: [],
    positions: [],
    placedAgentIds: [],
  };
  for (const detail of selected) {
    const routine = workflowToRoutine(detail)!;
    const history = runs[detail.summary.id] ?? [];
    const latest = history[0];
    canvas.routines.push({
      routine: { ...routine, trigger: { kind: "schedule", schedule: routine.trigger.schedule } },
      recentRuns: history.map((run) => toRun(run, routine)),
      upcomingRuns:
        routine.active && Date.parse(routine.trigger.nextRunAt) > Date.now()
          ? [routine.trigger.nextRunAt]
          : [],
      steps:
        latest?.steps
          .filter((step) => step.agentId)
          .map((step) => ({
            id: step.id,
            runId: step.runId ?? latest.run.id,
            agentId: step.agentId!,
            deliveryId: null,
            input: "",
            output: step.output,
            status:
              step.status === "done"
                ? "succeeded"
                : step.status === "stopped"
                  ? "cancelled"
                  : step.status === "approval"
                    ? "running"
                    : step.status,
            error: step.error,
            createdAt: step.startedAt ?? latest.run.startedAt,
            updatedAt: step.endedAt ?? step.startedAt ?? latest.run.startedAt,
          })) ?? [],
    });
    canvas.links.push(...routineCanvasLinks(detail).map((item) => item.link));
  }
  return canvas;
}

export { toRun };
const toRun = (detail: WorkflowRunDetail, routine: Routine): RoutineRun => ({
  id: detail.run.id,
  routineId: routine.id,
  agentId: routine.agentId,
  deliveryId: null,
  triggerId: detail.run.triggerNodeId,
  kind: detail.run.source === "schedule" ? "scheduled" : "manual",
  scheduledFor: detail.run.startedAt,
  routineName: routine.name,
  instruction: routine.instruction,
  status:
    detail.run.status === "done"
      ? "succeeded"
      : detail.run.status === "failed"
        ? "failed"
        : detail.run.status === "stopped"
          ? "cancelled"
          : detail.run.status === "approval"
            ? "needs-attention"
            : "running",
  error: detail.run.error,
  createdAt: detail.run.startedAt,
  updatedAt: detail.run.endedAt ?? detail.run.startedAt,
});
