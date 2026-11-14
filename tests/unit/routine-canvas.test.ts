import assert from "node:assert/strict";
import { DEMO_OPTIONS } from "../../src/preview/demo-seed";
import { routineToGraph } from "../../src/lib/routine-unification";
import { routineCanvasLinks, workflowRoutineCanvas } from "../../src/lib/routine-canvas";
import { isRoutineFlowCanvas, type WorkflowDetail } from "../../src/contracts/ipc";
import { urlStateCleanup } from "../../src/lib/url-state-policy";
import {
  includeWorkflowRoutines,
  routineFlowDiagram,
} from "../../src/features/routine-flows/routine-flow-diagram";

const details: WorkflowDetail[] = Object.values(DEMO_OPTIONS.routines ?? {})
  .flat()
  .map((routine) => ({
    summary: {
      id: routine.id,
      title: routine.name,
      steps: 1,
      updatedAt: routine.updatedAt,
      lastRun: null,
    },
    revision: 0,
    graph: routineToGraph(routine, DEMO_OPTIONS.routineFlowLinks),
    triggers: [],
  }));
for (const agentId of Object.keys(DEMO_OPTIONS.routines ?? {})) {
  const canvas = workflowRoutineCanvas(details, agentId);
  assert.equal(isRoutineFlowCanvas(canvas), true, agentId);
  assert.ok(canvas.routines.length > 0, agentId);
  assert.deepEqual(
    canvas.positions,
    [],
    "The overview must not stack cards using coordinates from independent step canvases",
  );
}
const detail = structuredClone(
  details.find((detail) =>
    detail.graph.edges.some(
      (edge) => edge.from.startsWith("agent:") && edge.to.startsWith("agent:"),
    ),
  )!,
);
const direct = detail.graph.edges.find(
  (edge) => edge.from.startsWith("agent:") && edge.to.startsWith("agent:"),
)!;
const before = routineCanvasLinks(detail).find((entry) => entry.edgeIds.includes(direct.id))!;
detail.graph.nodes.push({
  id: "condition",
  kind: "condition",
  at: { x: 440, y: 240 },
  fields: { rule: "Evidence is complete" },
});
detail.graph.edges = [
  ...detail.graph.edges.filter((edge) => edge.id !== direct.id),
  { id: "condition-in", from: direct.from, to: "condition", type: "text" },
  { id: "condition-yes", from: "condition", to: direct.to, type: "text", branch: "yes" },
];
const path = routineCanvasLinks(detail).find(
  (entry) =>
    entry.link.fromAgentId === before.link.fromAgentId &&
    entry.link.toAgentId === before.link.toAgentId,
)!;
assert.ok(path.link.id.startsWith("routine-path:"));
assert.deepEqual(path.edgeIds, ["condition-in", "condition-yes"]);
assert.deepEqual(
  routineCanvasLinks(detail),
  routineCanvasLinks(detail),
  "Stable projected connection IDs",
);
assert.equal(
  urlStateCleanup({ page: "agents", sidebar: "routines", workflow: "keep" }).workflow,
  undefined,
);
assert.equal(
  urlStateCleanup({ page: "agents", sidebar: "agents", workflow: "clear" }).workflow,
  null,
);
assert.equal(
  urlStateCleanup({ page: "routines", agent: "chief", workflow: "keep" }).agent,
  undefined,
);
const csvSeed = DEMO_OPTIONS.workflows!.find(
  (workflow) => workflow.id === "wf-machine-downtime-csv",
)!;
const csv: WorkflowDetail = {
  graph: csvSeed.graph,
  summary: {
    id: csvSeed.id,
    title: csvSeed.title,
    steps: 5,
    updatedAt: "2026-11-14T00:00:00Z",
    lastRun: null,
  },
  revision: 0,
  triggers: [],
};
const base = {
  id: "original",
  name: "Original routines",
  nodes: [],
  edges: [],
  lastRuns: [],
  updatedAt: "2026-11-14T00:00:00Z",
};
const enriched = includeWorkflowRoutines(base, [csv], {}, []);
assert.equal(enriched.id, base.id);
assert.equal(enriched.nodes[0]?.kind, "routine");
assert.equal(enriched.nodes[0]?.id, `routine:${csv.summary.id}`);
assert.equal(base.nodes.length, 0, "Adding manual routines must not mutate the original diagram");
const canvas = workflowRoutineCanvas(
  details,
  detail.graph.nodes.find((node) => node.kind === "agent")!.fields.agentId as string,
);
const csvKey = `routine:${csv.summary.id}`;
canvas.positions.push({ nodeKey: csvKey, x: 530, y: 710 });
const positioned = routineFlowDiagram({ ...canvas, workflowGraphs: [csv] }, []);
assert.deepEqual(
  positioned.nodes.find((node) => node.id === csvKey)?.position,
  { x: 530, y: 710 },
  "Manual routine overview positions survive reload",
);
const link = canvas.links[0];
if (link) {
  canvas.links.push({
    ...link,
    id: "cycle",
    fromAgentId: link.toAgentId,
    toAgentId: link.fromAgentId,
  });
  assert.ok(
    routineFlowDiagram(canvas, []).nodes.length > 0,
    "A cyclic detailed graph must not hang the overview layout",
  );
}
console.log(
  "PASS routine canvas: original routine/agent structure, canonical graphs, stable links, detailed-step paths and scoped URLs",
);
