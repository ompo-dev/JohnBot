import { createStore } from "zustand/vanilla";
import { resetWorkspaceStore } from "./workspace-store";
export interface DataEntry {
  data: unknown;
  revision: number;
  pending: number;
  error: string | null;
  invalidated: boolean;
  fetchedAt?: number;
}
type Update = (current: unknown) => unknown;
interface Layer {
  id: number;
  update: Update;
}
interface Resource {
  base: unknown;
  confirmed: number;
  layers: Layer[];
}
const resources = new Map<string, Resource>();
let sequence = 0;
let epoch = 0;
export const dataStoreEpoch = () => epoch;
export const readConfirmed = (key: string) => resources.get(key)?.base;
export const dataStore = createStore<{ entries: Record<string, DataEntry> }>(() => ({
  entries: {},
}));
export const readEntry = (key: string) => dataStore.getState().entries[key];
export function seedQuery(key: string, data: unknown) {
  if (readEntry(key)?.data !== undefined) return;
  resources.set(key, { base: data, confirmed: ++sequence, layers: [] });
  dataStore.setState((state) => ({
    entries: {
      ...state.entries,
      [key]: {
        data,
        revision: state.entries[key]?.revision ?? 0,
        pending: 0,
        error: null,
        invalidated: false,
        fetchedAt: 0,
      },
    },
  }));
}
function publish(key: string, resource: Resource, error: string | null = null) {
  const data = resource.layers
    .filter((layer) => layer.id > resource.confirmed)
    .reduce((current, layer) => layer.update(current), resource.base);
  dataStore.setState((state) => ({
    entries: {
      ...state.entries,
      [key]: {
        data,
        pending: resource.layers.length,
        revision: (state.entries[key]?.revision ?? 0) + 1,
        error,
        invalidated: false,
        fetchedAt: Date.now(),
      },
    },
  }));
}
export function putQuery(key: string, data: unknown, observedRevision?: number): unknown {
  const previous = readEntry(key);
  if (
    previous &&
    (previous.pending > 0 ||
      (observedRevision !== undefined && previous.revision !== observedRevision))
  )
    return previous.data;
  const resource = { base: data, confirmed: ++sequence, layers: [] };
  resources.set(key, resource);
  publish(key, resource);
  return data;
}
export function beginOptimistic(key: string, update: Update) {
  const id = ++sequence;
  const resource = resources.get(key) ?? { base: readEntry(key)?.data, confirmed: 0, layers: [] };
  resources.set(key, resource);
  resource.layers.push({ id, update });
  publish(key, resource);
  let settled = false;
  return {
    commit(data?: unknown) {
      if (settled || resources.get(key) !== resource) return;
      settled = true;
      if (id > resource.confirmed) {
        resource.base = data === undefined ? update(resource.base) : data;
        resource.confirmed = id;
      }
      resource.layers = resource.layers.filter((layer) => layer.id !== id);
      publish(key, resource);
    },
    rollback(error: unknown) {
      if (settled || resources.get(key) !== resource) return;
      settled = true;
      resource.layers = resource.layers.filter((layer) => layer.id !== id);
      publish(key, resource, error instanceof Error ? error.message : "Request failed.");
    },
  };
}
export function invalidateQueries(prefix = "/api/") {
  dataStore.setState((state) => ({
    entries: Object.fromEntries(
      Object.entries(state.entries).map(([key, value]) => [
        key,
        key.startsWith(prefix)
          ? { ...value, revision: value.revision + 1, invalidated: true }
          : value,
      ]),
    ),
  }));
}
export function resetDataStore() {
  resetWorkspaceStore();
  resources.clear();
  sequence++;
  epoch++;
  dataStore.setState({ entries: {} });
}

export function queryFailed(key: string, observedRevision: number, error: unknown) {
  const current = readEntry(key);
  if (current && current.revision !== observedRevision) return;
  dataStore.setState((state) => ({
    entries: {
      ...state.entries,
      [key]: {
        data: current?.data,
        pending: current?.pending ?? 0,
        revision: (current?.revision ?? 0) + 1,
        invalidated: false,
        error: error instanceof Error ? error.message : "Request failed.",
      },
    },
  }));
}
