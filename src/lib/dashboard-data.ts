import type { Operations } from "../contracts/operations";
import type { ClientAgentSummary, WorkflowSummary } from "../contracts/ipc";

/** Every query reads the authorized projection already delivered to this workspace. */
export function dashboardSourceData(
  source: string,
  state: Operations,
  routines: WorkflowSummary[],
  agents: ClientAgentSummary[],
): unknown[] {
  switch (source) {
    case "person":
      return state.people.filter((person) => person.id === state.viewerId);
    case "machines":
      return state.dataset.machines;
    case "quality":
      return [state.dataset];
    case "actions":
      return state.actions;
    case "notebooks":
      return state.notebooks;
    case "routines":
      return routines;
    case "agents":
      return agents;
    default:
      throw new Error("Fonte de dados não permitida no dashboard.");
  }
}

export const DASHBOARD_DATA_SHAPES = {
  person: "array: id, name, goals[], sectorIds[], roleIds[]; only the current person",
  machines: "array: group (machine name), records, failures, failure_rate (0..1)",
  quality: "array with one record: source, records, rejected, duplicates, failures",
  actions: "array: id, title, ownerId, status (open/done), dueAt",
  notebooks:
    "array: id, title, ownerKind, ownerId, entries[] (objective, result, importance, createdAt)",
  routines: "array: id, title, steps, updatedAt, lastRun {status, at} or null",
  agents: "array: id, name, title, description, provider, model",
};
