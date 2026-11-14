import type { johnBotDesktopApi } from "@johnbot/contracts/ipc";

/**
 * What the sidebar reaches in main: the saved sidebar layout and its changes, the free space on the
 * disk of a server for the storage card, and its machine use and alert levels for the machine card.
 */
export interface SidebarPort {
  agent: Pick<johnBotDesktopApi["agent"], "getSidebarLayout" | "mutateSidebarLayout">;
  storage: Pick<johnBotDesktopApi["storage"], "getDisk" | "getMachineMetrics">;
  hostAdmin: Pick<johnBotDesktopApi["hostAdmin"], "getMachineAlerts">;
}

/** Read on each call: tests and stories replace `window.johnbot` per case. */
export function sidebarPort(): SidebarPort {
  return window.johnbot;
}
