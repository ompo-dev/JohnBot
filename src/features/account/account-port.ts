import type { johnBotDesktopApi } from "@johnbot/contracts/ipc";

/**
 * What the account context reaches in main: the johnBot account session, its devices, and the
 * usage the page rail and the Usage page show.
 */
export interface AccountPort {
  agent: Pick<johnBotDesktopApi["agent"], "getUsage">;
  auth: Pick<
    johnBotDesktopApi["auth"],
    | "cancelMobileConnect"
    | "createMobileConnect"
    | "createMobileConnectLink"
    | "getMobileConnectLink"
    | "getState"
    | "listAccountSessions"
    | "listMobileConnectedDevices"
    | "logout"
    | "onEvent"
    | "requestEmailCode"
    | "retry"
    | "revokeAccountSession"
    | "revokeMobileConnectedDevice"
    | "revokeMobileConnectLink"
    | "updateAvatar"
    | "updateName"
    | "verifyEmailCode"
  >;
}

/** Read on each call: tests and stories replace `window.johnbot` per case. */
export function accountPort(): AccountPort {
  return window.johnbot;
}
