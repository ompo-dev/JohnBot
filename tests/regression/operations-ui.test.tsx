import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import { operationsSchema } from "../../src/contracts/operations";
import { CONNECTOR_CATALOG } from "../../src/contracts/connector-catalog";

const dom = new JSDOM("<!doctype html><html><body><div id='test'></div></body></html>", {
  url: "http://localhost/",
  pretendToBeVisual: true,
});
for (const name of [
  "window",
  "document",
  "FormData",
  "navigator",
  "HTMLElement",
  "Element",
  "Node",
  "NodeFilter",
  "HTMLDivElement",
  "HTMLButtonElement",
  "DOMRect",
  "Event",
  "MouseEvent",
  "KeyboardEvent",
  "CustomEvent",
  "MutationObserver",
  "HTMLInputElement",
  "HTMLFormElement",
  "HTMLSelectElement",
  "HTMLTextAreaElement",
  "DocumentFragment",
  "getComputedStyle",
  "location",
  "history",
]) {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    value: (dom.window as unknown as Record<string, unknown>)[name],
  });
}
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
dom.window.matchMedia = ((media: string) => ({ matches: false, media, addEventListener() {}, removeEventListener() {} })) as typeof window.matchMedia;
dom.window.HTMLElement.prototype.scrollTo = () => {};
globalThis.ResizeObserver = class {
  constructor(private callback: ResizeObserverCallback) {}
  observe(target: Element) { this.callback([{ target, contentRect: new dom.window.DOMRect(0, 0, 600, 300) }] as ResizeObserverEntry[], this as unknown as ResizeObserver); }
  unobserve() {}
  disconnect() {}
};
const { createRoot } = await import("react-dom/client");
const { OperationsPage } = await import("../../src/features/operations/OperationsPage");
const { putQuery, resetDataStore, readConfirmed } = await import("../../src/stores/data-store");
const { http } = await import("../../src/lib/api/client");

const waitFor = async (assertion: () => void | Promise<void>, timeoutMs = 2500, stepMs = 25) => {
  const start = Date.now();
  let lastError: unknown;
  while (Date.now() - start < timeoutMs) {
    try {
      await act(async () => {
        await assertion();
      });
      return;
    } catch (err) {
      lastError = err;
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, stepMs));
      });
    }
  }
  throw lastError;
};
const state = operationsSchema.parse({
  mode: "simulation",
  revision: 3,
  viewerId: "manager",
  people: [
    {
      id: "manager",
      name: "Marina",
      sectorIds: ["factory"],
      roleIds: [],
      reportsTo: [],
      goals: ["Qualidade do CSV"],
    },
    {
      id: "worker",
      name: "Carlos",
      sectorIds: ["factory"],
      roleIds: [],
      reportsTo: ["manager"],
      goals: ["Manutenção"],
    },
  ],
  sectors: [{ id: "factory", name: "Fábrica", parentIds: [] }],
  roles: [],
  agentIds: ["maintenance"],
  rules: [
    {
      id: "owner",
      subjectKind: "person",
      subjectId: "manager",
      resource: "*",
      actions: ["admin", "read", "write"],
      effect: "allow",
      sectorIds: [],
      reason: "Teste",
      expiresAt: null,
      approvedBy: "manager",
    },
  ],
  dashboards: [
    {
      id: "dashboard:manager",
      personId: "manager",
      title: "Dashboard de Marina",
      objective: "Qualidade do CSV",
      widgets: [
        { id: "quality", title: "Qualidade", kind: "metric", source: "quality", width: "half" },
      ],
      origin: "manual",
      updatedAt: "2026-11-13T12:00:00Z",
    },
  ],
  notebooks: [
    {
      id: "book",
      title: "Notebook da manutenção",
      ownerKind: "agent",
      ownerId: "maintenance",
      sectorIds: ["factory"],
      entries: [
        {
          id: "entry",
          notebookId: "book",
          authorId: "manager",
          agentId: null,
          createdAt: "2026-11-13T12:00:00Z",
          objective: "Inspeção CNC",
          method: "Medição com evidência",
          result: "Falha confirmada",
          limitations: "Demonstração",
          importance: "important",
          sourceRefs: ["machine:cnc"],
          runId: null,
          supersedes: null,
        },
      ],
    },
  ],
  connectors: CONNECTOR_CATALOG,
  actions: [],
  deliveries: [],
  dataset: {
    source: "test.csv",
    sha256: "test",
    records: 2500,
    rejected: 0,
    duplicates: 0,
    failures: 1265,
    machines: [{ group: "CNC-01", records: 100, failures: 40, failure_rate: 0.4 }],
  },
});
resetDataStore();
putQuery("/api/operations", state);
let serverState = state;
const composeRequests: unknown[] = [];
const changes: any[] = [];
http.defaults.adapter = async (config) => {
  let data: unknown = config.url?.includes("account/state") ? { status: "signed_out" } : config.url?.includes("agents?") ? [] : serverState;
  if (config.url?.includes("workflows?")) data = readConfirmed(config.url) ?? [];
  if (config.url?.startsWith("/api/connections?")) data = readConfirmed(config.url);
  if (config.url?.includes("operations.change")) changes.push(JSON.parse(String(config.data)).payload.change);
  if (config.url?.includes("dashboards.compose")) {
    const input = JSON.parse(String(config.data)).payload;
    composeRequests.push(input);
    serverState = { ...serverState, revision: serverState.revision + 1, dashboards: [...serverState.dashboards, { ...serverState.dashboards[0], id: "dashboard:new", title: input.title, objective: input.objective }] };
    data = serverState;
  }
  return { data: { ok: true, data }, status: 200, statusText: "OK", headers: {}, config };
};
const root = createRoot(document.getElementById("test")!);
const errors: unknown[] = [],
  originalError = console.error;
