import type { AccessRule, Dashboard, Notebook, Operations, Person } from "../contracts/operations";
import { validateDashboardProgram } from "../contracts/dashboard-library";
import { dashboardDemoProgram } from "./dashboard-demo";

type Action = AccessRule["actions"][number];
/** This evaluates the selected simulation persona, never a production authentication identity. */
export function canAccess(
  state: Pick<Operations, "people" | "rules">,
  personId: string,
  action: Action,
  resource: string,
  sectorIds: readonly string[] = [],
  now = Date.now(),
): boolean {
  const person = state.people.find((entry) => entry.id === personId);
  if (!person) return false;
  const matches = state.rules.filter((rule) => {
    if (rule.expiresAt && Date.parse(rule.expiresAt) <= now) return false;
    if (!rule.actions.includes(action)) return false;
    const subject =
      rule.subjectKind === "person"
        ? person.id === rule.subjectId
        : (rule.subjectKind === "role" ? person.roleIds : person.sectorIds).includes(
            rule.subjectId,
          );
    const scope =
      rule.resource === "*" ||
      rule.resource === resource ||
      (rule.resource.endsWith(":*") && resource.startsWith(rule.resource.slice(0, -1)));
    return (
      subject &&
      scope &&
      (!rule.sectorIds.length || sectorIds.some((id) => rule.sectorIds.includes(id)))
    );
  });
  return (
    !matches.some((rule) => rule.effect === "deny") &&
    matches.some((rule) => rule.effect === "allow")
  );
}

export function canReadNotebook(state: Operations, personId: string, notebook: Notebook): boolean {
  return canAccess(state, personId, "read", `notebook:${notebook.id}`, notebook.sectorIds);
}

/** Walk explicit reporting links. Cycles and multiple reporting lines cannot duplicate delivery. */
export function reportingRecipients(
  state: Operations,
  authorId: string,
  notebook: Notebook,
): string[] {
  const visited = new Set([authorId]);
  const queue = [...(state.people.find((person) => person.id === authorId)?.reportsTo ?? [])];
  const recipients: string[] = [];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i]!;
    if (visited.has(id)) continue;
    visited.add(id);
    const person = state.people.find((entry) => entry.id === id);
    if (!person) continue;
    if (canReadNotebook(state, id, notebook)) recipients.push(id);
    queue.push(...person.reportsTo);
  }
  return recipients;
}

/** A transparent local template until a configured agent submits a validated dashboard specification. */
export function proposeDashboard(
  person: Person,
  objective: string,
  now = new Date().toISOString(),
): Dashboard {
  const query = objective.toLocaleLowerCase("pt-BR");
  const sources = new Set<Dashboard["widgets"][number]["source"]>();
  if (/parad|máquin|maquin|manuten|produção|producao|oee/u.test(query)) sources.add("downtime");
  if (/qualidade|limp|padron|bronze|prata|ouro|csv/u.test(query)) sources.add("quality");
  if (/rotina|execu|automa/u.test(query)) sources.add("routines");
  if (/notebook|resumo|evidência|evidencia|registro/u.test(query)) sources.add("notebooks");
  if (/pend|aprova|decis|tarefa|ação|acoes|ações/u.test(query)) sources.add("actions");
  if (!sources.size) {
    sources.add("actions");
    sources.add("notebooks");
  }
  const titles = {
    downtime: "Paradas por máquina",
    quality: "Qualidade dos dados",
    routines: "Execuções de rotinas",
    notebooks: "Evidências e resumos",
    actions: "Minhas pendências",
  };
  let program: string | undefined;
  try {
    const code = dashboardDemoProgram();
    validateDashboardProgram(code);
    program = code;
  } catch {
    program = undefined;
  }
  return {
    id: `dashboard:${person.id}`,
    personId: person.id,
    title: `Dashboard de ${person.name}`,
    objective,
    updatedAt: now,
    origin: "template",
    program,
    messages: [],
    widgets: [...sources].map((source, index) => ({
      id: `widget:${source}:${index}`,
      source,
      title: titles[source],
      kind: source === "downtime" ? "chart" : source === "quality" ? "metric" : "table",
      width: "half",
    })),
  };
}

/** Revocation is applied before a projection enters any HTTP/client cache. */
export function operationsProjection(state: Operations): Operations {
  const viewer = state.viewerId;
  const admin = canAccess(state, viewer, "admin", "organization:settings");
  const notebooks = state.notebooks.filter((notebook) => canReadNotebook(state, viewer, notebook));
  const notebookIds = new Set(notebooks.map((notebook) => notebook.id));
  return {
    ...state,
    rules: admin
      ? state.rules
      : state.rules.filter((rule) => {
          const person = state.people.find((person) => person.id === viewer)!;
          return rule.subjectKind === "person"
            ? rule.subjectId === viewer
            : (rule.subjectKind === "sector" ? person.sectorIds : person.roleIds).includes(
                rule.subjectId,
              );
        }),
    dashboards: state.dashboards.filter((dashboard) => dashboard.personId === viewer),
    notebooks,
    audit: admin ? state.audit : state.audit.filter((event) => event.actorId === viewer),
    deliveries: state.deliveries.filter(
      (delivery) => delivery.personId === viewer && notebookIds.has(delivery.notebookId),
    ),
    connectors: state.connectors.filter((connector) =>
      canAccess(state, viewer, "read", `connector:${connector.id}`),
    ),
    actions: state.actions.filter(
      (action) =>
        action.ownerId === viewer ||
        canAccess(state, viewer, "read", `action:${action.id}`, action.sectorIds),
    ),
    dataset: canAccess(state, viewer, "read", "table:machine-downtime")
      ? state.dataset
      : {
          source: "Sem permissão para esta fonte",
          sha256: "",
          records: 0,
          rejected: 0,
          duplicates: 0,
          failures: 0,
          machines: [],
        },
  };
}
