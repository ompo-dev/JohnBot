import type { FleetDailyPoint } from "@johnbot/contracts/fleet";
import { Area, AreaChart, CartesianGrid, ChartContainer, XAxis, YAxis } from "@johnbot/ui/chart";
import { useText } from "@johnbot/ui/text";
import { createMemo, Show } from "solid-js";

export function TelemetryDailyChart(props: { daily: readonly FleetDailyPoint[] }) {
  const { t, format } = useText();
  const chart = createMemo(() => props.daily.map((row) => ({ ...row, time: Date.parse(`${row.day}T00:00:00Z`) })));
  return (
    <Show when={chart().length > 0}>
      <ChartContainer label={t("telemetry.report.temperatureChart")}>
        <AreaChart data={chart()} accessibilityLayer role="img" aria-label={t("telemetry.report.temperatureChart")}>
          <CartesianGrid vertical={false} stroke="var(--johnbot-border-strong)" />
          <XAxis
            dataKey="time"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(value) =>
              format.date(new Date(Number(value)), { month: "short", day: "numeric", timeZone: "UTC" })
            }
          />
          <YAxis tickFormatter={(value) => format.number(Number(value))} />
          <Area
            dataKey="averageTemperature"
            type="linear"
            stroke="var(--johnbot-text-primary)"
            fill="var(--johnbot-bg-elevated)"
            connectNulls={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ChartContainer>
    </Show>
  );
}