console.error = (...args) => {
  errors.push(args);
  originalError(...args);
};
try {
  await act(async () => root.render(<OperationsPage view="dashboard" />));
  await waitFor(() => {
    assert.match(document.body.textContent ?? "", /Dashboard de Marina/u);
    assert.match(document.body.textContent ?? "", /2[.]?500/u);
  });
  const opsQuery = readConfirmed("/api/operations") as any;
  assert.equal(opsQuery?.dataset?.records, 2500, "UI data source keys seeded fixtures correct");
  assert.ok(document.querySelector(".agent-usage .agent-usage-header"), "Dashboard reuses the report page layout");
  assert.ok(document.querySelector(".agent-usage-totals"), "Legacy dashboards preserve the same metric components as Usage");
  assert.equal(document.querySelector(".ui-card"), null, "The report must not be wrapped in stretching card panels");
  assert.ok(document.querySelector(".ui-select-trigger"), "Person picker uses the shared Select");
  assert.ok(document.querySelector(".diagram-chat-launcher")?.textContent?.includes("editar este dashboard"));
  const personalize = [...document.querySelectorAll("button")].find((button) => button.textContent === "Novo dashboard")!;
  assert.ok(personalize);
  await act(async () => personalize.click());
  assert.ok(document.querySelector("textarea.ui-textarea"), "Dashboard objectives use the shared Textarea");
  assert.ok(personalize.classList.contains("ui-button"), "Dashboard controls use the shared Button");
  assert.ok(document.querySelector('.first-agent-setup-panel'), "Creation reuses the agent setup surface");
  const name = document.querySelector<HTMLInputElement>('.first-agent-fields input')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(name, 'Painel solicitado ao agente');
    name.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
  const form = document.querySelector("form")!;
  await act(async () =>
    form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })),
  );
  assert.equal(composeRequests.length, 1);
  assert.deepEqual(composeRequests[0], { expectedRevision: 3, agentId: "johnbot-dashboard-builder", dashboardId: null, objective: "Qualidade do CSV", title: "Painel solicitado ao agente" });
  assert.equal(serverState.dashboards.length, 2, "Creating a dashboard preserves the previous one");
  assert.match(document.body.textContent ?? "", /Painel solicitado ao agente/u);
  assert.match(document.body.textContent ?? "", /Qualidade do CSV/u);
  assert.match(document.body.textContent ?? "", /2[.]?500/u);
  await act(async () => {
    putQuery("/api/workflows?op=list&serverId=local", Array.from({ length: 12 }, (_, index) => ({ id: `routine-${index}`, title: `Rotina ${index}`, steps: index + 1, updatedAt: "2026-11-14T12:00:00Z", lastRun: null })));
    putQuery("/api/operations", { ...serverState, dashboards: [{ ...serverState.dashboards[0], origin: "manual", widgets: [{ id: "chart", title: "Frequência de falhas", source: "downtime", kind: "chart", width: "half" }, { id: "runs", title: "Rotinas recentes", source: "routines", kind: "table", width: "half" }] }] });
  });
  await waitFor(() => {
    assert.ok(document.querySelector('.recharts-responsive-container'), "Charts reuse the shared responsive report container");
    assert.equal(document.querySelectorAll('.agent-usage-table tbody tr').length, 5, "The dashboard must not dump every routine into a stretching panel");
  });
  const showAll = [...document.querySelectorAll('button')].find((button) => button.textContent === "Ver todos (12)")!;
  assert.ok(showAll);
  await act(async () => showAll.click());
  assert.equal(document.querySelectorAll('.agent-usage-table tbody tr').length, 12);
  await act(async () => root.render(<OperationsPage view="access" />));
  assert.match(document.body.textContent ?? "", /Vínculos múltiplos/u);
  assert.ok(document.querySelector('.settings-page .settings-modal-page'), "Access must reuse the original settings page shell");
  await act(async () => (document.querySelector('button[type="submit"]') as HTMLButtonElement).click());
  assert.equal(changes.at(-1)?.type, "person");
  assert.deepEqual(changes.at(-1)?.person.sectorIds, ["factory"]);
  const permissionsTab = [...document.querySelectorAll('button')].find((item) => item.textContent === "Permissões e exceções")!;
  assert.ok(permissionsTab);
  await act(async () => permissionsTab.click());
  assert.ok(document.querySelector('form input[name="reason"]'), "Rules form remains functional behind the original section navigation");
  assert.ok(document.querySelector('.settings-page-nav .settings-modal-nav-item[aria-current="page"]'));
  const auditTab = [...document.querySelectorAll('button')].find((item) => item.textContent === "Auditoria")!;
  assert.ok(auditTab);
  await act(async () => auditTab.click());
  assert.match(document.body.textContent ?? "", /Auditoria da simulação/u);

  // Control tests: new default tabs and provider reuse; nav frame kind tested separately
  await act(async () => root.render(<OperationsPage view="dashboard" />));
  await waitFor(() => {
    const tabs = [...document.querySelectorAll("button, [role='tab']")].map(el => el.textContent?.trim() ?? "");
    assert.ok(tabs.some(t => t.includes("Novo dashboard")), "Default dashboard controls are present");
    assert.ok(document.querySelector(".agent-usage"), "Dashboard view preserves shared provider usage container");
  });

  assert.equal(errors.length, 0, "Operational pages must render without React errors");
} finally {
  await act(async () => root.unmount());
  console.error = originalError;
  dom.window.close();
  resetDataStore();
}
console.log(
  "PASS operations UI: multiple dashboards, setup, original report tables and settings shell with access sections without browser automation",
);
