import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  operationsSchema,
  type Operations,
  type OperationsChange,
} from "../../contracts/operations";
import { CONNECTOR_CATALOG } from "../../contracts/connector-catalog";
import { transformMachineDowntime } from "../../lib/machine-downtime-analysis";
import {
  canAccess,
  operationsProjection,
  proposeDashboard,
  reportingRecipients,
} from "../../lib/operations-model";
import { dashboardDemoProgram } from "../../lib/dashboard-demo";
import { getDatabase } from "../database/client";
import { ApiError, invalidInput } from "../errors";
import { readDomain, updateDomain } from "../repositories/domain-store";
import { readAgents } from "./agents";
import { validateDashboardProgram } from "../../contracts/dashboard-library";
import { dashboardProgramSources } from "../../contracts/dashboard-program";
import type { WorkflowRunDetail } from "../../contracts/ipc";

export const OPERATIONS_DOMAIN = "operations-v1";

async function seedOperations(sessionId: string): Promise<Operations> {
  const database = getDatabase();
  const [nodes, edges, notebooks, agents, csv] = await Promise.all([
    database.twinNode.findMany({ orderBy: [{ position: "asc" }, { id: "asc" }] }),
    database.twinEdge.findMany(),
    database.twinNotebook.findMany({ include: { entries: true } }),
    readAgents(sessionId),
    readFile(join(process.cwd(), "public/datasets/machine-downtime.csv"), "utf8"),
  ]);
  const sectors = nodes
    .filter((node) => node.kind === "department")
    .map((node) => ({ id: node.id, name: node.name, parentIds: node.dept ? [node.dept] : [] }));
  const roles = nodes
    .filter((node) => node.kind === "role")
    .map((node) => ({ id: node.id, name: node.name, parentIds: [] }));
  const existingPeople = nodes.filter((node) => node.kind === "person");
  const leader =
    existingPeople.find((node) => node.id === "p-marina")?.id ??
    existingPeople[0]?.id ??
    "workspace-owner";
  const people = existingPeople.map((node) => ({
    id: node.id,
    name: node.name,
    sectorIds: node.dept && sectors.some((sector) => sector.id === node.dept) ? [node.dept] : [],
    roleIds: edges
      .filter(
        (edge) =>
          edge.from === node.id &&
          edge.label === "ocupa" &&
          roles.some((role) => role.id === edge.to),
      )
      .map((edge) => edge.to),
    reportsTo: node.id === leader ? [] : [leader],
    goals: [node.detail || "Acompanhar pendências e evidências do meu trabalho"],
  }));
  if (!people.length)
    people.push({
      id: leader,
      name: "Responsável pelo workspace",
      sectorIds: [],
      roleIds: [],
      reportsTo: [],
      goals: ["Acompanhar pendências, rotinas e evidências"],
    });
  const now = new Date().toISOString();
  const layers = transformMachineDowntime(csv);
  const importedNotebooks: Operations["notebooks"] = notebooks.map((notebook) => {
    const owner = nodes.find((node) => node.id === notebook.ownerId);
    const sectorIds =
      owner?.dept && sectors.some((sector) => sector.id === owner.dept) ? [owner.dept] : [];
    return {
      id: notebook.id,
      title: notebook.title,
      ownerKind:
        notebook.ownerKind === "person"
          ? "person"
          : notebook.ownerKind === "department"
            ? "sector"
            : notebook.ownerKind === "equipment"
              ? "machine"
              : "case",
      ownerId: notebook.ownerId,
      sectorIds,
      entries: notebook.entries.map((entry) => ({
        id: entry.id,
        notebookId: notebook.id,
        authorId: leader,
        agentId: null,
        createdAt: entry.date.toISOString(),
        objective: notebook.title,
        method: "Registro importado do John Twin; autoria textual original: " + entry.author,
        result: entry.text,
        limitations:
          "Histórico de demonstração importado; não representa execução real de um agente.",
        importance: "normal",
        sourceRefs: entry.links,
        runId: null,
        supersedes: null,
      })),
    };
  });
  for (const agent of agents)
    importedNotebooks.push({
      id: `agent-notebook:${agent.id}`,
      title: `Notebook · ${agent.name}`,
      ownerKind: "agent",
      ownerId: agent.id,
      sectorIds: people.find((person) => person.name === agent.name)?.sectorIds ?? [],
      entries: [],
    });
  const rules: Operations["rules"] = people.flatMap((person) => [
    {
      id: `read-connectors:${person.id}`,
      subjectKind: "person",
      subjectId: person.id,
      resource: "connector:*",
      actions: ["read"],
      effect: "allow",
      sectorIds: [],
      reason: "Catálogo demonstrativo sem segredos",
      expiresAt: null,
      approvedBy: leader,
    },
    {
      id: `read-dataset:${person.id}`,
      subjectKind: "person",
      subjectId: person.id,
      resource: "table:machine-downtime",
      actions: ["read"],
      effect: "allow",
      sectorIds: [],
      reason: "Dataset público do piloto",
      expiresAt: null,
      approvedBy: leader,
    },
    {
      id: `read-routines:${person.id}`,
      subjectKind: "person",
      subjectId: person.id,
      resource: "routine:*",
      actions: ["read", "execute"],
      effect: "allow",
      sectorIds: [],
      reason: "Rotinas demonstrativas",
      expiresAt: null,
      approvedBy: leader,
    },
  ]);
  for (const sector of sectors)
    rules.push({
      id: `sector-notebooks:${sector.id}`,
      subjectKind: "sector",
      subjectId: sector.id,
      resource: "notebook:*",
      actions: ["read", "write"],
      effect: "allow",
      sectorIds: [sector.id],
      reason: "Evidências do setor; acompanha os vínculos atuais da pessoa",
      expiresAt: null,
      approvedBy: leader,
    });
  rules.push({
    id: "simulation-owner",
    subjectKind: "person",
    subjectId: leader,
    resource: "*",
    actions: ["read", "write", "execute", "share", "admin"],
    effect: "allow",
    sectorIds: [],
    reason: "Administrador do workspace de simulação",
    expiresAt: null,
    approvedBy: leader,
  });
  return operationsSchema.parse({
    mode: "simulation",
    revision: 0,
    viewerId: leader,
    people,
    sectors,
    roles,
    agentIds: agents.map((agent) => agent.id),
    rules,
    dashboards: people.map((person) =>
      proposeDashboard(
        person,
        person.id === leader
          ? "Pendências, decisões, rotinas, notebooks e paradas de máquinas"
          : `${person.goals.join(". ")}. Pendências e evidências`,
        now,
      ),
    ),
    notebooks: importedNotebooks,
    deliveries: [],
    connectors: CONNECTOR_CATALOG,
    actions: people.map((person) => ({
      id: `action:${person.id}`,
      title:
        person.id === leader
          ? "Revisar decisões operacionais e seus responsáveis"
          : `Revisar evidências de ${person.goals[0]?.slice(0, 100) ?? person.name}`,
      ownerId: person.id,
      sectorIds: person.sectorIds,
      status: "open",
      dueAt: null,
      sourceRef: `twin:${person.id}`,
    })),
    dataset: {
      source: "machine-downtime.csv",
      sha256: createHash("sha256").update(csv).digest("hex"),
      records: layers.silver.rows.length,
      rejected: layers.silver.rejected.length,
      duplicates: layers.silver.duplicates,
      failures: layers.silver.rows.filter((row) => row.downtime === "machine_failure").length,
      machines: layers.gold.byMachine,
    },
  });
}

