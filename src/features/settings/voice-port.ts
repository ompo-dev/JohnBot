import type { johnBotDesktopApi } from "@johnbot/contracts/ipc";

/** What the Voice tab reaches in main: the dictation models and the dictation settings. */
export interface VoicePort {
  voice: johnBotDesktopApi["voice"];
}

/** Read on each call: tests and stories replace `window.johnbot` per case. */
export function voicePort(): VoicePort {
  return window.johnbot;
}
