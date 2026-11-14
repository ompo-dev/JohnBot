import { useRef } from "react";
import { type AnalyticsTotals, analyticsTokens, type HostAnalytics } from "@johnbot/contracts/ipc";
import type { AppTextKey } from "@johnbot/i18n";
import { Button, SlidingTabs } from "@johnbot/ui";
import { createMemo, For, onSettled, Show } from "solid-js";
import { useUrlSignal } from "../../lib/url-state";
import { useText } from "../../components/text";
import { UsageChart } from "./UsageChart";
import { UsageProviderMark } from "./UsageProviderMark";
import {
  type UsageAgentLabel,
  type UsageMetric,
  usageCompact,
  usageCost,
  usageExactCost,
  usageNumber,
  usageProviderName,
  usageProviders,
  usageSeriesColor,
} from "./usage-format";

type UsageTotalField =
  | "processedTokens"
  | "cachedInput"
  | "uncachedInput"
  | "cacheCreation"
  | "output"
  | "userMessages"
  | "assistantMessages";

const TOTAL_ROWS = [
  { field: "processedTokens", label: "usage.totals.processedTokens" },
  { field: "cachedInput", label: "usage.totals.cachedInput" },
  { field: "uncachedInput", label: "usage.totals.uncachedInput" },
  { field: "cacheCreation", label: "usage.totals.cacheCreation" },
  { field: "output", label: "usage.totals.output" },
  { field: "userMessages", label: "usage.totals.userMessages" },
  { field: "assistantMessages", label: "usage.totals.assistantMessages" },
] as const satisfies ReadonlyArray<{ field: UsageTotalField; label: AppTextKey }>;

// The fields that `Date.prototype.toLocaleString()` shows when it gets no options.
const UPDATED_AT_FORMAT: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
};

