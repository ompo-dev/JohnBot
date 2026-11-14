/**
 * One agent's routine canvas, as the host answers it, turned into the diagram the canvas draws.
 * Node ids are the host's node keys (`routine:<id>`, `agent:<id>`), so a moved node saves under the
 * id it has. A node the user never moved is placed by a simple layout: routines in the first
 * column, each agent one column further than the furthest step it runs in.
 */

import {
  type RoutineFlowStep,
  type RoutineRun,
  type RoutineRunStatus,
  routineFlowAgentKey,
  routineFlowRoutineKey,
  type WorkflowDetail,
  type WorkflowRunDetail,
} from "@johnbot/contracts/ipc";
import type { UnifiedRoutineCanvas } from "../../contracts/unified-routines";
import type { AgentProfile } from "@johnbot/ui/data";
import type {
  Diagram,
  DiagramEdge,
  DiagramNode,
  DiagramPoint,
  DiagramRoutineRun,
  DiagramRun,
  DiagramRunStatus,
  DiagramStepRun,
} from "@johnbot/features/diagrams/diagram-model";

const COLUMN = 360;
const ROUTINE_ROW = 300;
const AGENT_ROW = 300;
/** The edge from a routine to its own agent is the routine itself, not a link the user can remove. */
const ROUTINE_START_PREFIX = "routine-start:";

export function isRoutineStartEdge(edgeId: string): boolean {
  return edgeId.startsWith(ROUTINE_START_PREFIX);
}

/** The routine or agent id of a node id, or null when it is the other kind. */
export function routineIdOfNode(nodeId: string | null): string | null {
  return nodeId?.startsWith("routine:") ? nodeId.slice("routine:".length) : null;
}

export function agentIdOfNode(nodeId: string): string | null {
  return nodeId.startsWith("agent:") ? nodeId.slice("agent:".length) : null;
}

function runStatus(status: RoutineRunStatus, steps: readonly RoutineFlowStep[]): DiagramRunStatus {
  if (status === "queued" || status === "running" || status === "needs-attention") return "running";
  if (steps.some((step) => step.status === "running")) return "running";
  if (status === "cancelled") return "cancelled";
  if (status === "succeeded")
    return steps.some((step) => step.status === "failed") ? "failed" : "succeeded";
  return "failed";
}

function routineRun(run: RoutineRun): DiagramRoutineRun {
  const status: DiagramRunStatus =
    run.status === "succeeded"
      ? "succeeded"
      : run.status === "cancelled"
        ? "cancelled"
        : run.status === "failed" || run.status === "interrupted"
          ? "failed"
          : "running";
  return {
    id: run.id,
    kind: run.kind,
    status,
    startedAt: run.createdAt,
    finishedAt: status === "running" ? null : run.updatedAt,
  };
}

function step(entry: RoutineFlowStep): DiagramStepRun {
  return {
    nodeId: routineFlowAgentKey(entry.agentId),
    status: entry.status === "cancelled" ? "skipped" : entry.status,
    input: entry.input || null,
    output: entry.output,
    error: entry.error,
    startedAt: entry.createdAt,
    finishedAt: entry.status === "running" ? null : entry.updatedAt,
  };
}

/** The run of the routine's own agent while it has no step yet: queued, or working on it. */
function ownerStepInProgress(run: RoutineRun): DiagramStepRun | null {
  if (run.status !== "queued" && run.status !== "running" && run.status !== "needs-attention")
    return null;
  return {
    nodeId: routineFlowAgentKey(run.agentId),
    status: run.status === "queued" ? "waiting" : "running",
    input: run.instruction,
    output: null,
    error: null,
    startedAt: run.createdAt,
    finishedAt: null,
  };
}

