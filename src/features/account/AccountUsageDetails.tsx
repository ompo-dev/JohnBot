import { ProviderLogo } from "@johnbot/brand";
import { Button, Gauge, RefreshCw } from "@johnbot/ui";
import type { JSX } from "@solidjs/web";
import { createSignal, For, onCleanup, Show } from "solid-js";
import { useText } from "../../components/text";
import {
  type AccountUsageProviderRow,
  type AccountUsageWindowRow,
  accountUsageRowKey,
  accountUsageRowLabel,
  formatUsageResetIn,
} from "./account-usage-view";

/** The reset countdown shows minutes, so a half-minute tick keeps it current. */
const RESET_CLOCK_MS = 30_000;

export function AccountUsageDetails(props: {
  rows: AccountUsageProviderRow[];
  loading: boolean;
  error: string | null;
  refreshActive: boolean;
  refreshDisabled: boolean;
  onRefresh: () => void;
  title: JSX.Element;
}) {
  const text = useText();
  const { t } = text;
  const empty = () => !props.loading && props.rows.length === 0;
  const [now, setNow] = createSignal(Date.now());
  const clock = window.setInterval(() => setNow(Date.now()), RESET_CLOCK_MS);
  onCleanup(() => window.clearInterval(clock));
  return (
    <>
      <header className="account-usage-popover-header">
        <div className="account-usage-popover-heading">
          <Gauge aria-hidden="true" />
          {props.title}
        </div>
        <Button
          variant="ghost"
          type="button"
          size="icon-sm"
          className="account-usage-refresh"
          aria-label={
            props.refreshActive
              ? t("account.usage.refreshing")
              : props.error
                ? t("common.tryAgain")
                : t("account.usage.refresh")
          }
          title={t("account.usage.refreshTitle")}
          onClick={props.onRefresh}
          disabled={props.refreshDisabled}
        >
          <RefreshCw className={props.refreshActive ? "icon-spinning" : ""} aria-hidden="true" />
        </Button>
      </header>
      <Show when={props.loading && props.rows.length === 0}>
        <p className="account-usage-empty" role="status">
          {t("account.usage.loading")}
        </p>
      </Show>
      <Show when={empty()}>
        <p className="account-usage-empty" role="status">
          {t("account.usage.empty")}
        </p>
      </Show>
      <Show when={props.rows.length > 0}>
        <ul className="account-usage-providers" aria-label={t("account.usage.providers")}>
          <For each={props.rows} keyed={accountUsageRowKey}>
            {(row) => (
              <li className="account-usage-provider" aria-label={accountUsageRowLabel(row(), text, props.loading)}>
                <ProviderLogo provider={row().provider} className="account-usage-provider-logo" />
                <Show
                  when={row().windows.length > 0}
                  fallback={
                    <>
                      <span className="account-usage-provider-copy">
                        <strong className="account-usage-provider-name">{row().name}</strong>
                        <span className="account-usage-provider-meta">
                          {!row().reportsUsage
                            ? t("account.usage.providerNotReported")
                            : props.loading
                              ? t("account.usage.window.limit")
                              : t("account.usage.notReported")}
                        </span>
                      </span>
                      <strong className="account-usage-provider-remaining">
                        {!row().reportsUsage
                          ? t("account.usage.value.notReported")
                          : props.loading
                            ? t("account.usage.value.loading")
                            : t("account.usage.value.unavailable")}
                      </strong>
                    </>
                  }
                >
                  <strong className="account-usage-provider-name">{row().name}</strong>
                  <AccountUsageWindowList windows={row().windows} now={now()} />
                </Show>
              </li>
            )}
          </For>
        </ul>
      </Show>
      <Show when={props.error}>{(message) => <p className="account-usage-popover-error">{message()}</p>}</Show>
    </>
  );
}

/** The limit windows of one account: a bar, the amount left and the time to the reset of each. */
export function AccountUsageWindowList(props: { windows: readonly AccountUsageWindowRow[]; now: number }) {
  const text = useText();
  const { t } = text;
  return (
    <span className="account-usage-windows">
      <For each={props.windows}>
        {(usageWindow) => (
          <span className="account-usage-window" data-usage-tone={usageWindow.tone}>
            <span className="account-usage-window-label">{usageWindow.label}</span>
            <span className="account-usage-window-bar" aria-hidden="true">
              <span className="account-usage-window-fill" style={{ "inline-size": `${usageWindow.remainingPercent}%` }} />
            </span>
            <strong className="account-usage-window-remaining">
              {text.format.percent(usageWindow.remainingPercent / 100)}
            </strong>
            <span
              className="account-usage-window-reset"
              title={
                usageWindow.resetsAtLabel ? t("account.usage.resetsAt", { time: usageWindow.resetsAtLabel }) : undefined
              }
            >
              {formatUsageResetIn(usageWindow.resetsAt, props.now, text)}
            </span>
          </span>
        )}
      </For>
    </span>
  );
}
