import type { johnBotDesktopApi } from "@johnbot/contracts/ipc";

/**
 * What the remote desktop context reaches in main: the sessions this computer holds to other
 * servers.
 */
export interface RemoteDesktopPort {
  remoteDesktop: Pick<
    johnBotDesktopApi["remoteDesktop"],
    "connect" | "disconnect" | "list" | "onEvent" | "selectDisplay"
  >;
}

/** Read on each call: tests and stories replace `window.johnbot` per case. */
export function remoteDesktopPort(): RemoteDesktopPort {
  return window.johnbot;
}