export function routineFlowDiagram(
  canvas: UnifiedRoutineCanvas,
  agents: readonly AgentProfile[],
  moved: Readonly<Record<string, DiagramPoint>> = {},
): Diagram {
  const saved = new Map(
    canvas.positions.map((position) => [position.nodeKey, { x: position.x, y: position.y }]),
  );
  const positionOf = (key: string, fallback: DiagramPoint) =>
    moved[key] ?? saved.get(key) ?? fallback;

  // How far along each agent runs, over every routine: its column.
  const column = new Map<string, number>();
  for (const entry of canvas.routines) {
    const owner = entry.routine.agentId;
    column.set(owner, Math.max(column.get(owner) ?? 1, 1));
    const links = canvas.links.filter((link) => link.routineId === entry.routine.id);
    const depth = new Map([[owner, 1]]);
    const queue = [owner];
    for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
      for (const link of links) {
        if (link.fromAgentId !== next || depth.has(link.toAgentId)) continue;
        depth.set(link.toAgentId, (depth.get(next) ?? 1) + 1);
        queue.push(link.toAgentId);
      }
    }
    for (const [agentId, value] of depth)
      column.set(agentId, Math.max(column.get(agentId) ?? 0, value));
  }
  const agentIds = [
    ...new Set([
      canvas.agentId,
      ...canvas.routines.map((entry) => entry.routine.agentId),
      ...canvas.links.flatMap((link) => [link.fromAgentId, link.toAgentId]),
      ...canvas.placedAgentIds,
    ]),
  ];
  // Each agent's row: the row of its first routine, else the row of the first agent that hands work
  // to it, else the next free one. An edge then runs along its row and not behind another card.
  const rowOf = new Map<string, number>();
  const taken = new Set<string>();
  const routineRow = (agentId: string) => {
    const index = canvas.routines.findIndex((entry) => entry.routine.agentId === agentId);
    return index >= 0 ? index : Number.POSITIVE_INFINITY;
  };
  // Column by column, so the agents that hand work on have their rows; routine owners first.
  const byColumn = [...agentIds].sort(
    (a, b) => (column.get(a) ?? 1) - (column.get(b) ?? 1) || routineRow(a) - routineRow(b),
  );
  for (const agentId of byColumn) {
    const from = canvas.links.find(
      (link) => link.toAgentId === agentId && rowOf.has(link.fromAgentId),
    );
    const wanted = Number.isFinite(routineRow(agentId))
      ? routineRow(agentId)
      : from
        ? (rowOf.get(from.fromAgentId) ?? 0)
        : 0;
    const index = column.get(agentId) ?? 1;
    let row = wanted;
    while (taken.has(`${index}:${row}`)) row += 1;
    taken.add(`${index}:${row}`);
    rowOf.set(agentId, row);
  }

  // What each agent does in each routine: the routine's own agent follows the routine, and every
  // other agent the instruction of a link that reaches it in that routine.
  const routineTasks = new Map<string, Record<string, string>>();
  const setTask = (agentId: string, routineKey: string, text: string) => {
    const byRoutine = routineTasks.get(agentId) ?? {};
    if (!byRoutine[routineKey]) byRoutine[routineKey] = text;
    routineTasks.set(agentId, byRoutine);
  };
  for (const entry of canvas.routines) {
    const key = routineFlowRoutineKey(entry.routine.id);
    setTask(entry.routine.agentId, key, entry.routine.instruction);
    for (const link of canvas.links)
      if (link.routineId === entry.routine.id) setTask(link.toAgentId, key, link.instruction);
  }

  const tasks = new Map<string, string>();
  for (const link of canvas.links)
    if (link.instruction && !tasks.has(link.toAgentId)) tasks.set(link.toAgentId, link.instruction);
  for (const entry of canvas.routines)
    if (!tasks.has(entry.routine.agentId))
      tasks.set(entry.routine.agentId, entry.routine.instruction);

  const nodes: DiagramNode[] = [
    ...canvas.routines.map((entry, index): DiagramNode => {
      const key = routineFlowRoutineKey(entry.routine.id);
      return {
        kind: "routine",
        id: key,
        position: positionOf(key, { x: 0, y: index * ROUTINE_ROW }),
        name: entry.routine.name,
        instruction: entry.routine.instruction,
        schedule: entry.routine.trigger.kind === "schedule" ? entry.routine.trigger.schedule : null,
        ...(entry.routine.trigger.kind === "webhook"
          ? {
              webhook: {
                url: entry.routine.trigger.url,
                eventType: entry.routine.trigger.eventType,
                filters: entry.routine.trigger.filters,
              },
            }
          : {}),
        active: entry.routine.active,
        upcomingRuns: entry.upcomingRuns,
        recentRuns: entry.recentRuns.map(routineRun),
      };
    }),
    ...agentIds
      .filter((agentId) => agents.some((agent) => agent.id === agentId))
      .map((agentId): DiagramNode => {
        const key = routineFlowAgentKey(agentId);
        const index = column.get(agentId) ?? 1;
        return {
          kind: "agent",
          id: key,
          position: positionOf(key, {
            x: index * COLUMN,
            y: (rowOf.get(agentId) ?? 0) * AGENT_ROW,
          }),
          agentId,
          task: tasks.get(agentId) ?? "",
          tasks: routineTasks.get(agentId) ?? {},
        };
      }),
  ];
  const present = new Set(nodes.map((node) => node.id));

  const edges: DiagramEdge[] = [
    ...canvas.routines.map((entry) => ({
      id: `${ROUTINE_START_PREFIX}${entry.routine.id}`,
      from: routineFlowRoutineKey(entry.routine.id),
      to: routineFlowAgentKey(entry.routine.agentId),
      routineId: routineFlowRoutineKey(entry.routine.id),
    })),
    ...canvas.links.map((link) => ({
      id: link.id,
      from: routineFlowAgentKey(link.fromAgentId),
      to: routineFlowAgentKey(link.toAgentId),
      routineId: routineFlowRoutineKey(link.routineId),
    })),
  ].filter((edge) => present.has(edge.from) && present.has(edge.to));

  const lastRuns: DiagramRun[] = canvas.routines.flatMap((entry) => {
    const newest = entry.recentRuns[0];
    if (!newest) return [];
    const steps = entry.steps.map(step);
    const owner = steps.some(
      (candidate) => candidate.nodeId === routineFlowAgentKey(newest.agentId),
    )
      ? null
      : ownerStepInProgress(newest);
    return [
      {
        id: newest.id,
        routineNodeId: routineFlowRoutineKey(entry.routine.id),
        kind: newest.kind,
        status: runStatus(newest.status, entry.steps),
        startedAt: newest.createdAt,
        finishedAt: runStatus(newest.status, entry.steps) === "running" ? null : newest.updatedAt,
        steps: owner ? [owner, ...steps] : steps,
      },
    ];
  });

  const agentName = agents.find((agent) => agent.id === canvas.agentId)?.name ?? canvas.agentId;
  const diagram = includeWorkflowRoutines(
    {
      id: `routine-flows:${canvas.agentId}`,
      name: agentName,
      nodes,
      edges,
      lastRuns,
      updatedAt: lastRuns[0]?.startedAt ?? new Date(0).toISOString(),
    },
    canvas.workflowGraphs ?? [],
    canvas.workflowRuns ?? {},
    agents,
  );
  const outputPresent = new Set(diagram.nodes.map((node) => node.id));
  for (const link of canvas.links) {
    const from = routineFlowAgentKey(link.fromAgentId),
      to = routineFlowAgentKey(link.toAgentId);
    if (
      !diagram.edges.some((edge) => edge.id === link.id) &&
      outputPresent.has(from) &&
      outputPresent.has(to)
    )
      diagram.edges.push({
        id: link.id,
        from,
        to,
        routineId: routineFlowRoutineKey(link.routineId),
      });
  }
  for (const node of diagram.nodes) node.position = positionOf(node.id, node.position);
  return diagram;
}

