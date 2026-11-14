import type { johnBotDesktopApi } from "@johnbot/contracts/ipc";

/**
 * What the app shell and the cross-domain root modules reach in main, plus the shell actions
 * (`openUrl`, `openExternal`) that several domains share.
 */
export interface AppPort {
  getAppInfo: johnBotDesktopApi["getAppInfo"];
  getAppAppearancePreference: johnBotDesktopApi["getAppAppearancePreference"];
  getAppInterfaceSizePreference: johnBotDesktopApi["getAppInterfaceSizePreference"];
  getAppLanguagePreference: johnBotDesktopApi["getAppLanguagePreference"];
  getAppLogoColorPreference: johnBotDesktopApi["getAppLogoColorPreference"];
  onAppAppearancePreference: johnBotDesktopApi["onAppAppearancePreference"];
  onAppInterfaceSizePreference: johnBotDesktopApi["onAppInterfaceSizePreference"];
  onAppLanguagePreference: johnBotDesktopApi["onAppLanguagePreference"];
  onAppLogoColorPreference: johnBotDesktopApi["onAppLogoColorPreference"];
  openExternal: johnBotDesktopApi["openExternal"];
  openUrl: johnBotDesktopApi["openUrl"];
  openChatWindow: johnBotDesktopApi["openChatWindow"];
  getChatWindows: johnBotDesktopApi["getChatWindows"];
  onChatWindows: johnBotDesktopApi["onChatWindows"];
  setAppAppearancePreference: johnBotDesktopApi["setAppAppearancePreference"];
  setAppInterfaceSizePreference: johnBotDesktopApi["setAppInterfaceSizePreference"];
  setAppLanguagePreference: johnBotDesktopApi["setAppLanguagePreference"];
  setAppLogoColorPreference: johnBotDesktopApi["setAppLogoColorPreference"];
  agent: Pick<
    johnBotDesktopApi["agent"],
    "readConversationPage" | "searchConversationMessages" | "searchConversationFiles" | "listRoutines" | "listAgents"
  >;
  agentTemplates: Pick<johnBotDesktopApi["agentTemplates"], "onOpenLink" | "takePendingLink">;
  acpRegistry: johnBotDesktopApi["acpRegistry"];
  hostedSites: johnBotDesktopApi["hostedSites"];
  billing: johnBotDesktopApi["billing"];
  license: johnBotDesktopApi["license"];
  hostedServers: johnBotDesktopApi["hostedServers"];
  routineFeed: johnBotDesktopApi["routineFeed"];
  events: johnBotDesktopApi["events"];
  plugins: Pick<johnBotDesktopApi["plugins"], "onOpenListing" | "takePendingListing">;
  servers: Pick<johnBotDesktopApi["servers"], "onInvite" | "takePendingInvite">;
}

/** Read on each call: tests and stories replace `window.johnbot` per case. */
export function appPort(): AppPort {
  if (typeof window !== "undefined" && !window.johnbot) {
    try {
      const { createMockjohnBot } = require("../preview/mock-johnbot");
      const { DEMO_OPTIONS } = require("../preview/demo-seed");
      window.johnbot = createMockjohnBot(DEMO_OPTIONS).api;
    } catch {
      // ignore
    }
  }
  return window.johnbot;
}
