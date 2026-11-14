import assert from "node:assert/strict";
import { operationsSchema, type Operations } from "../../src/contracts/operations";
import { connectorPreviewSchema } from "../../src/contracts/connector-preview";
import { workflowListSchema } from "../../src/contracts/workflows-data";
import { twinDataSchema } from "../../src/contracts/twin-data";
import { unifiedRoutineCanvasSchema } from "../../src/contracts/unified-routines";
import { DASHBOARD_BUILDER_ID } from "../../src/contracts/dashboard-builder";

const base = process.env.JOHNBOT_TEST_URL ?? "http://localhost:3000";
// A fresh session isolates this test from the user's workspace and edits.
let cookie = "";
async function request(path: string, body?: unknown, key = crypto.randomUUID()) {
  const response = await fetch(`${base}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json", "Idempotency-Key": key }),
    },
    body: body === undefined ? undefined : JSON.stringify({ payload: body }),
  });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0]!;
  const json = await response.json();
  return { response, json };
}
async function read() {
  const { response, json } = await request("/api/operations");
  assert.equal(response.status, 200, JSON.stringify(json));
  assert.match(response.headers.get("cache-control") ?? "", /no-store/u);
  return operationsSchema.parse(json.data);
}
async function change(state: Operations, change: unknown, key?: string) {
  const result = await request(
    "/api/commands/operations.change",
    { expectedRevision: state.revision, change },
    key,
  );
  assert.equal(result.response.status, 200, JSON.stringify(result.json));
  return operationsSchema.parse(result.json.data);
}
const readyUntil = Date.now() + 30_000;
for (;;) {
  try {
    const health = await fetch(base, { signal: AbortSignal.timeout(2000) });
    if (health.ok) break;
  } catch {
    /* A newly recreated container may not have bound its HTTP socket yet. */
  }
  if (Date.now() >= readyUntil) throw new Error("JohnBot did not become ready within 30 seconds.");
  await Bun.sleep(250);
}
await request("/api/account/state");
let state = await read();
assert.equal(state.mode, "simulation");
assert.ok(state.people.length >= 2);
assert.equal(state.dataset.records, 2500);
assert.equal(state.dataset.failures, 1265);
const dashboardCount = state.dashboards.length;
const composeInput = { expectedRevision: state.revision, agentId: DASHBOARD_BUILDER_ID, objective: "Qualidade dos dados, decisões e rotinas" };
const composeKey = crypto.randomUUID();
const composed = await request("/api/commands/dashboards.compose", composeInput, composeKey);
assert.equal(composed.response.status, 200, JSON.stringify(composed.json));
state = operationsSchema.parse(composed.json.data);
const generatedDashboard = state.dashboards.find((dashboard) => dashboard.objective === composeInput.objective)!;
assert.ok(generatedDashboard, "Generation must add a dashboard without replacing the existing ones");
assert.equal(state.dashboards.length, dashboardCount + 1);
assert.equal(generatedDashboard.messages.length, 2);
assert.equal((await read()).dashboards.find((dashboard) => dashboard.id === generatedDashboard.id)?.objective, composeInput.objective, "Generated dashboard must persist across a fresh API read");
const outdatedComposition = await request("/api/commands/dashboards.compose", composeInput);
assert.equal(outdatedComposition.response.status, 409, "Generation must not overwrite a newer dashboard revision");
assert.equal(
  state.connectors.find((connector) => connector.id === "whatsapp")?.implementation,
  "mock",
);
assert.equal(
  state.connectors.find((connector) => connector.id === "machine-csv")?.implementation,
  "real",
);
const owner = state.viewerId,
  worker = state.people.find((person) => person.id !== owner)!;
const notebook = state.notebooks[0]!;
const grantId = crypto.randomUUID();
state = await change(state, {
  type: "rule",
  rule: {
    id: grantId,
    subjectKind: "person",
    subjectId: worker.id,
    resource: `notebook:${notebook.id}`,
    actions: ["read", "write"],
    effect: "allow",
    sectorIds: [],
    reason: "Exceção para teste de rastreabilidade",
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    approvedBy: owner,
  },
});
const oldRevision = state.revision;
const dashboardId = state.dashboards[0]!.id;
state = await change(state, { type: "viewer", personId: worker.id });
const compositionReplay = await request("/api/commands/dashboards.compose", composeInput, composeKey);
assert.equal(compositionReplay.response.status, 200);
assert.equal(compositionReplay.json.data.viewerId, worker.id, "Replaying a generation cannot reveal the previous persona's panel");
assert.equal(
  state.dashboards.some((dashboard) => dashboard.id === dashboardId),
  false,
);
const denied = await request("/api/commands/operations.change", {
  expectedRevision: state.revision,
  change: { type: "revoke-rule", ruleId: grantId },
});
assert.equal(denied.response.status, 403);
const stale = await request("/api/commands/operations.change", {
  expectedRevision: oldRevision,
  change: { type: "viewer", personId: owner },
});
assert.equal(stale.response.status, 409);
const key = crypto.randomUUID(),
  before = state;
const entryChange = {
  type: "entry",
  notebookId: notebook.id,
  entry: {
    objective: "Teste de evidência",
    method: "Verificação HTTP com PostgreSQL e Redis",
    result: "Registro rastreável",
    limitations: "Dados de demonstração",
    importance: "important",
    sourceRefs: ["machine:integration-test"],
    supersedes: null,
  },
};
state = await change(state, entryChange, key);
const entryCount = state.notebooks.find((item) => item.id === notebook.id)!.entries.length;
const replay = await request(
  "/api/commands/operations.change",
  { expectedRevision: before.revision, change: entryChange },
  key,
);
assert.equal(replay.response.status, 200);
assert.equal(replay.response.headers.get("idempotency-replayed"), "true");
assert.equal(
  operationsSchema.parse(replay.json.data).notebooks.find((item) => item.id === notebook.id)!
    .entries.length,
  entryCount,
);
state = await change(state, { type: "viewer", personId: owner });
assert.ok(
  state.deliveries.some(
    (delivery) => delivery.notebookId === notebook.id && delivery.personId === owner,
  ),
);
const denyId = crypto.randomUUID();
state = await change(state, {
  type: "rule",
  rule: {
    id: denyId,
    subjectKind: "person",
    subjectId: worker.id,
    resource: `notebook:${notebook.id}`,
    actions: ["read", "write"],
    effect: "deny",
    sectorIds: [],
    reason: "Revogação durante leitura em cache",
    expiresAt: null,
    approvedBy: owner,
  },
});
state = await change(state, { type: "viewer", personId: worker.id });
assert.equal(
  state.notebooks.some((item) => item.id === notebook.id),
  false,
);
const replayAfterDeny = await request(
  "/api/commands/operations.change",
  { expectedRevision: before.revision, change: entryChange },
  key,
);
assert.equal(replayAfterDeny.response.status, 200);
assert.equal(
  operationsSchema
    .parse(replayAfterDeny.json.data)
    .notebooks.some((item) => item.id === notebook.id),
  false,
);
state = await change(state, { type: "viewer", personId: owner });
const preview = await request("/api/connections?connector=whatsapp");
assert.equal(preview.response.status, 200, JSON.stringify(preview.json));
assert.equal(connectorPreviewSchema.parse(preview.json.data).mode, "mock");
const routines = await request("/api/workflows?op=list&serverId=local");
assert.equal(routines.response.status, 200, JSON.stringify(routines.json));
const rows = workflowListSchema.parse(routines.json.data);
assert.ok(rows.some((routine) => routine.id === "routine-briefing"));
const remove = await request("/api/commands/workflows.delete", {
  serverId: "local",
  payload: "routine-briefing",
});
assert.equal(remove.response.status, 200);
const reread = await request("/api/workflows?op=list&serverId=local");
assert.equal(
  workflowListSchema.parse(reread.json.data).some((routine) => routine.id === "routine-briefing"),
  false,
  "Migrated routines cannot resurrect after deletion",
);
const csvRun = await request("/api/commands/workflows.run-csv", {
  serverId: "local",
  workflowId: "wf-machine-downtime-csv",
  requestId: crypto.randomUUID(),
});
assert.equal(csvRun.response.status, 200, JSON.stringify(csvRun.json));
state = await read();
assert.ok(
  state.notebooks.some((book) =>
    book.entries.some((entry) => entry.runId === csvRun.json.data.run.id),
  ),
);
const twin = await request("/api/twin");
assert.equal(twin.response.status, 200, JSON.stringify(twin.json));
assert.ok(
  twinDataSchema
    .parse(twin.json.data)
    .notebooks.some((book) =>
      book.entries.some((entry) => entry.links.includes(`run:${csvRun.json.data.run.id}`)),
    ),
);
assert.ok(state.audit.length > 0);
const agentId = state.agentIds[0]!;
const agentRoutines = await request(
  `/api/workflows?${new URLSearchParams({ op: "routines", serverId: "local", agentId })}`,
);
assert.equal(agentRoutines.response.status, 200);
const agentRoutine = agentRoutines.json.data[0];
assert.ok(agentRoutine, "Seeded agent schedules must project from the canonical graph");
const canvasPath = `/api/workflows?${new URLSearchParams({ op: "routine-canvas", serverId: "local", agentId })}`;
const overview = await request(canvasPath);
assert.equal(overview.response.status, 200, JSON.stringify(overview.json));
assert.ok(unifiedRoutineCanvasSchema.parse(overview.json.data).routines.some((entry) => entry.routine.id === agentRoutine.id));
assert.ok(unifiedRoutineCanvasSchema.parse(overview.json.data).workflowGraphs?.some((entry) => entry.summary.id === "wf-machine-downtime-csv"));
const positioned = await request("/api/commands/routines.position", { agentId, nodeKey: `routine:${agentRoutine.id}`, position: { x: 120, y: 240 } });
assert.equal(positioned.response.status, 200);
const moved = await request(canvasPath);
assert.ok(unifiedRoutineCanvasSchema.parse(moved.json.data).positions.some((position) => position.nodeKey === `routine:${agentRoutine.id}` && position.x === 120 && position.y === 240));
const graph = await request(
  `/api/workflows?${new URLSearchParams({ op: "get", serverId: "local", workflowId: agentRoutine.id })}`,
);
const node = graph.json.data.graph.nodes.find(
  (node: { kind: string; fields: { agentId?: string } }) =>
    node.kind === "agent" && node.fields.agentId === agentId,
);
assert.ok(node);
node.fields.task = "Tarefa atualizada pelo editor de etapas";
const graphSaved = await request("/api/commands/workflows.save-graph", { serverId: "local", payload: { workflowId: agentRoutine.id, baseRevision: graph.json.data.revision, graph: graph.json.data.graph } });
assert.equal(graphSaved.response.status, 200, JSON.stringify(graphSaved.json));
const refreshedOverview = await request(canvasPath);
assert.equal(unifiedRoutineCanvasSchema.parse(refreshedOverview.json.data).routines.find((entry) => entry.routine.id === agentRoutine.id)?.routine.instruction, "Tarefa atualizada pelo editor de etapas");
const simulationId = `sim-${crypto.randomUUID()}`;
const simulated = {
  run: {
    ...csvRun.json.data.run,
    id: simulationId,
    workflowId: agentRoutine.id,
    triggerNodeId: "routine-trigger",
  },
  steps: [
    {
      ...csvRun.json.data.steps[0],
      id: `${simulationId}-step`,
      runId: simulationId,
      workflowId: agentRoutine.id,
      nodeId: node.id,
      agentId,
      output: "Resultado simulado com evidência rastreável do agente",
    },
  ],
};
const simulation = await request("/api/commands/workflows.save-simulation", {
  serverId: "local",
  workflowId: agentRoutine.id,
  page: { runs: [simulated], soloSteps: [], nextBefore: null },
});
assert.equal(simulation.response.status, 200, JSON.stringify(simulation.json));
state = await read();
assert.ok(
  state.notebooks.some(
    (book) =>
      book.ownerKind === "agent" &&
      book.ownerId === agentId &&
      book.entries.some((entry) => entry.runId === simulationId),
  ),
);
const installKey = crypto.randomUUID();
const unauthInstall = await request("/api/commands/operations.change", {
  expectedRevision: state.revision,
  change: { type: "connector-installation", connectorId: "whatsapp", installed: true },
});
assert.equal(unauthInstall.response.status, 200);
assert.equal((await read()).connectors.find((c) => c.id === "whatsapp")?.installed, true);
state = await read();
const uninstall = await request("/api/commands/operations.change", {
  expectedRevision: state.revision,
  change: { type: "connector-installation", connectorId: "whatsapp", installed: false },
}, installKey);
assert.equal(uninstall.response.status, 200);
state = await read();
assert.equal(state.connectors.find((c) => c.id === "whatsapp")?.installed, false);
const switchWorker = await change(state, { type: "viewer", personId: worker.id });
const workerInstall = await request("/api/commands/operations.change", {
  expectedRevision: switchWorker.revision,
  change: { type: "connector-installation", connectorId: "whatsapp", installed: true },
});
assert.equal(workerInstall.response.status, 403, "Unauthorized non-admin cannot install connector");
await change(switchWorker, { type: "viewer", personId: owner });
console.log(
  "PASS operations HTTP: PostgreSQL/Redis persistence, isolated sessions, policy enforcement, cache-safe replay, notebook hierarchy, connector previews, one-time routine migration and CSV run evidence in John Twin",
);
