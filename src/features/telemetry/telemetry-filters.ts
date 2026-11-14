import { createStore } from "zustand/vanilla";

export interface TelemetryFilters {
  machineId: number | null;
  period: "all" | "day";
  view: "fleet" | "alerts";
  page: number;
}

/** One canonical filter record per mounted workspace. No readings or persistence live here. */
export function createTelemetryFilters() {
  const initial: TelemetryFilters = { machineId: null, period: "all", view: "fleet", page: 0 };
  const store = createStore<TelemetryFilters>(() => initial);
  return {
    read: store.getState,
    subscribe: store.subscribe,
    change: (next: Omit<TelemetryFilters, "page"> & { page?: number }) => {
      const previous = store.getState();
      const changed =
        previous.machineId !== next.machineId || previous.period !== next.period || previous.view !== next.view;
      store.setState({ ...next, page: changed ? 0 : (next.page ?? 0) }, true);
    },
    reset: () => store.setState(initial, true),
  };
}
