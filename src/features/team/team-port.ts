import type { johnBotDesktopApi } from "@johnbot/contracts/ipc";

/**
 * What team presence reaches in main: who is online, and whether this member is typing.
 */
export interface TeamPort {
  servers: Pick<johnBotDesktopApi["servers"], "onPresence" | "setTyping">;
}

/** Read on each call: tests and stories replace `window.johnbot` per case. */
export function teamPort(): TeamPort {
  return window.johnbot;
}
