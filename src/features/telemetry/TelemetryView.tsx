import { Button, Field, Input, NativeSelect } from "@johnbot/ui";
import { useText } from "@johnbot/ui/text";
import { For, Show } from "solid-js";
import { useTelemetry } from "./telemetry-context";

export function TelemetryView() {
  const domain = useTelemetry();
  const { t, format } = useText();
  const sensor = (value: number | null) => (value === null ? t("telemetry.missing") : format.number(value));
  const failure = () => {
    const state = domain.readings();
    return state.phase === "failed"
      ? {
          "invalid-input": t("telemetry.error.invalid-input"),
          "unknown-workspace": t("telemetry.error.unknown-workspace"),
          unavailable: t("telemetry.error.unavailable"),
        }[state.code]
      : null;
  };
  return (
    <section className="telemetry-view" aria-label={t("telemetry.fleet")}>
      <Show when={domain.summary()}>
        {(summary) => (
          <section aria-label={t("telemetry.overview")}>
            <h2>{t("telemetry.overview")}</h2>
            <p>{t("telemetry.overviewScope")}</p>
            <dl className="telemetry-metrics">
              <div>
                <dt>{t("telemetry.totalReadings")}</dt>
                <dd>{format.number(summary().readings)}</dd>
              </div>
              <div>
                <dt>{t("telemetry.totalMachines")}</dt>
                <dd>{format.number(summary().machines)}</dd>
              </div>
              <div>
                <dt>{t("telemetry.alerts")}</dt>
                <dd>{format.number(summary().alerts)}</dd>
              </div>
              <div>
                <dt>{t("telemetry.averageTemperature")}</dt>
                <dd>{sensor(summary().averageTemperature)}</dd>
              </div>
              <div>
                <dt>{t("telemetry.averageVibration")}</dt>
                <dd>{sensor(summary().averageVibration)}</dd>
              </div>
              <div>
                <dt>{t("telemetry.latestCollection")}</dt>
                <dd>
                  <Show when={summary().latestAt} fallback={t("telemetry.missing")}>
                    {(value) => format.date(new Date(value()), { dateStyle: "short", timeStyle: "short" })}
                  </Show>
                </dd>
              </div>
            </dl>
          </section>
        )}
      </Show>
      <div className="telemetry-filters">
        <Field label={t("telemetry.machine")}>
          <Input
            type="number"
            min="1"
            step="1"
            value={domain.selection().machineId === null ? "" : String(domain.selection().machineId)}
            onInput={(event) => {
              const value = event.currentTarget.value;
              const id = value ? Number(value) : null;
              if (id === null || (Number.isSafeInteger(id) && id > 0))
                domain.filters.change({ ...domain.filters.read(), machineId: id });
            }}
          />
        </Field>
        <Field label={t("telemetry.period")}>
          <NativeSelect
            value={domain.selection().period}
            onChange={(event) => {
              const period = event.currentTarget.value;
              if (period === "all" || period === "day") domain.filters.change({ ...domain.filters.read(), period });
            }}
          >
            <option value="all">{t("telemetry.all")}</option>
            <option value="day">{t("telemetry.day")}</option>
          </NativeSelect>
        </Field>
        <Button variant="outline" onClick={() => domain.filters.reset()}>
          {t("telemetry.reset")}
        </Button>
        <Button variant="outline" onClick={() => void domain.refresh()}>
          {t("telemetry.reload")}
        </Button>
      </div>
      <div className="telemetry-actions">
        <Button
          variant={domain.selection().view === "fleet" ? "default" : "ghost"}
          aria-pressed={domain.selection().view === "fleet" ? "true" : "false"}
          onClick={() => domain.filters.change({ ...domain.filters.read(), view: "fleet" })}
        >
          {t("telemetry.fleet")}
        </Button>
        <Button
          variant={domain.selection().view === "alerts" ? "default" : "ghost"}
          aria-pressed={domain.selection().view === "alerts" ? "true" : "false"}
          onClick={() => domain.filters.change({ ...domain.filters.read(), view: "alerts" })}
        >
          {t("telemetry.alerts")}
        </Button>
      </div>
      <Show when={domain.readings().phase === "loading"}>
        <p role="status">{t("telemetry.loading")}</p>
      </Show>
      <Show when={failure()}>{(message) => <p role="alert">{message()}</p>}</Show>
      <Show when={domain.snapshot()}>
        {(snapshot) => (
          <>
            <div className="telemetry-actions" aria-live="polite">
              <span>{t("telemetry.shown", { count: domain.visible().length })}</span>
              <span>{t("telemetry.revision", { revision: snapshot().revision })}</span>
            </div>
            <Show when={domain.visible().length} fallback={<p>{t("telemetry.empty")}</p>}>
              <div className="telemetry-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">{t("telemetry.id")}</th>
                      <th scope="col">{t("telemetry.machine")}</th>
                      <th scope="col">{t("telemetry.time")}</th>
                      <th scope="col">{t("telemetry.temperature")}</th>
                      <th scope="col">{t("telemetry.sensor.oilPressure")}</th>
                      <th scope="col">{t("telemetry.sensor.rpm")}</th>
                      <th scope="col">{t("telemetry.vibration")}</th>
                      <th scope="col">{t("telemetry.sensor.consumption")}</th>
                      <th scope="col">{t("telemetry.sensor.engineHours")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={domain.visible()}>
                      {(reading) => (
                        <tr>
                          <td>{reading.id}</td>
                          <td>{reading.machineId}</td>
                          <td>
                            {format.date(new Date(reading.recordedAt), { dateStyle: "short", timeStyle: "short" })}
                          </td>
                          <td>{sensor(reading.temperature)}</td>
                          <td>{sensor(reading.oilPressure)}</td>
                          <td>{sensor(reading.rpm)}</td>
                          <td>{sensor(reading.vibration)}</td>
                          <td>{sensor(reading.consumption)}</td>
                          <td>{sensor(reading.engineHours)}</td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </Show>
            <Show when={domain.paginated()}>
              <nav className="telemetry-actions" aria-label={t("telemetry.pagination")}>
                <Button
                  variant="outline"
                  disabled={domain.selection().page === 0}
                  onClick={() => domain.filters.change({ ...domain.filters.read(), page: domain.selection().page - 1 })}
                >
                  {t("telemetry.previousPage")}
                </Button>
                <span>
                  {t("telemetry.page", {
                    page: domain.selection().page + 1,
                    pages: Math.max(1, Math.ceil(snapshot().total / domain.pageSize)),
                    total: snapshot().total,
                  })}
                </span>
                <Button
                  variant="outline"
                  disabled={(domain.selection().page + 1) * domain.pageSize >= snapshot().total}
                  onClick={() => domain.filters.change({ ...domain.filters.read(), page: domain.selection().page + 1 })}
                >
                  {t("telemetry.nextPage")}
                </Button>
              </nav>
            </Show>
          </>
        )}
      </Show>
    </section>
  );
}
