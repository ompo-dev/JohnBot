import type { johnBotDesktopApi } from "@johnbot/contracts/ipc";

/**
 * What the settings context reaches in main: the app-wide preferences, the switches for updates,
 * notifications and the Dynamic Island, the local agents and their background processes of the
 * Agents tab, and the agents and the user's own notification levels of each server for the
 * Notifications tab.
 */
export interface SettingsPort {
  getAgentDefaults: johnBotDesktopApi["getAgentDefaults"];
  getAgentMemoryLimitPreference: johnBotDesktopApi["getAgentMemoryLimitPreference"];
  getAnalyticsPreference: johnBotDesktopApi["getAnalyticsPreference"];
  getAppBehaviorPreference: johnBotDesktopApi["getAppBehaviorPreference"];
  getApprovalAutomation: johnBotDesktopApi["getApprovalAutomation"];
  getBusyMessageModePreference: johnBotDesktopApi["getBusyMessageModePreference"];
  getExternalLinkPreference: johnBotDesktopApi["getExternalLinkPreference"];
  listExternalLinkBrowsers: johnBotDesktopApi["listExternalLinkBrowsers"];
  chooseExternalLinkApp: johnBotDesktopApi["chooseExternalLinkApp"];
  onExternalLinkFallback: johnBotDesktopApi["onExternalLinkFallback"];
  getRemoteNetworkRoute: johnBotDesktopApi["getRemoteNetworkRoute"];
  getRemoteSessionReusePreference: johnBotDesktopApi["getRemoteSessionReusePreference"];
  onAgentMemoryLimitPreference: johnBotDesktopApi["onAgentMemoryLimitPreference"];
  onAnalyticsPreference: johnBotDesktopApi["onAnalyticsPreference"];
  onApprovalAutomation: johnBotDesktopApi["onApprovalAutomation"];
  onOpenSettings: johnBotDesktopApi["onOpenSettings"];
  onOpenUpdateSettings: johnBotDesktopApi["onOpenUpdateSettings"];
  setAgentDefaults: johnBotDesktopApi["setAgentDefaults"];
  setAnalyticsPreference: johnBotDesktopApi["setAnalyticsPreference"];
  setAppBehaviorPreference: johnBotDesktopApi["setAppBehaviorPreference"];
  setBusyMessageModePreference: johnBotDesktopApi["setBusyMessageModePreference"];
  setExternalLinkPreference: johnBotDesktopApi["setExternalLinkPreference"];
  setRemoteNetworkRoute: johnBotDesktopApi["setRemoteNetworkRoute"];
  setRemoteSessionReusePreference: johnBotDesktopApi["setRemoteSessionReusePreference"];
  agent: Pick<
    johnBotDesktopApi["agent"],
    "listAgents" | "updateAgent" | "listAgentNotificationLevels" | "setAgentNotificationLevel" | "onScopedEvent"
  >;
  backgroundProcesses: johnBotDesktopApi["backgroundProcesses"];
  dynamicIsland: Pick<
    johnBotDesktopApi["dynamicIsland"],
    "getBuiltInDisplayGeometry" | "getPreference" | "setPreference" | "setXWayland"
  >;
  notifications: Pick<johnBotDesktopApi["notifications"], "getPreference" | "openSettings" | "setPreference" | "test">;
  update: Pick<johnBotDesktopApi["update"], "getPreference" | "onPreference" | "setPreference">;
}

/** Read on each call: tests and stories replace `window.johnbot` per case. */
export function settingsPort(): SettingsPort {
  return window.johnbot;
}
