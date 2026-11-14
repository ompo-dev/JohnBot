import type { johnBotDesktopApi } from "@johnbot/contracts/ipc";

/**
 * What the browser dock overlay reaches in main: the presentation, the actions, the frame, and the code
 * that the agent asks for. The overlay has no provider tree, so this is a module.
 */
export interface BrowserDockPort {
  agent: Pick<johnBotDesktopApi["agent"], "respondToBrowserSecret">;
  browserDock: Pick<
    johnBotDesktopApi["browserDock"],
    "getPresentation" | "onPresentation" | "performAction" | "setFrame"
  >;
}

/** Read on each call: tests and stories replace `window.johnbot` per case. */
export function browserDockPort(): BrowserDockPort {
  return window.johnbot;
}
