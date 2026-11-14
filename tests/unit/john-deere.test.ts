import { isSidebarLayoutSnapshot } from "../../src/contracts/ipc-sidebar-layout";
import { JOHN_DEERE_AGENTS, johnDeereConversation, johnDeereSidebar } from "../../src/server/demo/john-deere";
import { recordsFor, seedWorkflows } from "../../src/server/services/workflows";
import { DEMO_OPTIONS } from "../../src/preview/demo-seed";
import { isWorkflowGraph } from "../../src/contracts/ipc-workflows";

const sidebar = johnDeereSidebar();
if (!isSidebarLayoutSnapshot(sidebar.layout)) throw new Error("Factory sidebar must satisfy the workspace contract.");
if (!sidebar.layout.order.includes("people") || !sidebar.layout.order.includes("unassigned")) {
  throw new Error("Factory sidebar must include the built-in people and unassigned sections.");
}

console.log("PASS: factory sidebar matches the workspace layout contract");

for (const agent of JOHN_DEERE_AGENTS) {
  const conversation = johnDeereConversation(agent.id);
  if (conversation.length < 7 || conversation.filter((message) => message.author === "agent").length < 3) {
    throw new Error(`Factory conversation for ${agent.id} must contain evidence, system context and at least three work turns.`);
  }
  if (conversation.filter((message) => message.attachments?.length).length !== 2)
    throw new Error(`Factory conversation for ${agent.id} must contain operational evidence and an action plan.`);
  if (!conversation.some((message) => message.plan) || !conversation.some((message) => message.subagents?.length)) {
    throw new Error(`Factory conversation for ${agent.id} must retain plan and delegated-work cards.`);
  }
  if (!conversation.some((message) => message.routine) || !conversation.some((message) => message.memoryChanges?.length)) {
    throw new Error(`Factory conversation for ${agent.id} must retain routine and memory activity.`);
  }
}
console.log("PASS: factory agents have complete seeded work conversations");

const conversationShapes = new Set(JOHN_DEERE_AGENTS.map((agent) =>
  johnDeereConversation(agent.id).map((message) => message.author).join(","),
));
if (conversationShapes.size < 3) throw new Error("Factory conversations must differ by work profile.");
console.log("PASS: factory conversation seeds use distinct work profiles");

if (recordsFor(seedWorkflows(), "local").length === 0) throw new Error("Factory workflows must seed an empty workspace.");
if (recordsFor({ servers: [{ serverId: "local", records: [] }] }, "local").length === 0) {
  throw new Error("Legacy empty workflow records must fall back to factory workflows.");
}
const factoryWorkflows = recordsFor(seedWorkflows(), "local");
const csvWorkflow = factoryWorkflows.find((record) => record.detail.summary.id === "wf-machine-downtime-csv");
if (!csvWorkflow || !isWorkflowGraph(csvWorkflow.detail.graph) || csvWorkflow.detail.graph.nodes.map((node) => node.id).join(",") !== "csv-start,csv-bronze,csv-silver,csv-gold,csv-report") throw new Error("CSV workflow must follow Bronze, Silver and Gold.");
for (const [agentId, routines] of Object.entries(DEMO_OPTIONS.routines ?? {})) {
  if (!routines.some((routine) => routine.id.startsWith("routine-factory-"))) continue;
  for (const routine of routines) {
    if ((DEMO_OPTIONS.routineFlowLinks ?? []).filter((link) => link.routineId === routine.id).length < 2) throw new Error(`Missing delegation chain for ${agentId}`);
  }
}
const firstFactoryWorkflow = factoryWorkflows[0];
if (!firstFactoryWorkflow) throw new Error("Factory workflows must include a first workflow.");
const copiedFactoryWorkflows = factoryWorkflows.map((record) => ({
  ...record,
  detail: record.detail.summary.id === firstFactoryWorkflow.detail.summary.id
    ? record.detail
    : { ...record.detail, graph: firstFactoryWorkflow.detail.graph },
}));
const repairedFactoryWorkflows = recordsFor({ servers: [{ serverId: "local", records: copiedFactoryWorkflows }] }, "local");
if (new Set(repairedFactoryWorkflows.map((record) => JSON.stringify(record.detail.graph))).size !== factoryWorkflows.length) {
  throw new Error("Copied factory workflow canvases must recover their distinct templates.");
}
if (recordsFor({
  servers: [{
    serverId: "local",
    records: [{
      detail: { summary: { id: "legacy", title: "Fluxo de trabalho sem título", steps: 0, updatedAt: new Date(0).toISOString(), lastRun: null }, graph: { nodes: [], edges: [] }, revision: 0, triggers: [] },
      versions: [],
    }],
  }],
}, "local").length === 0) throw new Error("Legacy blank workflow must fall back to factory workflows.");

console.log("PASS: factory workflows replace only empty legacy records");
