import { operationsChangeSchema, operationsSchema } from "../../../contracts/operations";

export function optimisticOperations(current: unknown, raw: unknown): unknown {
  const parsed = operationsSchema.safeParse(current),
    input = operationsChangeSchema.safeParse(raw);
  if (!parsed.success || !input.success) return current;
  const state = structuredClone(parsed.data),
    change = input.data.change;
  if (state.revision !== input.data.expectedRevision) return current;
  if (change.type === "dashboard" && change.dashboard.personId === state.viewerId)
    state.dashboards = [
      ...state.dashboards.filter((dashboard) => dashboard.id !== change.dashboard.id),
      change.dashboard,
    ];
  if (change.type === "dashboard-delete")
    state.dashboards = state.dashboards.filter((dashboard) => dashboard.id !== change.dashboardId);
  if (change.type === "dashboard-rename")
    state.dashboards = state.dashboards.map((dashboard) =>
      dashboard.id === change.dashboardId ? { ...dashboard, title: change.title } : dashboard,
    );
  if (change.type === "dashboard-duplicate") {
    const source = state.dashboards.find((dashboard) => dashboard.id === change.dashboardId);
    if (source)
      state.dashboards.push({
        ...source,
        id: change.newId,
        personId: state.viewerId,
        title: `${source.title.slice(0, 190)} (cópia)`,
      });
  }
  if (change.type === "complete-action")
    state.actions = state.actions.map((action) =>
      action.id === change.actionId ? { ...action, status: "done" } : action,
    );
  if (change.type === "acknowledge")
    state.deliveries = state.deliveries.map((delivery) =>
      delivery.id === change.deliveryId
        ? { ...delivery, acknowledgedAt: new Date().toISOString() }
        : delivery,
    );
  if (change.type === "connector-installation")
    state.connectors = state.connectors.map((connector) =>
      connector.id === change.connectorId
        ? { ...connector, installed: change.installed }
        : connector,
    );
  return state;
}