let validatedDemoProgram: string | null = null;
function getValidatedDemoProgram(): string | null {
  if (validatedDemoProgram !== null) return validatedDemoProgram;
  try {
    const code = dashboardDemoProgram();
    validateDashboardProgram(code);
    validatedDemoProgram = code;
  } catch {
    validatedDemoProgram = "";
  }
  return validatedDemoProgram || null;
}

export async function readOperations(sessionId: string): Promise<Operations> {
  const existing = await getDatabase().domainRecord.findUnique({
    where: { sessionId_domain: { sessionId, domain: OPERATIONS_DOMAIN } },
    select: { revision: true },
  });
  const seed = existing ? undefined : await seedOperations(sessionId);
  const data = await readDomain(sessionId, OPERATIONS_DOMAIN, operationsSchema, () => {
    if (!seed) throw new Error("Operations initialization was lost.");
    return seed;
  });
  const demoProgram = getValidatedDemoProgram();
  const needsUpgrade = demoProgram && data.dashboards.some(
    (d) => d.id === `dashboard:${d.personId}` && d.origin === "template" && !d.program,
  );
  if (!needsUpgrade) return data;
  return updateDomain(
    sessionId,
    OPERATIONS_DOMAIN,
    operationsSchema,
    () => data,
    (current) => {
      const prog = getValidatedDemoProgram();
      if (!prog) return current;
      const targets = current.dashboards.filter(
        (d) => d.id === `dashboard:${d.personId}` && d.origin === "template" && !d.program,
      );
      if (!targets.length) return current;
      const targetIds = new Set(targets.map((d) => d.id));
      const state = structuredClone(current);
      state.dashboards = state.dashboards.map((d) =>
        targetIds.has(d.id) ? { ...d, program: prog } : d,
      );
      state.revision++;
      return state;
    },
  );
}

