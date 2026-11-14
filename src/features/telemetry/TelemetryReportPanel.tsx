import type { FleetReport } from "@johnbot/contracts/fleet";
import { Button } from "@johnbot/ui";
import { useText } from "@johnbot/ui/text";
import { createEffect, createMemo, createSignal, For, onSettled, Show } from "solid-js";
import { createScopeGuard } from "../../scope-lifetime";
import { TelemetryDailyChart } from "./TelemetryDailyChart";
import { useTelemetry } from "./telemetry-context";
import { exportNativeFleetCsv, loadNativeFleetReport } from "./telemetry-native-port";

/** Reports share the fleet filters; receipt history always belongs to the whole workspace. */
export function TelemetryReportPanel(props: { refreshToken: number }) {
  const { t, format } = useText();
  const domain = useTelemetry();
  const current = createScopeGuard();
  const [state, setState] = createSignal<{ phase: "loading" | "ready" | "failed"; report: FleetReport | null }>({
    phase: "loading",
    report: null,
  });
  const [exportState, setExportState] = createSignal<"idle" | "saving" | "saved" | "failed">("idle");
  let generation = 0;
  const machine = createMemo(() => domain.selection().machineId);
  const period = createMemo(() => domain.selection().period);
  createEffect(
    () => ({ machineId: machine(), period: period(), refresh: props.refreshToken }),
    (selected) => {
      const request = ++generation;
      setState({ phase: "loading", report: null });
      void loadNativeFleetReport({
        workspaceId: domain.workspaceId(),
        period: selected.period,
        ...(selected.machineId === null ? {} : { machineId: selected.machineId }),
      })
        .then((report) => {
          if (current() && request === generation) setState({ phase: "ready", report });
        })
        .catch(() => {
          if (current() && request === generation) setState({ phase: "failed", report: null });
        });
    },
  );
  onSettled(() => () => {
    generation++;
  });
  async function save(report: FleetReport) {
    if (exportState() === "saving") return;
    setExportState("saving");
    try {
      const machineId = machine();
      const saved = await exportNativeFleetCsv(
        {
          workspaceId: domain.workspaceId(),
          period: period(),
          ...(machineId === null ? {} : { machineId }),
        },
        report.revision,
        t("telemetry.report.saveTitle"),
      );
      if (current()) setExportState(saved ? "saved" : "idle");
    } catch {
      if (current()) setExportState("failed");
    }
  }
  return (
    <section className="telemetry-view" aria-label={t("telemetry.report.title")}>
      <h2>{t("telemetry.report.title")}</h2>
      <p>{t("telemetry.report.scope")}</p>
      <Show when={state().phase === "loading"}>
        <p role="status">{t("telemetry.loading")}</p>
      </Show>
      <Show when={state().phase === "failed"}>
        <p role="alert">{t("telemetry.report.failed")}</p>
      </Show>
      <Show when={state().report}>
        {(report) => (
          <>
            <TelemetryDailyChart daily={report().daily} />
            <details>
              <summary>{t("telemetry.report.daily")}</summary>
              <div className="telemetry-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">{t("telemetry.time")}</th>
                      <th scope="col">{t("telemetry.totalReadings")}</th>
                      <th scope="col">{t("telemetry.alerts")}</th>
                      <th scope="col">{t("telemetry.averageTemperature")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={report().daily}>
                      {(point) => (
                        <tr>
                          <td>{point.day}</td>
                          <td>{point.readings}</td>
                          <td>{point.alerts}</td>
                          <td>
                            {point.averageTemperature === null
                              ? t("telemetry.missing")
                              : format.number(point.averageTemperature)}
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </details>
            <details>
              <summary>{t("telemetry.report.latestMachines")}</summary>
              <div className="telemetry-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">{t("telemetry.machine")}</th>
                      <th scope="col">{t("telemetry.id")}</th>
                      <th scope="col">{t("telemetry.time")}</th>
                      <th scope="col">{t("telemetry.temperature")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={report().latestMachines}>
                      {(row) => (
                        <tr>
                          <td>{row.machineId}</td>
                          <td>{row.id}</td>
                          <td>{format.date(new Date(row.timestamp), { dateStyle: "short", timeStyle: "short" })}</td>
                          <td>{row.temperature === null ? t("telemetry.missing") : format.number(row.temperature)}</td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </details>
            <Button
              variant="outline"
              disabled={exportState() === "saving" || !report().recent.length}
              onClick={() => void save(report())}
            >
              {t("telemetry.report.export", { rows: report().recent.length })}
            </Button>
            <Show when={exportState() === "saved"}>
              <p role="status">{t("telemetry.report.exported")}</p>
            </Show>
            <Show when={exportState() === "failed"}>
              <p role="alert">{t("telemetry.report.exportFailed")}</p>
            </Show>
            <section aria-label={t("telemetry.report.sources")}>
              <h3>{t("telemetry.report.sources")}</h3>
              <p>{t("telemetry.report.sourcesScope")}</p>
              <Show when={!report().imports.length}>
                <p>{t("telemetry.report.noImports")}</p>
              </Show>
              <ul>
                <For each={report().imports}>
                  {(received) => (
                    <li>
                      <p>
                        {received.filename} ·{" "}
                        {format.date(new Date(received.createdAt), { dateStyle: "short", timeStyle: "short" })}
                      </p>
                      <p>
                        {t("telemetry.native.imported", { inserted: received.inserted, preserved: received.preserved })}
                      </p>
                    </li>
                  )}
                </For>
              </ul>
            </section>
          </>
        )}
      </Show>
    </section>
  );
}
