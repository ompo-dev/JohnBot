import type { johnBotDesktopApi } from "@johnbot/contracts/ipc";

/**
 * What the usage panel reaches in main: the analytics of a server, its agents, and the events that
 * make the report stale.
 */
export interface UsagePort {
  agent: Pick<johnBotDesktopApi["agent"], "getHostAnalytics" | "listAgents" | "onScopedEvent">;
  servers: Pick<johnBotDesktopApi["servers"], "onEvent">;
}

/** Read on each call: tests and stories replace `window.johnbot` per case. */
export function usagePort(): UsagePort {
  return window.johnbot;
}