function assertAllowed(
  state: Operations,
  action: "read" | "write" | "share" | "admin",
  resource: string,
  sectors: string[] = [],
) {
  if (!canAccess(state, state.viewerId, action, resource, sectors))
    throw new ApiError(
      403,
      "unauthorized",
      "A pessoa selecionada não tem permissão para esta operação.",
    );
}

export function applyOperationsChange(
  current: Operations,
  input: OperationsChange,
  now: string,
  newId: string,
  dashboardAgentId?: string,
): Operations {
  if (current.revision !== input.expectedRevision)
    throw new ApiError(409, "conflict", "O workspace mudou. Recarregue antes de salvar.");
  const state = structuredClone(current);
  const change = input.change;
  const viewer = state.people.find((person) => person.id === state.viewerId)!;
  switch (change.type) {
    case "viewer":
      // Explicit simulation only. This is not login and must never grant access to live external data.
      if (
        state.mode !== "simulation" ||
        !state.people.some((person) => person.id === change.personId)
      )
        throw invalidInput("Pessoa não encontrada.");
      state.viewerId = change.personId;
      break;
    case "dashboard": {
      if (change.dashboard.personId !== viewer.id)
        assertAllowed(state, "admin", "organization:settings");
      if (!state.people.some((person) => person.id === change.dashboard.personId))
        throw invalidInput("Pessoa não encontrada.");
      const existing = state.dashboards.find((item) => item.id === change.dashboard.id);
      if (existing && existing.personId !== change.dashboard.personId)
        throw invalidInput("O painel pertence a outra pessoa.");
      if (!change.dashboard.program && !change.dashboard.widgets.length)
        throw invalidInput("O painel não possui conteúdo.");
      if (change.dashboard.program) {
        try {
          validateDashboardProgram(change.dashboard.program);
        } catch {
          throw invalidInput("A composição do dashboard é inválida.");
        }
        const sources = dashboardProgramSources(change.dashboard.program);
        if (sources.has("machines") || sources.has("quality")) assertAllowed(state, "read", "table:machine-downtime");
      }
      for (const widget of change.dashboard.widgets) {
        if (["downtime", "quality"].includes(widget.source))
          assertAllowed(state, "read", "table:machine-downtime");
      }
      const value = {
        ...change.dashboard,
        origin: dashboardAgentId
          ? ("agent" as const)
          : change.dashboard.origin === "template"
            ? ("template" as const)
            : ("manual" as const),
        producerAgentId: dashboardAgentId ?? null,
        updatedAt: now,
      };
      state.dashboards = [...state.dashboards.filter((item) => item.id !== value.id), value];
      break;
    }
    case "dashboard-delete":
    case "dashboard-rename":
    case "dashboard-duplicate": {
      const dashboard = state.dashboards.find((item) => item.id === change.dashboardId);
      if (!dashboard) throw new ApiError(404, "not_found", "Dashboard não encontrado.");
      if (dashboard.personId !== viewer.id) assertAllowed(state, "admin", "organization:settings");
      if (change.type === "dashboard-delete")
        state.dashboards = state.dashboards.filter((item) => item.id !== dashboard.id);
      else if (change.type === "dashboard-rename") {
        dashboard.title = change.title;
        dashboard.updatedAt = now;
      } else {
        if (state.dashboards.some((item) => item.id === change.newId))
          throw invalidInput("O ID do novo painel já existe.");
        state.dashboards.push({
          ...dashboard,
          id: change.newId,
          personId: viewer.id,
          title: `${dashboard.title.slice(0, 190)} (cópia)`,
          updatedAt: now,
        });
      }
      break;
    }
    case "person": {
      assertAllowed(state, "admin", "organization:settings");
      const person = change.person;
      if (
        !state.people.some((entry) => entry.id === person.id) ||
        person.sectorIds.some((id) => !state.sectors.some((sector) => sector.id === id)) ||
        person.roleIds.some((id) => !state.roles.some((role) => role.id === id)) ||
        person.reportsTo.some(
          (id) => id === person.id || !state.people.some((entry) => entry.id === id),
        )
      )
        throw invalidInput("Vínculo organizacional inválido.");
      state.people = state.people.map((entry) => (entry.id === person.id ? person : entry));
      const pending = [...person.reportsTo],
        visited = new Set<string>();
      for (let index = 0; index < pending.length; index++) {
        const id = pending[index]!;
        if (id === person.id) throw invalidInput("A hierarquia não pode conter ciclos.");
        if (visited.has(id)) continue;
        visited.add(id);
        pending.push(...(state.people.find((entry) => entry.id === id)?.reportsTo ?? []));
      }
      break;
    }
    case "rule": {
      assertAllowed(state, "admin", "organization:settings");
      const subjects =
        change.rule.subjectKind === "person"
          ? state.people
          : change.rule.subjectKind === "sector"
            ? state.sectors
            : state.roles;
      if (
        !subjects.some((subject) => subject.id === change.rule.subjectId) ||
        change.rule.sectorIds.some((id) => !state.sectors.some((sector) => sector.id === id))
      )
        throw invalidInput("Escopo de permissão inválido.");
      if (change.rule.expiresAt && Date.parse(change.rule.expiresAt) <= Date.parse(now))
        throw invalidInput("A exceção já expirou.");
      const rule = { ...change.rule, approvedBy: viewer.id };
      state.rules = [...state.rules.filter((item) => item.id !== rule.id), rule];
      break;
    }
    case "revoke-rule":
      assertAllowed(state, "admin", "organization:settings");
      state.rules = state.rules.filter((rule) => rule.id !== change.ruleId);
      break;
    case "entry": {
      const notebook = state.notebooks.find((entry) => entry.id === change.notebookId);
      if (!notebook) throw new ApiError(404, "not_found", "Notebook não encontrado.");
      assertAllowed(state, "write", `notebook:${notebook.id}`, notebook.sectorIds);
      if (
        change.entry.supersedes &&
        !notebook.entries.some((entry) => entry.id === change.entry.supersedes)
      )
        throw invalidInput("O registro corrigido pertence a outro notebook.");
      const entry = {
        ...change.entry,
        id: newId,
        notebookId: notebook.id,
        authorId: viewer.id,
        agentId: null,
        runId: null,
        createdAt: now,
      };
      notebook.entries.push(entry);
      if (entry.importance !== "normal")
        for (const personId of reportingRecipients(state, viewer.id, notebook)) {
          state.deliveries.push({
            id: `${newId}:${personId}`,
            entryId: newId,
            notebookId: notebook.id,
            personId,
            createdAt: now,
            acknowledgedAt: null,
          });
        }
      break;
    }
    case "acknowledge": {
      const delivery = state.deliveries.find(
        (item) => item.id === change.deliveryId && item.personId === viewer.id,
      );
      const notebook = delivery && state.notebooks.find((item) => item.id === delivery.notebookId);
      if (!delivery || !notebook) throw new ApiError(404, "not_found", "Resumo não encontrado.");
      assertAllowed(state, "read", `notebook:${notebook.id}`, notebook.sectorIds);
      delivery.acknowledgedAt ??= now;
      break;
    }
    case "complete-action": {
      const action = state.actions.find((item) => item.id === change.actionId);
      if (!action) throw new ApiError(404, "not_found", "Pendência não encontrada.");
      if (action.ownerId !== viewer.id) assertAllowed(state, "admin", "organization:settings");
      action.status = "done";
      break;
    }
    case "connector-installation": {
      assertAllowed(state, "admin", "organization:settings");
      const connector = state.connectors.find((item) => item.id === change.connectorId);
      if (!connector) throw new ApiError(404, "not_found", "Conector não encontrado.");
      connector.installed = change.installed;
      break;
    }
  }
  const resource =
    change.type === "entry"
      ? `notebook:${change.notebookId}`
      : change.type === "dashboard"
        ? `dashboard:${change.dashboard.id}`
        : change.type === "dashboard-delete" ||
            change.type === "dashboard-rename" ||
            change.type === "dashboard-duplicate"
          ? `dashboard:${change.dashboardId}`
          : change.type === "person"
            ? `person:${change.person.id}`
            : change.type === "rule"
              ? change.rule.resource
              : change.type === "revoke-rule"
                ? `rule:${change.ruleId}`
                : change.type === "viewer"
                  ? `person:${change.personId}`
                  : change.type === "acknowledge"
                    ? `delivery:${change.deliveryId}`
                    : change.type === "connector-installation"
                      ? `connector:${change.connectorId}`
                      : `action:${change.actionId}`;
  state.audit.push({ id: newId, actorId: viewer.id, action: change.type, resource, at: now });
  state.revision++;
  return operationsSchema.parse(state);
}

