import type { ListTelemetryReadingsInput, johnBotDesktopApi, TelemetryReading } from "@johnbot/contracts/ipc";

// Preview readings for the browser mock. They are not the desktop dataset: the preview only needs a
// repeatable answer, a null sensor, and one machine filter to show the shape of a view.

const READINGS: readonly TelemetryReading[] = [
  {
    id: 1,
    machineId: 24,
    recordedAt: "2026-10-24T12:05:00.000Z",
    temperature: 101.2,
    oilPressure: 41,
    rpm: 1250,
    vibration: 4.8,
    consumption: 12.5,
    engineHours: 1500.1,
  },
  {
    id: 2,
    machineId: 24,
    recordedAt: "2026-10-24T12:00:00.000Z",
    temperature: 78.4,
    oilPressure: 42,
    rpm: 1200,
    vibration: 2.1,
    consumption: 12,
    engineHours: 1500,
  },
  {
    id: 3,
    machineId: 25,
    recordedAt: "2026-10-24T13:00:00.000Z",
    temperature: null,
    oilPressure: null,
    rpm: null,
    vibration: 0,
    consumption: 0,
    engineHours: 2000,
  },
];

export function createMockTelemetry(): johnBotDesktopApi["telemetry"] {
  return {
    listReadings: async ({ workspaceId, machineId, limit }: ListTelemetryReadingsInput) => {
      const matching = READINGS.filter(
        (reading) => workspaceId === "local" && (machineId === undefined || reading.machineId === machineId),
      );
      return {
        ok: true,
        operationId: `preview-${matching.length}`,
        workspaceId,
        revision: 1,
        total: matching.length,
        readings: structuredClone(matching.slice(0, limit ?? matching.length)),
      };
    },
  };
}
