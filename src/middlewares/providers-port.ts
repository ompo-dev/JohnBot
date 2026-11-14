import type { johnBotDesktopApi } from "@johnbot/contracts/ipc";

/**
 * What provider state reaches in main: connecting, signing in and refreshing providers, and the
 * runtimes johnBot installs for them, on this computer or on a host the account administers.
 */
export interface ProvidersPort {
  cancelProviderCodeLogin: johnBotDesktopApi["cancelProviderCodeLogin"];
  connectProvider: johnBotDesktopApi["connectProvider"];
  cancelProviderSignIn: johnBotDesktopApi["cancelProviderSignIn"];
  refreshAgentProviders: johnBotDesktopApi["refreshAgentProviders"];
  setProviderOn: johnBotDesktopApi["setProviderOn"];
  restartProvider: johnBotDesktopApi["restartProvider"];
  cancelProviderRestart: johnBotDesktopApi["cancelProviderRestart"];
  startProviderCodeLogin: johnBotDesktopApi["startProviderCodeLogin"];
  providerRuntimes: johnBotDesktopApi["providerRuntimes"];
  connectProviderAccount: johnBotDesktopApi["connectProviderAccount"];
  cancelProviderAccountSignIn: johnBotDesktopApi["cancelProviderAccountSignIn"];
  renameProviderAccount: johnBotDesktopApi["renameProviderAccount"];
  removeProviderAccount: johnBotDesktopApi["removeProviderAccount"];
  providerUsageResets: johnBotDesktopApi["providerUsageResets"];
  resetProviderUsage: johnBotDesktopApi["resetProviderUsage"];
  /** The same, for the host of a joined server the account administers. */
  providerAdmin: johnBotDesktopApi["providerAdmin"];
}

/** Read on each call: tests and stories replace `window.johnbot` per case. */
export function providersPort(): ProvidersPort {
  return window.johnbot;
}
