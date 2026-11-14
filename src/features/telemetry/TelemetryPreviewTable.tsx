import type { FleetPreview } from "@johnbot/contracts/fleet";
import { useText } from "@johnbot/ui/text";
import { For, Show } from "solid-js";

const ISSUE = {
  invalid_id: "telemetry.preview.invalidId",
  invalid_date: "telemetry.preview.invalidDate",
  column_count: "telemetry.preview.columnCount",
} as const;
export function TelemetryPreviewTable(props: { preview: FleetPreview; caption?: string }) {
  const { t, format } = useText();
  const sensor = (value: number | null) => (value === null ? t("telemetry.missing") : format.number(value));
  return (
    <>
      <Show when={props.preview.worksheet}>
        {(sheet) => <p>{t("telemetry.preview.worksheet", { worksheet: sheet() })}</p>}
      </Show>
      <p>{t("telemetry.preview.timezone")}</p>
      <div className="telemetry-table-wrap">
        <table>
          <caption>{props.caption ?? t("telemetry.preview.sample")}</caption>
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
            <For each={props.preview.sample}>
              {(row) => (
                <tr>
                  <td>{row.id}</td>
                  <td>{row.machineId}</td>
                  <td>
                    {format.date(new Date(row.timestamp), {
                      dateStyle: "short",
                      timeStyle: "short",
                      timeZone: "America/Sao_Paulo",
                    })}
                  </td>
                  <td>{sensor(row.temperature)}</td>
                  <td>{sensor(row.oilPressure)}</td>
                  <td>{sensor(row.rpm)}</td>
                  <td>{sensor(row.vibration)}</td>
                  <td>{sensor(row.consumption)}</td>
                  <td>{sensor(row.engineHours)}</td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
      <ul>
        <For each={props.preview.issues}>
          {(issue) => <li>{t("telemetry.preview.issue", { row: issue.row, reason: t(ISSUE[issue.code]) })}</li>}
        </For>
      </ul>
    </>
  );
}
