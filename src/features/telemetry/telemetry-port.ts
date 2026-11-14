import type { FleetExplorerInput, FleetExplorerPage } from "@johnbot/contracts/fleet";
import type { johnBotDesktopApi, TelemetryErrorCode } from "@johnbot/contracts/ipc";

/**
 * What the telemetry views reach in main: the readings of one workspace. The views pass a filter and
 * a page, and read the outcome rather than catching a rejection, because a failure is part of the
 * answer. Nothing here holds state: E3 adds the view store above this port.
 */
export interface TelemetryPort {
  telemetry: Pick<johnBotDesktopApi["telemetry"], "listReadings">;
  explorer?: {
    query(
      input: FleetExplorerInput,
    ): Promise<{ ok: true; value: FleetExplorerPage } | { ok: false; code: TelemetryErrorCode }>;
  };
}

/** Read on each call: tests and stories replace `window.johnbot` per case. */
export function telemetryPort(): TelemetryPort {
  return window.johnbot;
}
