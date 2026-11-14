import assert from "node:assert/strict";
import { mock } from "bun:test";
import axios from "axios";
import { operationsSchema } from "../../src/contracts/operations";
import { applyOperationsChange } from "../../src/server/services/operations";

const state = operationsSchema.parse({
  mode: "simulation",
  revision: 0,
  viewerId: "viewer",
  people: [
    {
      id: "viewer",
      name: "Marina",
      sectorIds: [],
      roleIds: [],
      reportsTo: [],
      goals: ["Qualidade"],
    },
  ],
  sectors: [],
  roles: [],
  agentIds: ["analysis"],
  rules: [
    {
      id: "owner",
      subjectKind: "person",
      subjectId: "viewer",
      resource: "*",
      actions: ["read", "write", "admin"],
      effect: "allow",
      sectorIds: [],
      reason: "Test",
      expiresAt: null,
      approvedBy: "viewer",
    },
  ],
  dashboards: [],
  notebooks: [],
  deliveries: [],
  actions: [],
  audit: [],
  connectors: [],
  dataset: {
    source: "test.csv",
    sha256: "",
    records: 10,
    rejected: 1,
    duplicates: 0,
    failures: 2,
    machines: [],
  },
});
let config: { dashboardModel?: string; dashboardApiKey?: string; dashboardBaseUrl: string } = {
  dashboardModel: "configured-model",
  dashboardApiKey: "test-only",
  dashboardBaseUrl: "https://model.test/v1",
};
let writes = 0,
  requests = 0;
mock.module("../../src/server/config/env", () => ({ serverEnv: () => config }));
mock.module("../../src/server/services/workspace", () => ({
  requireAgent: async () => ({ id: "analysis", name: "Análise industrial" }),
}));
mock.module("../../src/server/services/agents", () => ({ readAgents: async () => [{id:"analysis",name:"Análise",title:"Análise"}] }));
mock.module("../../src/server/services/workflows", () => ({ readStore: async () => [] }));
mock.module("../../src/server/services/operations", () => ({
  readOperations: async () => state,
  changeOperations: async (
    _session: string,
    input: Parameters<typeof applyOperationsChange>[1],
    producer?: string,
  ) => {
    const result = applyOperationsChange(state, input, "2026-11-14T12:00:00Z", "audit", producer);
    writes++;
    return result;
  },
}));
let content = JSON.stringify({
  title: "Qualidade industrial",
  summary: "Indicadores de qualidade ligados ao CSV.",
  widgets: [
    { id: "quality", title: "Dados válidos", kind: "metric", source: "quality", width: "half" },
  ],
});
axios.defaults.adapter = async (request) => {
  requests++;
  assert.equal(request.url, "https://model.test/v1/chat/completions");
  const body = JSON.parse(request.data);
  assert.equal(body.model, "configured-model");
  assert.equal(body.stream, false, "JSON transport must be explicit with 9Router");
  assert.equal(JSON.parse(body.messages[1].content).dataset.records, 10);
  return {
    data: { choices: [{ message: { content } }] },
    status: 200,
    statusText: "OK",
    headers: {},
    config: request,
  };
};
const { composeDashboard } = await import("../../src/server/services/dashboard-compose");
const input = { expectedRevision: 0, agentId: "analysis", objective: "Qualidade do CSV" };
const generated = await composeDashboard("test", input);
assert.equal(generated.dashboards[0]?.origin, "agent");
assert.equal(generated.dashboards[0]?.producerAgentId, "analysis");
assert.equal(writes, 1);
content = '{"title":"Invalid","widgets":[{"html":"<script>"}]}';
await assert.rejects(composeDashboard("test", input), /inválida/u);
assert.equal(writes, 1, "Invalid model output cannot replace the saved panel");
await assert.rejects(
  composeDashboard("test", { ...input, expectedRevision: 5 }),
  /workspace mudou/u,
);
assert.equal(requests, 2, "Stale requests are refused before spending model tokens");
config = { dashboardBaseUrl: "https://model.test/v1" };
const preview = await composeDashboard("test", input);
assert.equal(preview.dashboards[0]?.origin, "template");
assert.equal(preview.dashboards[0]?.producerAgentId, null);
assert.equal(requests, 2, "Simulation never calls an unconfigured paid model");
console.log(
  "PASS dashboard composer: validated model output, producer provenance, invalid-output preservation, revision conflict and explicit simulation",
);

state.revision = generated.revision;
state.dashboards = [
  {...generated.dashboards[0]!, program:'root = Stack([Heading("Original")])'},
  {...generated.dashboards[0]!, id:"dashboard:other", title:"Outro painel"},
];
config = {dashboardModel:"configured-model",dashboardApiKey:"test-only",dashboardBaseUrl:"https://model.test/v1"};
content = JSON.stringify({title:"Painel revisado",program:'root = Stack([Heading("Revisado")])',summary:"Cabeçalho revisado."});
const edited = await composeDashboard("test", {...input,expectedRevision:state.revision,dashboardId:state.dashboards[0]!.id,objective:"Revisar o cabeçalho"});
assert.equal(edited.dashboards.length,2);
assert.equal(edited.dashboards[1]!.title,"Painel revisado");
assert.equal(edited.dashboards[1]!.messages.length,4);
assert.equal(edited.dashboards[0]!.id,"dashboard:other");
assert.equal(edited.dashboards[0]!.title,"Outro painel");
config = {dashboardBaseUrl:"https://model.test/v1"};
await assert.rejects(composeDashboard("test",{...input,expectedRevision:state.revision,dashboardId:state.dashboards[0]!.id}), /preservado/u);
console.log("PASS dashboard edit: isolated history, preserved sibling panel, strict persistence and no destructive template fallback");
