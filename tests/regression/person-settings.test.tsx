import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import { operationsSchema } from "../../src/contracts/operations";

const dom = new JSDOM("<!doctype html><html><body><div id='test'></div></body></html>", {
  url: "http://localhost/",
  pretendToBeVisual: true,
});
for (const name of [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "Element",
  "Node",
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
  "FormData",
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
globalThis.ResizeObserver = class {
  constructor(private callback: ResizeObserverCallback) {}
  observe(target: Element) {
    this.callback(
      [{ target, contentRect: new dom.window.DOMRect(0, 0, 600, 300) }] as ResizeObserverEntry[],
      this as unknown as ResizeObserver,
    );
  }
  unobserve() {}
  disconnect() {}
};

const { createRoot } = await import("react-dom/client");
const { default: PersonSettingsPanel } = await import("../../src/features/john/PersonSettingsPanel");
const { putQuery, resetDataStore } = await import("../../src/stores/data-store");
const { http } = await import("../../src/lib/api/client");

const baseState = operationsSchema.parse({
  mode: "simulation",
  revision: 1,
  viewerId: "admin-user",
  people: [
    {
      id: "person-1",
      name: "Ana Silva",
      sectorIds: ["eng"],
      roleIds: ["dev"],
      reportsTo: [],
      goals: ["Entrega do módulo"],
    },
    {
      id: "admin-user",
      name: "Admin User",
      sectorIds: ["admin-sec"],
      roleIds: ["admin-role"],
      reportsTo: [],
      goals: ["Administrar"],
    },
  ],
  sectors: [
    { id: "eng", name: "Engenharia", parentIds: [] },
    { id: "prod", name: "Produto", parentIds: [] },
    { id: "admin-sec", name: "Administração", parentIds: [] },
  ],
  roles: [
    { id: "dev", name: "Desenvolvedor", parentIds: [] },
    { id: "lead", name: "Líder Técnico", parentIds: [] },
    { id: "admin-role", name: "Administrador Geral", parentIds: [] },
  ],
  agentIds: [],
  rules: [
    {
      id: "admin-rule",
      subjectKind: "person",
      subjectId: "admin-user",
      resource: "organization:settings",
      actions: ["admin"],
      effect: "allow",
      sectorIds: [],
      reason: "Admin global",
      expiresAt: null,
      approvedBy: "admin-user",
    },
    {
      id: "sector-rule-1",
      subjectKind: "sector",
      subjectId: "eng",
      resource: "repo:code",
      actions: ["read", "write"],
      effect: "allow",
      sectorIds: [],
      reason: "Acesso de engenharia ao código",
      expiresAt: null,
      approvedBy: "admin-user",
    },
    {
      id: "role-rule-1",
      subjectKind: "role",
      subjectId: "dev",
      resource: "repo:deploy",
      actions: ["read"],
      effect: "allow",
      sectorIds: [],
      reason: "Dev pode inspecionar deploy",
      expiresAt: null,
      approvedBy: "admin-user",
    },
    {
      id: "personal-exception-1",
      subjectKind: "person",
      subjectId: "person-1",
      resource: "repo:prod-db",
      actions: ["read"],
      effect: "deny",
      sectorIds: [],
      reason: "Bloqueio preventivo pessoal",
      expiresAt: "2025-01-01T00:00:00Z",
      approvedBy: "admin-user",
    },
  ],
  dashboards: [],
  notebooks: [],
  connectors: [],
  actions: [],
  deliveries: [],
  dataset: {
    source: "test.csv",
    sha256: "test",
    records: 100,
    rejected: 0,
    duplicates: 0,
    failures: 10,
    machines: [],
  },
});

resetDataStore();
putQuery("/api/operations", baseState);
let currentState = { ...baseState };
const interceptedChanges: unknown[] = [];

http.defaults.adapter = async (config) => {
  if (config.url?.includes("account/state")) {
    return { data: { ok: true, data: { status: "signed_out" } }, status: 200, statusText: "OK", headers: {}, config };
  }

  if (config.url?.includes("operations.change")) {
    const payload = JSON.parse(String(config.data)).payload;
    interceptedChanges.push(payload);

    if (payload.change.type === "person") {
      currentState = {
        ...currentState,
        revision: currentState.revision + 1,
        people: currentState.people.map((p) => (p.id === payload.change.person.id ? payload.change.person : p)),
      };
    } else if (payload.change.type === "rule") {
      currentState = {
        ...currentState,
        revision: currentState.revision + 1,
        rules: [...currentState.rules, payload.change.rule],
      };
    } else if (payload.change.type === "revoke-rule") {
      currentState = {
        ...currentState,
        revision: currentState.revision + 1,
        rules: currentState.rules.filter((r) => r.id !== payload.change.ruleId),
      };
    }

    putQuery("/api/operations", currentState);
    return { data: { ok: true, data: currentState }, status: 200, statusText: "OK", headers: {}, config };
  }

  return { data: { ok: true, data: currentState }, status: 200, statusText: "OK", headers: {}, config };
};

const root = createRoot(document.getElementById("test")!);

try {
  // 1. Render person node in admin mode
  const personNode = {
    id: "person-1",
    kind: "person" as const,
    name: "Ana Silva",
    detail: "Engenheira de Software",
  };

  await act(async () => {
    root.render(<PersonSettingsPanel node={personNode} onClose={() => {}} />);
  });

  const panelText = document.body.textContent ?? "";

  // Asserção: Sem termos de IA / Brain / Model / Routines / Knowledge
  assert.doesNotMatch(panelText, /\b(Brain|Agente|IA|Modelo de IA|Rotinas|Conhecimento)\b/i);

  // Asserção: Painel dedicado com nome da pessoa, setores, cargos e exceção
  assert.match(panelText, /Ana Silva/u);
  assert.match(panelText, /Setores e cargos/u);
  assert.match(panelText, /Exceção pessoal/u);
  assert.match(panelText, /Regras herdadas e pessoais/u);
  assert.match(panelText, /Negativas prevalecem sobre permissões/u);

  // Asserção: Classes de UI compartilhada presentes
  assert.ok(document.querySelector(".settings-panel"), "settings-panel layout class present");
  assert.ok(document.querySelector(".settings-panel-content"), "settings-panel-content present");
  assert.ok(document.querySelector(".ui-button"), "ui-button present");
  assert.ok(document.querySelector(".ui-input"), "ui-input present");
  assert.ok(document.querySelector(".ui-native-select"), "ui-native-select present");
  assert.ok(document.querySelector(".ui-checkbox"), "ui-checkbox present");

  // Asserção: Regras herdadas mostram origem, justificativa e são somente leitura (sem botão revogar)
  assert.match(panelText, /Origem: Setor \(Engenharia\)/u);
  assert.match(panelText, /Origem: Cargo \(Desenvolvedor\)/u);
  assert.match(panelText, /Acesso de engenharia ao código/u);
  assert.match(panelText, /Herdada \(somente leitura\)/u);

  // Asserção: Exceção pessoal mostra status expirada e botão Revogar
  assert.match(panelText, /Expirada/u);
  assert.match(panelText, /Bloqueio preventivo pessoal/u);
  const revokeButtons = [...document.querySelectorAll("button")].filter((b) => b.textContent?.trim() === "Revogar");
  assert.equal(revokeButtons.length, 1, "Only the personal rule can be revoked");

  // 2. Testar salvar vínculos (membership save)
  const prodCheckbox = document.querySelector('input[name="sector"][value="prod"]') as HTMLInputElement;
  assert.ok(prodCheckbox, "Sector checkbox found");
  assert.equal(prodCheckbox.checked, false);

  await act(async () => {
    prodCheckbox.checked = true;
    prodCheckbox.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  });

  const membershipForm = prodCheckbox.closest("form")!;
  await act(async () => {
    membershipForm.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  });

  assert.equal(interceptedChanges.length, 1);
  assert.equal((interceptedChanges[0] as { change: { type: string } }).change.type, "person");
  assert.deepEqual((interceptedChanges[0] as { change: { person: { sectorIds: string[] } } }).change.person.sectorIds, ["eng", "prod"]);

  // 3. Testar adicionar exceção pessoal e verificar reset do formulário
  const ruleForm = [...document.querySelectorAll("form")].find((f) => f.querySelector('input[name="resource"]'))!;
  assert.ok(ruleForm, "Rule form found");

  const resourceInput = ruleForm.querySelector('input[name="resource"]') as HTMLInputElement;
  const reasonInput = ruleForm.querySelector('input[name="reason"]') as HTMLInputElement;
  resourceInput.value = "repo:secrets";
  reasonInput.value = "Acesso temporário concedido";

  await act(async () => {
    ruleForm.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  });

  assert.equal(interceptedChanges.length, 2);
  assert.equal((interceptedChanges[1] as { change: { type: string } }).change.type, "rule");
  assert.equal((interceptedChanges[1] as { change: { rule: { resource: string } } }).change.rule.resource, "repo:secrets");
  assert.equal((interceptedChanges[1] as { change: { rule: { reason: string } } }).change.rule.reason, "Acesso temporário concedido");
  assert.equal(resourceInput.value, "", "Form inputs reset after successful save");

  // 4. Testar revogar exceção pessoal
  await act(async () => {
    revokeButtons[0].click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  assert.equal(interceptedChanges.length, 3);
  assert.deepEqual(interceptedChanges[2], {
    expectedRevision: 3,
    change: { type: "revoke-rule", ruleId: "personal-exception-1" },
  });

  // 5. Testar modo leitor (não admin)
  const readerState = {
    ...currentState,
    viewerId: "person-1", // Person 1 não tem role de admin nem regra de admin
  };

  await act(async () => {
    putQuery("/api/operations", readerState);
    root.render(<PersonSettingsPanel node={personNode} onClose={() => {}} />);
  });

  assert.match(document.body.textContent ?? "", /Somente leitura: você não tem acesso de administrador/u);
  // Controles de admin devem estar ocultos ou desabilitados
  assert.equal(document.querySelector('form input[name="resource"]'), null, "Admin rule form hidden for reader");
  const disabledInputs = [...document.querySelectorAll('input[type="checkbox"]')].filter((i) => (i as HTMLInputElement).disabled);
  assert.ok(disabledInputs.length > 0, "Membership inputs disabled for reader");

  // 6. Testar entidade não pessoal (read-only context)
  const nonPersonNode = {
    id: "sector-1",
    kind: "sector" as const,
    name: "Setor de Operações",
    detail: "Área industrial",
  };

  await act(async () => {
    root.render(<PersonSettingsPanel node={nonPersonNode} onClose={() => {}} />);
  });

  assert.match(document.body.textContent ?? "", /Entidade não pessoal · somente leitura/u);
  assert.match(document.body.textContent ?? "", /Setor de Operações/u);

  console.log("PASS person settings: React rendering, membership persistence, exception add/revoke, read-only inherited rules, and nonperson context verified.");
} finally {
  await act(async () => root.unmount());
  dom.window.close();
  resetDataStore();
}
