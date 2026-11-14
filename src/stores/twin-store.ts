import { createStore } from "zustand/vanilla";
import type { Notebook, TwinEdge, TwinNode } from "../john/john-data";

export interface TwinState {
  viewMode: "cargos" | "pessoa";
  data: { nodes: TwinNode[]; edges: TwinEdge[]; notebooks: Notebook[] };
  error: string | null;
  expandedIds: ReadonlySet<string>;
  selectedNodeId: string | null;
  entityOverrides: Record<string, { name?: string; title?: string; detail?: string }>;
}

export const twinStore = createStore<TwinState>(() => ({
  viewMode: "pessoa",
  data: { nodes: [], edges: [], notebooks: [] },
  error: null,
  expandedIds: new Set(),
  selectedNodeId: "p-marina",
  entityOverrides: {},
}));

/** Preserve the existing domain API while all views subscribe to the same Zustand state. */
export function twinField<K extends keyof TwinState>(
  key: K,
): [
  () => TwinState[K],
  (value: TwinState[K] | ((previous: TwinState[K]) => TwinState[K])) => void,
] {
  return [
    () => twinStore.getState()[key],
    (value) => {
      const next =
        typeof value === "function"
          ? (value as (previous: TwinState[K]) => TwinState[K])(twinStore.getState()[key])
          : value;
      twinStore.setState({ [key]: next } as Pick<TwinState, K>);
    },
  ];
}
