/**
 * Telemetry: the machine readings one workspace holds, for the Fleet and Alerts views.
 *
 * A reading is one machine at one time. A sensor the source did not report is null, never zero, so a
 * chart shows a gap instead of a drop to the floor. The request names a workspace and, optionally,
 * one machine and a page size; the answer names the operation, the workspace, and the dataset
 * revision it read, so a late answer for another target is recognizable.
 *
 * A failure is part of the answer, not a rejection. The surface offers the same request again only
 * when `retryable` says the source was unavailable: wrong input and an unknown workspace stay wrong.
 * The text of each code comes from the language pack, so this module carries no message.
 */

import { INPUT_LIMITS } from "./input-limits";
import { isBoundedString, isIdentifier } from "./ipc-bounded-values";
import { isBoolean, isDynamicRecord, isNumber, isOneOf, isString } from "./runtime-values";

/** The largest page of readings one answer carries. */
export const TELEMETRY_READING_LIMIT = 500;

/** The page size the domain uses when the request names none. */
export const TELEMETRY_DEFAULT_READING_LIMIT = 100;

/** One reading of one machine at one time. */
export interface TelemetryReading {
  id: number;
  machineId: number;
  /** ISO 8601 time with milliseconds. */
  recordedAt: string;
  /** Degrees Celsius. */
  temperature: number | null;
  /** Pounds per square inch. */
  oilPressure: number | null;
  rpm: number | null;
  /** Millimetres per second. */
  vibration: number | null;
  /** Litres per hour. */
  consumption: number | null;
  engineHours: number | null;
}

export interface ListTelemetryReadingsInput {
  workspaceId: string;
  /** Only the readings of this machine. */
  machineId?: number;
  /** At most this many rows. The domain answers `invalid-input` outside 1 to `TELEMETRY_READING_LIMIT`. */
  limit?: number;
}

export const TELEMETRY_ERROR_CODES = ["invalid-input", "unknown-workspace", "unavailable"] as const;
export type TelemetryErrorCode = (typeof TELEMETRY_ERROR_CODES)[number];

export interface TelemetryFailure {
  code: TelemetryErrorCode;
  /** The source was unavailable, not the request: the surface may offer the same call again. */
  retryable: boolean;
}

/**
 * The answer of one operation. `total` counts every reading that matched before `limit` cut the
 * page, so a view can say how much it does not show.
 */
export type TelemetryReadingsOutcome =
  | {
      ok: true;
      operationId: string;
      workspaceId: string;
      /** The dataset revision the answer came from. */
      revision: number;
      total: number;
      readings: TelemetryReading[];
    }
  | {
      ok: false;
      operationId: string;
      /** Null when the request was rejected before a workspace was read. */
      workspaceId: string | null;
      error: TelemetryFailure;
    };

function invalid(label: string): never {
  throw new Error(`Invalid ${label}.`);
}

function record(value: unknown, label: string) {
  if (!isDynamicRecord(value)) invalid(label);
  return value;
}

function identifier(value: unknown, label: string): string {
  if (!isIdentifier(value)) invalid(label);
  return value;
}

function count(value: unknown, label: string): number {
  if (!isNumber(value) || !Number.isSafeInteger(value) || value < 0) invalid(label);
  return value;
}

/**
 * The shape of a request, not its bounds: the domain decides whether a page size or a machine is
 * usable, because an import job calls the same operation without a decoder in front of it.
 */
export function parseListTelemetryReadingsInput(value: unknown): ListTelemetryReadingsInput {
  const input = record(value, "telemetry request");
  const workspaceId = identifier(input.workspaceId, "telemetry workspace");
  if (input.machineId !== undefined && (!isNumber(input.machineId) || !Number.isFinite(input.machineId)))
    invalid("telemetry machine");
  if (input.limit !== undefined && (!isNumber(input.limit) || !Number.isFinite(input.limit))) invalid("telemetry page");
  return {
    workspaceId,
    ...(input.machineId === undefined ? {} : { machineId: input.machineId }),
    ...(input.limit === undefined ? {} : { limit: input.limit }),
  };
}

function sensor(value: unknown, label: string): number | null {
  if (value === null) return null;
  if (!isNumber(value) || !Number.isFinite(value)) invalid(label);
  return value;
}

function decodeReading(value: unknown): TelemetryReading {
  const reading = record(value, "telemetry reading");
  const recordedAt = reading.recordedAt;
  if (!isString(recordedAt) || !isBoundedString(recordedAt, 64)) invalid("telemetry reading time");
  return {
    id: count(reading.id, "telemetry reading"),
    machineId: count(reading.machineId, "telemetry reading machine"),
    recordedAt,
    temperature: sensor(reading.temperature, "telemetry reading temperature"),
    oilPressure: sensor(reading.oilPressure, "telemetry reading oil pressure"),
    rpm: sensor(reading.rpm, "telemetry reading rpm"),
    vibration: sensor(reading.vibration, "telemetry reading vibration"),
    consumption: sensor(reading.consumption, "telemetry reading consumption"),
    engineHours: sensor(reading.engineHours, "telemetry reading engine hours"),
  };
}

/** Every answer of `telemetry:list-readings` passes here before the renderer sees it. */
export function decodeTelemetryReadingsOutcome(value: unknown): TelemetryReadingsOutcome {
  const outcome = record(value, "telemetry answer");
  if (!isBoolean(outcome.ok)) invalid("telemetry answer");
  const operationId = identifier(outcome.operationId, "telemetry operation");
  if (!outcome.ok) {
    // The answer echoes the workspace it was asked for, which may be one no host holds.
    if (outcome.workspaceId !== null && !isBoundedString(outcome.workspaceId, INPUT_LIMITS.identifier))
      invalid("telemetry workspace");
    const error = record(outcome.error, "telemetry failure");
    if (!isOneOf(TELEMETRY_ERROR_CODES, error.code) || !isBoolean(error.retryable)) invalid("telemetry failure");
    return {
      ok: false,
      operationId,
      workspaceId: outcome.workspaceId,
      error: { code: error.code, retryable: error.retryable },
    };
  }
  if (!Array.isArray(outcome.readings) || outcome.readings.length > TELEMETRY_READING_LIMIT)
    invalid("telemetry readings");
  return {
    ok: true,
    operationId,
    workspaceId: identifier(outcome.workspaceId, "telemetry workspace"),
    revision: count(outcome.revision, "telemetry revision"),
    total: count(outcome.total, "telemetry total"),
    readings: outcome.readings.map(decodeReading),
  };
}
