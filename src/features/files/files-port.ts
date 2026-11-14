import type { johnBotDesktopApi } from "@johnbot/contracts/ipc";

/**
 * What the storage panels reach in main: the stored files of a server, and the agent names that
 * label them.
 */
export interface FilesPort {
  agent: Pick<johnBotDesktopApi["agent"], "listAgents">;
  /**
   * The old provider CLI versions and the machine use are optional: a client with no store of its
   * own, such as the web client, has none.
   */
  storage: Pick<johnBotDesktopApi["storage"], "clear" | "deleteFile" | "getUsage" | "openFile"> &
    Partial<
      Pick<johnBotDesktopApi["storage"], "getOldRuntimeVersions" | "removeOldRuntimeVersions" | "getMachineMetrics">
    >;
  /** The machine alert settings, beside `storage.getMachineMetrics`. */
  hostAdmin?: Pick<johnBotDesktopApi["hostAdmin"], "getMachineAlerts" | "setMachineAlerts">;
}

/** Read on each call: tests and stories replace `window.johnbot` per case. */
export function filesPort(): FilesPort {
  return window.johnbot;
}
