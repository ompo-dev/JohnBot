import { useRef } from "react";
import {
  analyticsRange,
  type ClientAgentSummary,
  type HostAnalytics,
  type HostAnalyticsInput,
  WORKFLOWS_USAGE_ID,
} from "@johnbot/contracts/ipc";
import type { AppTextKey } from "@johnbot/i18n";
import {
  ArrowLeft,
  Button,
  ErrorReference,
  IconButton,
  RefreshCw,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@johnbot/ui";
import { AgentUsageReport } from "@johnbot/features/usage/AgentUsageReport";
import {
  type UsageAgentLabel,
  usageMetricLabels,
  usageMetrics,
  usagePeriodDays,
  usagePeriodLabels,
  usagePeriods,
} from "@johnbot/features/usage/usage-format";
import { useText } from "@johnbot/ui/text";
import { errorReference } from "@johnbot/user-errors";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { createEffect, createMemo, createStore, onSettled, Show } from "solid-js";
import { desktopAnalytics } from "../../analytics";
import { useUrlSignal } from "../../lib/url-state";
import { type UsagePort, usagePort } from "./usage-port";

interface AgentUsagePanelProps {
  /** The agent the usage starts on; with none, the usage of all agents. */
  agentId?: string | undefined;
  agentName?: string;
  serverId: string;
  hostName: string;
  onBack: () => void;
  /** The web client reads the host through its own connection. The default is the desktop bridge. */
  port?: UsagePort;
}
interface UsageState {
  range: HostAnalyticsInput;
  result: HostAnalytics | null;
  phase: "loading" | "ready" | "unsupported" | "error";
  errorReference: string | null;
  agents: ClientAgentSummary[];
  serverId: string;
}

/** The report range for a period. With no agent, the report is for all agents. */
function usageRange(days: number, agentId: string | undefined): HostAnalyticsInput {
  // `analyticsRange` needs an agent id; the panel keeps only the dates it computes.
  const { startDate, endDate, timeZone } = analyticsRange("", days);
  return agentId === undefined ? { startDate, endDate, timeZone } : { startDate, endDate, timeZone, agentId };
}

export function AgentUsagePanel(props: AgentUsagePanelProps) {
  const { t } = useText();
  const port = () => props.port ?? usagePort();
  const [periodQuery, setPeriod] = useQueryState(
    "usageRange",
    parseAsStringLiteral(usagePeriods).withDefault("30d"),
  );
  const [metricQuery, setMetric] = useQueryState(
    "usageMetric",
    parseAsStringLiteral(usageMetrics).withDefault("cost"),
  );
  const period = createMemo(() => periodQuery);
  const metric = createMemo(() => metricQuery);
  const [queryAgent, setQueryAgent] = useUrlSignal("usageAgent");
  const [state, setState] = createStore<UsageState>({
    range: usageRange(usagePeriodDays[period()], props.agentId),
    agents: [],
    result: null,
    phase: "loading",
    errorReference: null,
    serverId: props.serverId,
  });
  let generation = 0;
  /**
   * A refresh nobody asked for keeps the report on screen. Clearing `result` unmounts
   * `AgentUsageReport`, which returns on the next response with its breakdown back to
   * Agent and scrolled to the total - and a turn completes while the report is open
   * often enough that this is the common case, not the rare one. Only a request the
   * user made may blank the body: the first load, a filter change, Refresh.
   */
  async function load(range = state.range, background = false): Promise<void> {
    const request = ++generation;
    const serverId = props.serverId;
    const agentId = range.agentId;
    if (!background)
      setState((draft) => {
        draft.phase = "loading";
        draft.result = null;
      });
    try {
      const [result, agents] = await Promise.all([
        // Electron cannot clone the Solid store proxy across the context bridge.
        port().agent.getHostAnalytics({ ...range }, serverId),
        port().agent.listAgents(serverId),
      ]);
      if (request === generation && props.serverId === serverId && state.range.agentId === agentId)
        setState((draft) => {
          draft.agents = agents;
          draft.serverId = serverId;
          draft.result = result;
          draft.phase = result ? "ready" : "unsupported";
        });
    } catch (error) {
      // A background refresh that fails leaves the last good report where it is rather
      // than replacing it with an error the user cannot act on; the next turn retries.
      // Only while a report is on screen, though: a background request that overtakes the
      // first load takes the generation with it, so the foreground response is discarded
      // too, and a silent failure would leave the panel on Loading with no Retry.
      if (background && state.result) return;
      if (request === generation && props.serverId === serverId && state.range.agentId === agentId)
        setState((draft) => {
          draft.result = null;
          draft.phase = "error";
          draft.errorReference = errorReference(error);
        });
    }
  }
  createEffect(
    () => [queryAgent() ?? props.agentId, props.serverId],
    ([agentId]) => {
      setState((draft) => {
        if (agentId === undefined) delete draft.range.agentId;
        else draft.range.agentId = agentId;
        draft.agents = [];
      });
    },
  );
  // The period in the URL is the range's source, so Back, forward and reload keep the report window.
  createEffect(
    () => period(),
    (next) => {
      setState((draft) => {
        const range = usageRange(usagePeriodDays[next], draft.range.agentId);
        if (
          range.startDate === draft.range.startDate &&
          range.endDate === draft.range.endDate &&
          range.timeZone === draft.range.timeZone
        )
          return;
        draft.range = range;
      });
    },
  );
  // One view for each report the user asks for: the first one, and each filter or period change.
  createEffect(
    () => [state.range.agentId, props.serverId, period()] as const,
    ([agentId, , range]) => {
      desktopAnalytics.track("usage_viewed", {
        scope: agentId ? "agent" : "server",
        range,
        filtered: agentId !== props.agentId,
      });
    },
  );
  createEffect(
    () => [state.range.agentId, props.serverId, state.range.startDate, state.range.endDate],
    () => {
      void load();
    },
  );
  onSettled(() => {
    const unsubscribe = port().agent.onScopedEvent(({ serverId, event }) => {
      if (
        serverId === props.serverId &&
        event.type === "turn-completed" &&
        (!state.range.agentId || event.agentId === state.range.agentId)
      )
        void load(state.range, true);
    });
    const reconnect = port().servers.onEvent((servers) => {
      if (servers.some((server) => server.id === props.serverId && server.state === "online"))
        void load(state.range, true);
    });
    return () => {
      generation++;
      unsubscribe();
      reconnect();
    };
  });
  // The filter and the per-agent table both name an agent by id, and props.agentName only
  // names the panel's own agent, so it must not label another agent's row.
  const agentLabel = (id: string): UsageAgentLabel => {
    if (id === WORKFLOWS_USAGE_ID) return { name: t("usage.panel.workflows"), provider: "" };
    const agent = state.agents.find((candidate) => candidate.id === id);
    return {
      name: agent?.name ?? (id === props.agentId ? props.agentName : undefined) ?? id,
      provider: agent?.provider ?? "",
    };
  };
  const reportBody = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  onSettled(() => heading.current?.focus());
  return (
    <section className="agent-usage" aria-label={t("usage.panel.label")}>
      <header className="agent-usage-header">
        <div className="agent-usage-identity">
          <IconButton variant="ghost" label={t("common.back")} onClick={props.onBack}>
            <ArrowLeft />
          </IconButton>
          <h2 ref={heading} tabIndex={-1}>
            {t("usage.panel.title")} <span aria-hidden="true">/</span> <span>{props.hostName}</span>
          </h2>
        </div>
        <div className="agent-usage-controls">
          <Select
            queryKey="usage-agent"
            options={[
              "all",
              ...[
                ...new Set([
                  ...state.agents.map((agent) => agent.id),
                  ...(state.result?.agents.some((agent) => agent.agentId === WORKFLOWS_USAGE_ID)
                    ? [WORKFLOWS_USAGE_ID]
                    : []),
                  ...(state.range.agentId ? [state.range.agentId] : []),
                ]),
              ].map((id) => `agent:${id}`),
            ]}
            value={state.range.agentId ? `agent:${state.range.agentId}` : "all"}
            onChange={(value) => {
              if (value) {
                setQueryAgent(value === "all" ? null : value.slice(6));
                setState((draft) => {
                  if (value === "all") delete draft.range.agentId;
                  else draft.range.agentId = value.slice(6);
                });
              }
            }}
            itemComponent={(itemProps) => (
              <SelectItem item={itemProps.item}>
                {itemProps.item.rawValue === "all"
                  ? t("usage.panel.allAgents")
                  : agentLabel(itemProps.item.rawValue.slice(6)).name}
              </SelectItem>
            )}
          >
            <SelectTrigger aria-label={t("usage.panel.agents")} size="sm">
              <SelectValue<string>>
                {(selection) =>
                  selection.selectedOption() === "all"
                    ? t("usage.panel.allAgents")
                    : agentLabel(selection.selectedOption().slice(6)).name
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent />
          </Select>
          <UsageSelect
            queryKey="usage-metric"
            label={t("usage.panel.metric")}
            options={usageMetrics}
            optionLabels={usageMetricLabels}
            value={metric()}
            onChange={(value) => void setMetric(value)}
          />
          <UsageSelect
            label={t("usage.panel.period")}
            queryKey="usage-period"
            options={usagePeriods}
            optionLabels={usagePeriodLabels}
            value={period()}
            onChange={(value) => void setPeriod(value)}
          />
          <IconButton
            variant="outline"
            label={t("usage.panel.refresh")}
            disabled={state.phase === "loading"}
            onClick={() => void load()}
          >
            <RefreshCw />
          </IconButton>
        </div>
      </header>
      <div ref={reportBody} className="agent-usage-body">
        <Show when={state.phase === "loading"}>
          <div className="agent-usage-loading" role="status">
            <span>{t("usage.panel.loading")}</span>
            <div className="agent-usage-placeholder" />
          </div>
        </Show>
        <Show when={state.phase === "unsupported"}>
          <p className="agent-usage-notice" role="status">
            {t("usage.panel.unsupported")}
          </p>
        </Show>
        <Show when={state.phase === "error"}>
          <div className="agent-usage-notice">
            <p role="alert">
              {t("usage.panel.loadFailed")}
              <ErrorReference reference={state.errorReference} />
            </p>
            <Button variant="secondary" onClick={() => void load()}>
              {t("common.retry")}
            </Button>
          </div>
        </Show>
        <Show
          when={
            state.serverId === props.serverId &&
            state.result &&
            state.result.agentId === state.range.agentId &&
            state.result.startDate === state.range.startDate &&
            state.result.endDate === state.range.endDate &&
            state.result
          }
        >
          {(result) => (
            <AgentUsageReport
              result={result()}
              metric={metric()}
              agentLabel={agentLabel}
              onReady={() => {
                // Start each loaded report at its total, after the tabs settle their initial selection.
                if (reportBody.current) reportBody.current.scrollTop = 0;
              }}
            />
          )}
        </Show>
      </div>
    </section>
  );
}

// The header filters share one chip dropdown so the metric and period read as the
// same kind of control as the agent picker beside them.
function UsageSelect<Value extends string>(props: {
  queryKey: string;
  label: string;
  options: readonly Value[];
  optionLabels: Record<Value, AppTextKey>;
  value: Value;
  onChange: (value: Value) => void;
}) {
  const { t } = useText();
  const optionLabel = (value: Value): AppTextKey => props.optionLabels[value];
  return (
    <Select<Value>
      queryKey={props.queryKey}
      options={[...props.options]}
      value={props.value}
      onChange={(value) => {
        if (value) props.onChange(value);
      }}
      itemComponent={(itemProps) => (
        <SelectItem item={itemProps.item}>{t(optionLabel(itemProps.item.rawValue))}</SelectItem>
      )}
    >
      <SelectTrigger size="sm" aria-label={props.label}>
        <SelectValue<Value>>{(selection) => t(optionLabel(selection.selectedOption()))}</SelectValue>
      </SelectTrigger>
      <SelectContent />
    </Select>
  );
}