function Amount(props: { value: number | null; cost?: boolean }) {
  const text = useText();
  return (
    <>
      <span aria-hidden="true">{props.cost ? usageCost(props.value, text) : usageCompact(props.value, text)}</span>
      <span className="sr-only">{props.cost ? usageExactCost(props.value, text) : usageNumber(props.value, text)}</span>
    </>
  );
}
// The model and agent tables carry the same three value columns, so they share them and
// the metric switch changes the same one column in both by construction. The headers name
// the measure only: every cost cell carries its currency, and the note under the tables
// already says a share is of the known amount.
function BreakdownColumns(props: { label: string }) {
  const { t } = useText();
  return (
    <tr>
      <th scope="col">{props.label}</th>
      <th scope="col">{t("usage.column.cost")}</th>
      <th scope="col">{t("usage.column.share")}</th>
      <th scope="col">{t("usage.column.tokens")}</th>
    </tr>
  );
}
function BreakdownCells(props: { row: AnalyticsTotals; cost: boolean; share: (amount: number | null) => string }) {
  return (
    <>
      <td>
        <Amount value={props.row.estimatedCostUsd} cost />
      </td>
      <td>{props.share(props.cost ? props.row.estimatedCostUsd : analyticsTokens(props.row))}</td>
      <td>
        <Amount value={analyticsTokens(props.row)} />
      </td>
    </>
  );
}
export function AgentUsageReport(props: {
  result: HostAnalytics;
  metric: UsageMetric;
  agentLabel: (agentId: string) => UsageAgentLabel;
  onReady: () => void;
}) {
  const text = useText();
  const { t, format } = text;
  onSettled(() => queueMicrotask(props.onReady));
  // The host report answers "which teammate spent this" first, so the split by agent is
  // the tab that opens.
  const [breakdown, setBreakdown] = useUrlSignal("usageBreakdown");
  const state = { get breakdown() { return breakdown(); } };
  const totals = () => props.result.totals;
  const cost = () => props.metric === "cost";
  const providers = createMemo(() =>
    usageProviders(props.result.models).sort((a, b) =>
      cost() ? (b.cost ?? -1) - (a.cost ?? -1) : b.tokens - a.tokens,
    ),
  );
  const models = createMemo(() =>
    [...props.result.models].sort((a, b) =>
      cost() ? (b.estimatedCostUsd ?? -1) - (a.estimatedCostUsd ?? -1) : analyticsTokens(b) - analyticsTokens(a),
    ),
  );
  const agents = createMemo(() =>
    [...props.result.agents].sort((a, b) =>
      cost() ? (b.estimatedCostUsd ?? -1) - (a.estimatedCostUsd ?? -1) : analyticsTokens(b) - analyticsTokens(a),
    ),
  );
  const partial = () =>
    totals().missingUsageTurns > 0 || totals().unpricedRecords > 0 || totals().incompleteRecords > 0;
  const share = (amount: number | null) => {
    const total = cost() ? totals().estimatedCostUsd : analyticsTokens(totals());
    return amount === null || total === null
      ? t("usage.unavailable")
      : format.percent(total ? amount / total : 0, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  };
  const dailyTable = useRef<HTMLTableElement>(null);
  function showDailyData() {
    setBreakdown("day");
    queueMicrotask(() => dailyTable.current?.focus());
  }
  return (
    <>
      <Show when={!totals().turns && !totals().userMessages && !totals().processedTokens}>
        <p className="agent-usage-notice" role="status">
          {t("usage.empty")}
        </p>
      </Show>
      <Show when={partial()}>
        <p className="agent-usage-notice" role="status">
          {t("usage.partial", {
            turns: totals().missingUsageTurns,
            unpriced: totals().unpricedRecords,
            incomplete: totals().incompleteRecords,
          })}
        </p>
      </Show>
      <div className="agent-usage-overview">
        <section className="agent-usage-summary" aria-label={t("usage.summary")}>
          <div>
            <p className="agent-usage-hero">
              <Amount value={cost() ? totals().estimatedCostUsd : analyticsTokens(totals())} cost={cost()} />
            </p>
            <p className="agent-usage-secondary">
              {t("usage.sessions", { count: totals().sessions, sessions: usageNumber(totals().sessions, text) })} ·{" "}
              {cost() ? t("usage.costEstimate") : t("usage.knownTokens")}
            </p>
          </div>
          <div className="agent-usage-providers">
            <For each={providers()}>
              {(provider) => (
                <div className="agent-usage-provider">
                  <div className="agent-usage-provider-heading">
                    <span>
                      {/* The chart needs a legend, and this list already names every
                          series, so the dot is it - which is why the colour follows the
                          provider rather than the row's place in a metric-sorted list. */}
                      <span
                        className="agent-usage-series-dot"
                        style={{ background: usageSeriesColor(provider.provider) }}
                        aria-hidden="true"
                      />
                      <UsageProviderMark provider={provider.provider} />
                      {usageProviderName(provider.provider)}
                    </span>
                    <strong>
                      <Amount value={cost() ? provider.cost : provider.tokens} cost={cost()} />
                    </strong>
                  </div>
                  <p>
                    {/* A provider with no known cost has no share of it, and its heading already says so. */}
                    <Show when={!cost() || provider.cost !== null}>
                      {cost()
                        ? t("usage.provider.shareOfCost", { share: share(provider.cost) })
                        : t("usage.provider.shareOfTokens", { share: share(provider.tokens) })}{" "}
                      ·{" "}
                    </Show>
                    {cost()
                      ? t("usage.tokensAmount", { tokens: usageCompact(provider.tokens, text) })
                      : usageCost(provider.cost, text)}
                  </p>
                </div>
              )}
            </For>
          </div>
        </section>
        <section className="agent-usage-trend" aria-label={t("usage.dailyTrend")}>
          <div className="agent-usage-section-header">
            <h3>{cost() ? t("usage.dailyCost") : t("usage.dailyTokens")}</h3>
            <Button variant="ghost" size="xs" onClick={showDailyData}>
              {t("usage.viewDailyData")}
            </Button>
          </div>
          <UsageChart result={props.result} metric={props.metric} />
        </section>
      </div>
      <section aria-label={t("usage.totals.title")}>
        <h3>{t("usage.totals.title")}</h3>
        <dl className="agent-usage-totals">
          <div>
            <dt>{t("usage.totals.tokens")}</dt>
            <dd>
              <Amount value={analyticsTokens(totals())} />
            </dd>
          </div>
          <For each={TOTAL_ROWS}>
            {(item) => (
              <div>
                <dt>{t(item.label)}</dt>
                <dd>
                  <Amount value={totals()[item.field]} />
                </dd>
              </div>
            )}
          </For>
        </dl>
      </section>
      <SlidingTabs.Root
        value={state.breakdown}
        onChange={(value) => { if (value === "agent" || value === "model" || value === "day") setBreakdown(value); }}
      >
        <div className="agent-usage-section-header">
          <h3>{t("usage.breakdown.title")}</h3>
          <SlidingTabs.List aria-label={t("usage.breakdown.label")}>
            <SlidingTabs.Trigger value="model">{t("usage.breakdown.model")}</SlidingTabs.Trigger>
            <SlidingTabs.Trigger value="agent">{t("usage.breakdown.agent")}</SlidingTabs.Trigger>
            <SlidingTabs.Trigger value="day">{t("usage.breakdown.day")}</SlidingTabs.Trigger>
          </SlidingTabs.List>
        </div>
        {/* Every panel is force-mounted, and the grid slot is what makes the hidden ones
            share one cell instead of each reserving its own height below the visible table. */}
        <SlidingTabs.ContentSlot>
          <SlidingTabs.Content value="model">
            <div className="agent-usage-table">
              <table>
                <caption className="sr-only">{t("usage.breakdown.byModel")}</caption>
                <thead>
                  <BreakdownColumns label={t("usage.breakdown.model")} />
                </thead>
                <tbody>
                  <For each={models()}>
                    {(model) => (
                      <tr>
                        <th scope="row">
                          <span className="agent-usage-model-name">
                            <UsageProviderMark provider={model.provider} />
                            <span>
                              {model.model || t("usage.unknownModel")}
                              {/* The logo carries the provider for a reader who sees it, and the
                                  row stays one line high; the name is still spoken. */}
                              <span className="sr-only">{usageProviderName(model.provider)}</span>
                            </span>
                          </span>
                        </th>
                        <BreakdownCells row={model} cost={cost()} share={share} />
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </SlidingTabs.Content>
          <SlidingTabs.Content value="agent">
            <div className="agent-usage-table">
              <table>
                <caption className="sr-only">{t("usage.breakdown.byAgent")}</caption>
                <thead>
                  <BreakdownColumns label={t("usage.breakdown.agent")} />
                </thead>
                <tbody>
                  <For each={agents()}>
                    {(agent) => (
                      <tr>
                        <th scope="row">
                          <span className="agent-usage-model-name">
                            <UsageProviderMark provider={props.agentLabel(agent.agentId).provider} />
                            <span>{props.agentLabel(agent.agentId).name}</span>
                          </span>
                        </th>
                        <BreakdownCells row={agent} cost={cost()} share={share} />
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </SlidingTabs.Content>
          <SlidingTabs.Content value="day">
            <div className="agent-usage-table">
              <table ref={dailyTable} tabIndex={-1}>
                <caption className="sr-only">{t("usage.breakdown.byDay")}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t("usage.column.date")}</th>
                    <th scope="col">{t("usage.column.costUsd")}</th>
                    <th scope="col">{t("usage.column.tokens")}</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={[...props.result.daily].reverse()}>
                    {(day) => (
                      <tr>
                        <th scope="row">{day.date}</th>
                        <td>{usageExactCost(day.estimatedCostUsd, text)}</td>
                        <td>{usageNumber(analyticsTokens(day), text)}</td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </SlidingTabs.Content>
        </SlidingTabs.ContentSlot>
      </SlidingTabs.Root>
      <footer className="agent-usage-footer">
        <p>
          {t("usage.footer", {
            started: format.date(new Date(props.result.collectionStartedAt)),
            updated: props.result.updatedAt
              ? format.date(new Date(props.result.updatedAt), UPDATED_AT_FORMAT)
              : t("usage.updatedNever"),
          })}
        </p>
        <details>
          <summary>{t("usage.about.title")}</summary>
          <p>{t("usage.about.body")}</p>
          <p>{t("usage.about.tokens")}</p>
        </details>
      </footer>
    </>
  );
}
