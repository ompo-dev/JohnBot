// Keep chart behavior in the shared UI layer; johnBot supplies its own theme and layout.
import type { ComponentProps, JSX } from "@solidjs/web";
import { For, Show } from "solid-js";
import { ResponsiveContainer, Tooltip, Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { useText } from "../text";

export type TooltipContentProps = any;

export { Area, AreaChart, CartesianGrid, XAxis, YAxis };

export function ChartContainer(props: {
  children: any;
  label: string;
}) {
  return (
    <section className="ui-chart" aria-label={props.label}>
      <ResponsiveContainer width="100%" height={300}>{props.children}</ResponsiveContainer>
    </section>
  );
}
export const ChartTooltip = Tooltip;
/** `series` names each payload entry; `total` adds the sum below. Both optional. */
export function ChartTooltipContent(
  props: Partial<TooltipContentProps> & {
    formatValue: (value: number) => string;
    series?: ((key: string) => { name: string; mark?: any }) | undefined;
    total?: boolean;
  },
) {
  const { t } = useText();
  const rows = () =>
    (props.payload ?? [])
      .filter((item: any) => typeof item.value === "number")
      .map((item: any) => ({ key: String(item.dataKey ?? item.name ?? ""), value: Number(item.value) }))
      .sort((a: any, b: any) => b.value - a.value);
  return (
    <Show when={props.active && props.payload?.length}>
      <div className="ui-chart-tooltip" role="tooltip">
        <strong>{String(props.label ?? "")}</strong>
        <For each={rows()}>
          {(row: any) => (
            <Show when={props.series} fallback={<div>{props.formatValue(row.value)}</div>}>
              {(series: any) => (
                <div className="ui-chart-tooltip-row">
                  <span className="ui-chart-tooltip-mark">{series()(row.key).mark}</span>
                  <span>{series()(row.key).name}</span>
                  <span className="ui-chart-tooltip-value">{props.formatValue(row.value)}</span>
                </div>
              )}
            </Show>
          )}
        </For>
        <Show when={props.total && rows().length > 1}>
          <div className="ui-chart-tooltip-row ui-chart-tooltip-total">
            <span className="ui-chart-tooltip-mark" />
            <span>{t("app.chart.total")}</span>
            <span className="ui-chart-tooltip-value">
              {props.formatValue(rows().reduce((sum: number, row: any) => sum + row.value, 0))}
            </span>
          </div>
        </Show>
      </div>
    </Show>
  );
}
