import type { FleetSummary } from "@johnbot/contracts/fleet";
import type { TelemetryErrorCode, TelemetryReadingsOutcome } from "@johnbot/contracts/ipc";
import { createEffect, createMemo, createSignal, onSettled } from "solid-js";
import { createScopeGuard } from "../../scope-lifetime";
import { createSimpleContext } from "../../simple-context";
import { createTelemetryFilters } from "./telemetry-filters";
import { type TelemetryPort, telemetryPort } from "./telemetry-port";
import { telemetryReading } from "./telemetry-reading";

type Snapshot = Extract<TelemetryReadingsOutcome, { ok: true }>;
type ReadingState =
  | { phase: "loading" }
  | { phase: "ready"; snapshot: Snapshot; summary: FleetSummary | null }
  | { phase: "failed"; code: TelemetryErrorCode };

export interface TelemetryContextProps {
  workspaceId: string;
  port?: TelemetryPort;
}

export const { provider: TelemetryProvider, use: useTelemetry } = createSimpleContext({
  name: "Telemetry",
  init: (props: TelemetryContextProps) => {
    const filters = createTelemetryFilters();
    const [selection, setSelection] = createSignal(filters.read());
    const [readings, setReadings] = createSignal<ReadingState>({ phase: "loading" });
    const isCurrent = createScopeGuard();
    let requestGeneration = 0;
    const pageSize = 50;
    const paginated = () => Boolean((props.port ?? telemetryPort()).explorer);
    onSettled(() => {
      const unsubscribe = filters.subscribe((state) => setSelection(state));
      setSelection(filters.read());
      return unsubscribe;
    });
    async function refresh(): Promise<void> {
      const generation = ++requestGeneration;
      setReadings({ phase: "loading" });
      const selected = filters.read();
      const machineId = selected.machineId;
      try {
        const port = props.port ?? telemetryPort();
        let result: TelemetryReadingsOutcome;
        let summary: FleetSummary | null = null;
        if (port.explorer) {
          const queried = await port.explorer.query({
            workspaceId: props.workspaceId,
            ...(machineId === null ? {} : { machineId }),
            period: selected.period,
            view: selected.view,
            offset: selected.page * pageSize,
            limit: pageSize,
          });
          if (!isCurrent() || generation !== requestGeneration) return;
          if (!queried.ok) {
            setReadings({ phase: "failed", code: queried.code });
            return;
          }
          const { page } = queried.value;
          if (selected.page > 0 && selected.page * pageSize >= page.total) {
            filters.change({ ...selected, page: Math.max(0, Math.ceil(page.total / pageSize) - 1) });
            return;
          }
          summary = queried.value.summary;
          result = {
            ok: true,
            operationId: `native-query-${generation}`,
            workspaceId: page.workspaceId,
            revision: page.revision,
            total: page.total,
            readings: page.readings.map(telemetryReading),
          };
        } else
          result = await port.telemetry.listReadings({
            workspaceId: props.workspaceId,
            ...(machineId === null ? {} : { machineId }),
            limit: 200,
          });
        if (!isCurrent() || generation !== requestGeneration) return;
        setReadings(
          result.ok ? { phase: "ready", snapshot: result, summary } : { phase: "failed", code: result.error.code },
        );
      } catch {
        if (isCurrent() && generation === requestGeneration) setReadings({ phase: "failed", code: "unavailable" });
      }
    }
    onSettled(() => {
      void refresh();
      return () => {
        requestGeneration += 1;
      };
    });
    const queryKey = createMemo(() =>
      JSON.stringify({
        machine: selection().machineId,
        ...(paginated() ? { period: selection().period, view: selection().view, page: selection().page } : {}),
      }),
    );
    createEffect(
      () => queryKey(),
      () => {
        void refresh();
      },
      { defer: true },
    );
    const snapshot = () => {
      const state = readings();
      return state.phase === "ready" ? state.snapshot : null;
    };
    const visible = createMemo(() => {
      const rows = snapshot()?.readings ?? [];
      if (paginated()) return rows;
      const latest = Math.max(...rows.map((row) => Date.parse(row.recordedAt)));
      return rows.filter(
        (row) =>
          (selection().view === "fleet" ||
            (row.temperature ?? -Infinity) > 100 ||
            (row.vibration ?? -Infinity) > 4.5) &&
          (selection().period === "all" || Date.parse(row.recordedAt) >= latest - 86_400_000),
      );
    });
    const summary = () => {
      const state = readings();
      return state.phase === "ready" ? state.summary : null;
    };
    return {
      workspaceId: () => props.workspaceId,
      selection,
      readings,
      snapshot,
      summary,
      paginated,
      pageSize,
      visible,
      filters,
      refresh,
    };
  },
});