export async function changeOperations(
  sessionId: string,
  input: OperationsChange,
  dashboardAgentId?: string,
): Promise<Operations> {
  const initial = await readOperations(sessionId);
  const now = new Date().toISOString(),
    id = crypto.randomUUID();
  const state = await updateDomain(
    sessionId,
    OPERATIONS_DOMAIN,
    operationsSchema,
    () => initial,
    (current) => applyOperationsChange(current, input, now, id, dashboardAgentId),
  );
  return operationsProjection(state);
}

/** Terminal run IDs deduplicate notebook publication even when a command is replayed after a crash. */
export async function recordRoutineOutcome(
  sessionId: string,
  title: string,
  run: WorkflowRunDetail,
  mode: "local" | "simulation",
) {
  if (!["done", "failed", "stopped"].includes(run.run.status)) return;
  const initial = await readOperations(sessionId);
  const notebookScope =
    [...(initial.people.find((person) => person.id === initial.viewerId)?.sectorIds ?? [])]
      .sort()
      .join(",") || `private:${initial.viewerId}`;
  const notebookId = `routine-book:${createHash("sha256").update(`${run.run.workflowId}:${notebookScope}`).digest("hex").slice(0, 24)}`;
  const entryId = `run-entry:${createHash("sha256").update(run.run.id).digest("hex").slice(0, 24)}`;
  const actorId = initial.viewerId;
  await updateDomain(
    sessionId,
    OPERATIONS_DOMAIN,
    operationsSchema,
    () => initial,
    (current) => {
      if (
        current.notebooks.some((notebook) => notebook.entries.some((entry) => entry.id === entryId))
      )
        return current;
      const state = structuredClone(current);
      const author = state.people.find((person) => person.id === actorId);
      if (!author) throw invalidInput("Responsável pela execução não encontrado.");
      let notebook = state.notebooks.find((notebook) => notebook.id === notebookId);
      if (!notebook) {
        notebook = {
          id: notebookId,
          title: `Rotina · ${title}`.slice(0, 200),
          ownerKind: "case",
          ownerId: run.run.workflowId,
          sectorIds: [...author.sectorIds],
          entries: [],
        };
        state.notebooks.push(notebook);
        state.rules.push({
          id: `run-owner:${notebookId}:${actorId}`,
          subjectKind: "person",
          subjectId: actorId,
          resource: `notebook:${notebookId}`,
          actions: ["read", "write"],
          effect: "allow",
          sectorIds: [],
          expiresAt: null,
          reason: "Responsável pelo registro da execução",
          approvedBy: actorId,
        });
      }
      const agentId =
        run.steps.map((step) => step.agentId).find((id) => id && state.agentIds.includes(id)) ??
        null;
      const output = run.steps
        .map(
          (step) =>
            `${step.nodeId} · ${step.status}\n${step.output ?? step.error ?? "Sem saída textual"}`,
        )
        .join("\n\n");
      const entry = {
        id: entryId,
        notebookId,
        authorId: actorId,
        agentId,
        createdAt: run.run.endedAt ?? new Date().toISOString(),
        objective: title.slice(0, 200),
        method: `${run.steps.length} etapas. Modo: ${mode === "local" ? "processamento determinístico local" : "simulação, sem execução de modelo externo"}.`,
        result: (output || `Estado: ${run.run.status}`).slice(0, 8000),
        limitations:
          mode === "simulation"
            ? "Execução simulada. As respostas não provam acesso a sistemas externos."
            : "Análise descritiva do dataset. Sem inferência causal; não calcula OEE, MTTR ou MTBF sem duração de parada.",
        importance: run.run.status === "failed" ? ("critical" as const) : ("important" as const),
        sourceRefs: [`routine:${run.run.workflowId}`, `run:${run.run.id}`],
        runId: run.run.id,
        supersedes: null,
      };
      notebook.entries.push(entry);
      const participatingAgents = [
        ...new Set(
          run.steps.flatMap((step) =>
            step.agentId && state.agentIds.includes(step.agentId) ? [step.agentId] : [],
          ),
        ),
      ];
      for (const participant of participatingAgents) {
        const scope = [...author.sectorIds].sort().join(",") || `private:${actorId}`;
        const agentBookId = `agent-book:${createHash("sha256").update(`${participant}:${scope}`).digest("hex").slice(0, 24)}`;
        let agentBook = state.notebooks.find((book) => book.id === agentBookId);
        if (!agentBook) {
          agentBook = {
            id: agentBookId,
            title: `Agente · ${participant}`.slice(0, 200),
            ownerKind: "agent",
            ownerId: participant,
            sectorIds: [...author.sectorIds],
            entries: [],
          };
          state.notebooks.push(agentBook);
          state.rules.push({
            id: `run-owner:${agentBookId}:${actorId}`,
            subjectKind: "person",
            subjectId: actorId,
            resource: `notebook:${agentBookId}`,
            actions: ["read", "write"],
            effect: "allow",
            sectorIds: [],
            expiresAt: null,
            reason: "Evidências do agente no contexto autorizado desta execução",
            approvedBy: actorId,
          });
        }
        const steps = run.steps.filter((step) => step.agentId === participant);
        agentBook.entries.push({
          ...entry,
          id: `agent-entry:${createHash("sha256").update(`${run.run.id}:${participant}`).digest("hex").slice(0, 24)}`,
          notebookId: agentBookId,
          agentId: participant,
          method: `${steps.length} etapa(s) atribuída(s) ao agente. ${entry.method}`,
          result: steps
            .map(
              (step) =>
                `${step.nodeId} · ${step.status}\n${step.output ?? step.error ?? "Sem saída textual"}`,
            )
            .join("\n\n")
            .slice(0, 8000),
          sourceRefs: [...entry.sourceRefs, `notebook:${notebookId}`, `entry:${entryId}`],
        });
      }
      for (const personId of reportingRecipients(state, actorId, notebook))
        state.deliveries.push({
          id: `${entryId}:${personId}`,
          entryId,
          notebookId,
          personId,
          createdAt: entry.createdAt,
          acknowledgedAt: null,
        });
      state.revision++;
      return state;
    },
  );
}
