import type { FleetReading } from "@johnbot/contracts/fleet";

/** Adapter for the original telemetry view contract. Sensor absence remains null. */
export function telemetryReading(reading: FleetReading) {
  return {
    id: reading.id,
    machineId: reading.machineId,
    recordedAt: reading.timestamp,
    temperature: reading.temperature,
    oilPressure: reading.oilPressure,
    rpm: reading.rpm,
    vibration: reading.vibration,
    consumption: reading.consumption,
    engineHours: reading.engineHours,
  };
}
