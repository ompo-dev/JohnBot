import type { Routine, RoutineFlowLink, WorkflowGraph, WorkflowDetail } from "../contracts/ipc";
import { isRoutine } from "../contracts/ipc";

/** Legacy IDs survive migration. Schedules and agent handoffs become ordinary canvas elements. */
export function routineToGraph(
  routine: Routine,
  links: readonly RoutineFlowLink[] = [],
): WorkflowGraph {
  const relevant = links.filter((link) => link.routineId === routine.id);
  const agents = [
    ...new Set([
      routine.agentId,
      ...relevant.flatMap((link) => [link.fromAgentId, link.toAgentId]),
    ]),
  ];
  const graph: WorkflowGraph = {
    nodes: [
      {
        id: "routine-trigger",
        kind: "trigger",
        at: { x: 0, y: 0 },
        schedule: routine.trigger.schedule,
        fields: {
          trigger: "schedule",
          title: routine.name,
          routineId: routine.id,
          ownerAgentId: routine.agentId,
          timezone: routine.timezone,
          active: routine.active,
          createdAt: routine.createdAt,
          updatedAt: routine.updatedAt,
          policy: JSON.stringify({
            limitPolicy: routine.limitPolicy,
            missedPolicy: routine.missedPolicy,
            runIn: routine.runIn,
          }),
        },
      },
    ],
    edges: [],
    strokes: [],
  };
  for (const [index, agentId] of agents.entries())
    graph.nodes.push({
      id: `agent:${agentId}`,
      kind: "agent",
      at: { x: 320 * (index + 1), y: 0 },
      fields: {
        agentId,
        task:
          agentId === routine.agentId
            ? routine.instruction
            : relevant
                .filter((link) => link.toAgentId === agentId)
                .map((link) => link.instruction)
                .join("\n"),
      },
    });
  graph.edges.push({
    id: "routine-start",
    from: "routine-trigger",
    to: `agent:${routine.agentId}`,
    type: "text",
  });
  for (const link of relevant)
    graph.edges.push({
      id: link.id,
      from: `agent:${link.fromAgentId}`,
      to: `agent:${link.toAgentId}`,
      type: "text",
    });
  graph.nodes.push({
    id: "routine-output",
    kind: "output",
    at: { x: 320 * (agents.length + 1), y: 0 },
    fields: { target: "notify", title: "Resultado e evidências" },
  });
  for (const agentId of agents.filter((id) => !relevant.some((link) => link.fromAgentId === id)))
    graph.edges.push({
      id: `output:${agentId}`,
      from: `agent:${agentId}`,
      to: "routine-output",
      type: "text",
    });
  return graph;
}

export function workflowToRoutine(detail: WorkflowDetail): Routine | null {
  const trigger = detail.graph.nodes.find(
    (node) => node.kind === "trigger" && typeof node.fields.routineId === "string" && node.schedule,
  );
  if (!trigger?.schedule || typeof trigger.fields.ownerAgentId !== "string") return null;
  const agentId = trigger.fields.ownerAgentId;
  const owner = detail.graph.nodes.find(
    (node) => node.kind === "agent" && node.fields.agentId === agentId,
  );
  let policy: Partial<Pick<Routine, "limitPolicy" | "missedPolicy" | "runIn">> = {};
  try {
    const value = JSON.parse(String(trigger.fields.policy ?? "{}"));
    if (value && typeof value === "object" && !Array.isArray(value))
      policy = {
        limitPolicy: value.limitPolicy,
        missedPolicy: value.missedPolicy,
        runIn: value.runIn,
      };
  } catch {
    return null;
  }
  const routine: Routine = {
    ...policy,
    id: detail.summary.id,
    name: detail.summary.title,
    agentId,
    instruction: String(owner?.fields.task ?? ""),
    active: trigger.fields.active === true,
    timezone: String(trigger.fields.timezone ?? "America/Sao_Paulo"),
    createdAt: String(trigger.fields.createdAt ?? detail.summary.updatedAt),
    updatedAt: detail.summary.updatedAt,
    trigger: {
      id: trigger.id,
      routineId: detail.summary.id,
      schedule: trigger.schedule,
      nextRunAt:
        detail.triggers.find((state) => state.nodeId === trigger.id)?.nextDueAt ??
        detail.summary.updatedAt,
      createdAt: String(trigger.fields.createdAt ?? detail.summary.updatedAt),
      updatedAt: detail.summary.updatedAt,
    },
  };
  return isRoutine(routine) ? routine : null;
}
