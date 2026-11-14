import { createStore } from "zustand/vanilla";

/** Shared renderer state is scoped by workspace; server data remains authoritative. */
export const workspaceStore = createStore<{ values: Record<string, unknown> }>(() => ({ values: {} }));
const defaults = new Map<string, unknown>();
export const workspaceKey = (workspace: string, field: string) => JSON.stringify([workspace, field]);
export function readWorkspaceValue<T>(key: string, initial: T): T {
  if (!defaults.has(key)) defaults.set(key, initial);
  const values = workspaceStore.getState().values;
  return (Object.hasOwn(values, key) ? values[key] : defaults.get(key)) as T;
}
export function updateWorkspaceValue<T>(key: string, initial: T, update: T | ((previous: T) => T)) {
  const previous = readWorkspaceValue(key, initial);
  const next = typeof update === "function" ? (update as (previous: T) => T)(previous) : update;
  if (Object.is(previous, next)) return;
  workspaceStore.setState((state) => ({ values: { ...state.values, [key]: next } }));
}
export function resetWorkspaceStore() {
  defaults.clear();
  workspaceStore.setState({ values: {} });
}
