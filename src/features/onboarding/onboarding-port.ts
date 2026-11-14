import type { johnBotDesktopApi } from "@johnbot/contracts/ipc";

/**
 * What onboarding reaches in main: the saved setup, and the preview of an invite before the user
 * joins.
 */
export interface OnboardingPort {
  getSetupState: johnBotDesktopApi["getSetupState"];
  saveSetup: johnBotDesktopApi["saveSetup"];
  onSetupState: johnBotDesktopApi["onSetupState"];
  servers: Pick<johnBotDesktopApi["servers"], "previewInvite">;
}

/** Read on each call: tests and stories replace `window.johnbot` per case. */
export function onboardingPort(): OnboardingPort {
  return window.johnbot;
}
