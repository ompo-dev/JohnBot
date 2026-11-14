import assert from "node:assert/strict";
import {
  operationsSchema,
  operationsChangeSchema,
  type Operations,
} from "../../src/contracts/operations";
import {
  canAccess,
  operationsProjection,
  reportingRecipients,
  proposeDashboard,
} from "../../src/lib/operations-model";
import { applyOperationsChange } from "../../src/server/services/operations";
import { optimisticOperations } from "../../src/lib/api/mutations/operations";
import { urlStateCleanup } from "../../src/lib/url-state-policy";

const now = "2026-11-13T12:00:00.000Z";
function fixture(): Operations {
  return operationsSchema.parse({
    mode: "simulation",
    revision: 0,
    viewerId: "worker",
    agentIds: ["agent-maintenance"],
    sectors: [
      { id: "maintenance", name: "Manutenção", parentIds: [] },
      { id: "finance", name: "Finanças", parentIds: [] },
    ],
    roles: [{ id: "technician", name: "Técnico", parentIds: [] }],
    people: [
      {
        id: "worker",
        name: "Carlos",
        sectorIds: ["maintenance"],
        roleIds: ["technician"],
        reportsTo: ["manager"],
        goals: ["Manutenção"],
      },
      {
        id: "manager",
        name: "Marina",
        sectorIds: ["maintenance", "finance"],
        roleIds: [],
        reportsTo: [],
        goals: ["Decisões"],
      },
    ],
    rules: [
      {
        id: "sector",
        subjectKind: "sector",
        subjectId: "maintenance",
        resource: "notebook:*",
        actions: ["read", "write"],
        effect: "allow",
        sectorIds: ["maintenance"],
        expiresAt: null,
        reason: "Setor",
        approvedBy: "manager",
      },
      {
        id: "owner",
        subjectKind: "person",
        subjectId: "manager",
        resource: "*",
        actions: ["read", "write", "admin"],
        effect: "allow",
        sectorIds: [],
        expiresAt: null,
        reason: "Responsável",
        approvedBy: "manager",
      },
    ],
    dashboards: [],
    connectors: [],
    actions: [],
    deliveries: [],
    notebooks: [
      {
        id: "maintenance-book",
        title: "Manutenção",
        ownerKind: "agent",
        ownerId: "agent-maintenance",
        sectorIds: ["maintenance"],
        entries: [],
      },
      {
        id: "finance-book",
        title: "Finanças",
        ownerKind: "sector",
        ownerId: "finance",
        sectorIds: ["finance"],
        entries: [],
      },
    ],
    dataset: {
      source: "fixture.csv",
      sha256: "test",
      records: 10,
      failures: 1,
      rejected: 0,
      duplicates: 0,
      machines: [],
    },
  });
}
const state = fixture();
assert.equal(
  canAccess(state, "worker", "read", "notebook:maintenance-book", ["maintenance"]),
  true,
);
assert.equal(canAccess(state, "worker", "read", "notebook:finance-book", ["finance"]), false);
assert.equal(
  canAccess(state, "absent", "read", "notebook:maintenance-book", ["maintenance"]),
  false,
);
assert.equal(canAccess(state, "worker", "admin", "organization:settings"), false);
state.rules.push({ ...state.rules[0], id: "deny", effect: "deny" });
assert.equal(
  canAccess(state, "worker", "read", "notebook:maintenance-book", ["maintenance"]),
  false,
);
state.rules.pop();
state.rules[0].expiresAt = "2026-11-13T11:00:00.000Z";
assert.equal(
  canAccess(state, "worker", "read", "notebook:maintenance-book", ["maintenance"], Date.parse(now)),
  false,
);
state.rules[0].expiresAt = null;
assert.deepEqual(reportingRecipients(state, "worker", state.notebooks[0]), ["manager"]);
state.people[1].reportsTo = ["worker"];
assert.deepEqual(reportingRecipients(state, "worker", state.notebooks[0]), ["manager"]);
state.people[1].reportsTo = [];
const projection = operationsProjection(state);
assert.deepEqual(
  projection.notebooks.map((notebook) => notebook.id),
  ["maintenance-book"],
);
assert.equal(projection.dataset.records, 0);
assert.equal(
  projection.rules.some((rule) => rule.id === "owner"),
  false,
);
const input = operationsChangeSchema.parse({
  expectedRevision: 0,
  change: {
    type: "entry",
    notebookId: "maintenance-book",
    entry: {
      objective: "Inspeção",
      method: "Medição",
      result: "Vibração alta",
      limitations: "Sem laudo",
      importance: "critical",
      sourceRefs: ["machine:cnc01"],
      supersedes: null,
    },
  },
});
const changed = applyOperationsChange(state, input, now, "entry-1");
assert.equal(changed.revision, 1);
assert.equal(changed.deliveries.length, 1);
assert.equal(changed.deliveries[0].personId, "manager");
assert.equal(changed.notebooks[0].entries[0].authorId, "worker");
assert.equal(state.notebooks[0].entries.length, 0);
assert.throws(() => applyOperationsChange(changed, input, now, "entry-2"), /workspace mudou/u);
assert.throws(
  () =>
    applyOperationsChange(
      state,
      { expectedRevision: 0, change: { type: "revoke-rule", ruleId: "owner" } },
      now,
      "x",
    ),
  /permissão/u,
);
assert.throws(
  () =>
    applyOperationsChange(
      state,
      { ...input, change: { ...input.change, notebookId: "finance-book" } } as never,
      now,
      "x",
    ),
  /permissão/u,
);
const denied = fixture();
denied.rules.push({
  ...denied.rules[0],
  id: "manager-deny",
  subjectKind: "person",
  subjectId: "manager",
  effect: "deny",
});
assert.deepEqual(reportingRecipients(denied, "worker", denied.notebooks[0]), []);
const dashboard = proposeDashboard(
  state.people[0],
  "Paradas das máquinas, qualidade do CSV e rotinas",
  now,
);
assert.deepEqual(
  dashboard.widgets.map((widget) => widget.source),
  ["downtime", "quality", "routines"],
);
assert.equal(operationsSchema.parse({ ...state, dashboards: [dashboard] }).dashboards.length, 1);
assert.equal(
  operationsChangeSchema.safeParse({
    expectedRevision: 0,
    change: { type: "dashboard", dashboard: { ...dashboard, javascript: "alert(1)" } },
  }).success,
  false,
);
const optimistic = optimisticOperations(state, {
  expectedRevision: 0,
  change: { type: "dashboard", dashboard },
}) as Operations;
assert.equal(optimistic.dashboards[0].objective, dashboard.objective);
assert.equal(state.dashboards.length, 0);
const membership = fixture();
membership.viewerId = "manager";
assert.throws(
  () =>
    applyOperationsChange(
      membership,
      {
        expectedRevision: 0,
        change: { type: "person", person: { ...membership.people[1], reportsTo: ["worker"] } },
      },
      now,
      "x",
    ),
  /ciclos/u,
);
const cleanup = urlStateCleanup({
  page: "server-settings",
  server: "old",
  menu: "server-menu",
  serverView: "rail",
});
assert.equal(cleanup.page, null);
assert.equal(cleanup.server, null);
assert.equal(cleanup.menu, null);
assert.equal(cleanup.serverView, null);
assert.equal(urlStateCleanup({ page: "dashboard", workflow: "old" }).workflow, null);
assert.equal(urlStateCleanup({ page: "routines", workflow: "keep" }).workflow, undefined);
const adminState = fixture();
adminState.viewerId = "manager";
adminState.connectors = [
  {
    id: "whatsapp",
    name: "WhatsApp",
    family: "messaging",
    implementation: "mock",
    status: "ready",
    capabilities: ["chat"],
    detail: "Desc",
  },
];
const installChange = operationsChangeSchema.parse({
  expectedRevision: 0,
  change: {
    type: "connector-installation",
    connectorId: "whatsapp",
    installed: true,
  },
});
assert.throws(
  () => applyOperationsChange(state, installChange, now, "audit-install-denied"),
  /permissão/u,
);
const installedResult = applyOperationsChange(adminState, installChange, now, "audit-install-1");
assert.equal(installedResult.connectors[0].installed, true);
assert.equal(installedResult.revision, 1);
assert.equal(installedResult.audit.at(-1)?.resource, "connector:whatsapp");
assert.equal(installedResult.audit.at(-1)?.action, "connector-installation");
const optState = optimisticOperations(adminState, installChange) as Operations;
assert.equal(optState.connectors[0].installed, true);
console.log(
  "PASS operations: policy, expiry, projections, hierarchy, immutable notebook entries, conflicts, dashboard validation, optimistic state and disabled-server URLs",
);