/** Manual and file-processing routines use the same overview cards; their full graph stays in the step editor. */
export function includeWorkflowRoutines(
  base: Diagram,
  details: WorkflowDetail[],
  runs: Record<string, WorkflowRunDetail[]>,
  agents: readonly AgentProfile[],
): Diagram {
  const diagram: Diagram = {
    ...base,
    nodes: base.nodes.map((node) =>
      node.kind === "agent" ? { ...node, tasks: { ...node.tasks } } : { ...node },
    ),
    edges: [...base.edges],
    lastRuns: [...base.lastRuns],
  };
  const known = new Set(diagram.nodes.map((node) => node.id));
  let nextRow = Math.max(0, ...diagram.nodes.map((node) => node.position.y)) + ROUTINE_ROW;
  for (const detail of details) {
    const routineId = routineFlowRoutineKey(detail.summary.id);
    if (known.has(routineId)) continue;
    const history = runs[detail.summary.id] ?? [];
    const status = (run: WorkflowRunDetail): DiagramRunStatus =>
      run.run.status === "done"
        ? "succeeded"
        : run.run.status === "failed"
          ? "failed"
          : run.run.status === "stopped"
            ? "cancelled"
            : "running";
    const trigger = detail.graph.nodes.find((node) => node.kind === "trigger");
    const instruction = String(trigger?.fields.text ?? `${detail.summary.steps} etapas`);
    diagram.nodes.push({
      id: routineId,
      kind: "routine",
      name: detail.summary.title,
      instruction,
      position: { x: 0, y: nextRow },
      schedule: null,
      active: trigger?.fields.active !== false,
      upcomingRuns: [],
      ...(trigger?.fields.trigger === "webhook"
        ? { webhook: { url: null, eventType: null, filters: [] } }
        : {}),
      recentRuns: history.map((run) => ({
        id: run.run.id,
        kind: run.run.source === "schedule" ? "scheduled" : "manual",
        status: status(run),
        startedAt: run.run.startedAt,
        finishedAt: run.run.endedAt,
      })),
    });
    known.add(routineId);
    const steps = detail.graph.nodes.filter(
      (node) => node.kind === "agent" && typeof node.fields.agentId === "string",
    );
    for (const [index, step] of steps.entries()) {
      const agentId = String(step.fields.agentId),
        nodeId = routineFlowAgentKey(agentId);
      if (!known.has(nodeId) && agents.some((agent) => agent.id === agentId)) {
        diagram.nodes.push({
          id: nodeId,
          kind: "agent",
          agentId,
          position: { x: (index + 1) * COLUMN, y: nextRow },
          task: String(step.fields.task ?? ""),
          tasks: { [routineId]: String(step.fields.task ?? "") },
        });
        known.add(nodeId);
      }
      const node = diagram.nodes.find((node) => node.id === nodeId);
      if (node?.kind === "agent")
        node.tasks = { ...node.tasks, [routineId]: String(step.fields.task ?? "") };
    }
    if (steps[0] && known.has(routineFlowAgentKey(String(steps[0].fields.agentId))))
      diagram.edges.push({
        id: `${ROUTINE_START_PREFIX}${detail.summary.id}`,
        from: routineId,
        to: routineFlowAgentKey(String(steps[0].fields.agentId)),
        routineId,
      });
    const latest = history[0];
    if (latest)
      diagram.lastRuns.push({
        id: latest.run.id,
        routineNodeId: routineId,
        kind: latest.run.source === "schedule" ? "scheduled" : "manual",
        status: status(latest),
        startedAt: latest.run.startedAt,
        finishedAt: latest.run.endedAt,
        steps: [
          {
            nodeId: routineId,
            status:
              latest.run.status === "done"
                ? "succeeded"
                : latest.run.status === "failed"
                  ? "failed"
                  : "running",
            input: instruction,
            output: latest.steps
              .map((step) => step.output ?? step.error ?? "")
              .filter(Boolean)
              .join("\n\n"),
            error: latest.run.error,
            startedAt: latest.run.startedAt,
            finishedAt: latest.run.endedAt,
          },
        ],
      });
    nextRow += ROUTINE_ROW;
  }
  return diagram;
}
