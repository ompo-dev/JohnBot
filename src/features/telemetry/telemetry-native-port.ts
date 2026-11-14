import {
  FleetAttachmentAnalysis,
  type FleetAttachmentInput,
  type FleetEditInput,
  FleetEditReceipt,
  FleetEngineResponse,
  FleetExplorerPage,
  FleetImportJob,
  FleetJobPage,
  type FleetJobRetryInput,
  type FleetListInput,
  FleetReadingPage,
  FleetReport,
  type FleetReportInput,
  FleetRuntimeEvent,
} from "@johnbot/contracts/fleet";
import type { TelemetryErrorCode } from "@johnbot/contracts/ipc";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Schema } from "effect";
import type { TelemetryPort } from "./telemetry-port";
import { telemetryReading } from "./telemetry-reading";

export class NativeFleetError extends Error {
  constructor(readonly code: string) {
    super("Native telemetry operation failed.");
  }
}

export async function exportNativeFleetCsv(input: FleetReportInput, expectedRevision: number, title: string) {
  return Schema.decodeUnknownSync(Schema.Boolean)(
    await invoke<unknown>("export_report", { input, expectedRevision, title }),
  );
}
export async function loadNativeFleetPage(input: FleetListInput) {
  const response = Schema.decodeUnknownSync(FleetEngineResponse)(await invoke<unknown>("list_readings", { input }));
  if (!response.ok) throw new NativeFleetError(response.error.code);
  return Schema.decodeUnknownSync(FleetReadingPage)(response.value);
}

export async function saveNativeFleetEdit(input: FleetEditInput) {
  const response = Schema.decodeUnknownSync(FleetEngineResponse)(await invoke<unknown>("edit_reading", { input }));
  if (!response.ok) throw new NativeFleetError(response.error.code);
  return Schema.decodeUnknownSync(FleetEditReceipt)(response.value);
}

export async function loadNativeFleetReport(input: FleetReportInput) {
  const response = Schema.decodeUnknownSync(FleetEngineResponse)(await invoke<unknown>("fleet_report", { input }));
  if (!response.ok) throw new NativeFleetError(response.error.code);
  return Schema.decodeUnknownSync(FleetReport)(response.value);
}

export async function analyzeNativeAttachment(input: FleetAttachmentInput) {
  const response = Schema.decodeUnknownSync(FleetEngineResponse)(
    await invoke<unknown>("analyze_attachment", { input }),
  );
  if (!response.ok) throw new Error(response.error.message);
  return Schema.decodeUnknownSync(FleetAttachmentAnalysis)(response.value);
}

export async function loadNativeFleetJobs(workspaceId: string) {
  const response = Schema.decodeUnknownSync(FleetEngineResponse)(
    await invoke<unknown>("list_jobs", { input: { workspaceId, limit: 50 } }),
  );
  if (!response.ok) throw new NativeFleetError(response.error.code);
  return Schema.decodeUnknownSync(FleetJobPage)(response.value);
}

export async function retryNativeFleetJob(input: FleetJobRetryInput) {
  const response = Schema.decodeUnknownSync(FleetEngineResponse)(await invoke<unknown>("retry_job", { input }));
  if (!response.ok) throw new NativeFleetError(response.error.code);
  return Schema.decodeUnknownSync(FleetImportJob)(response.value);
}

export async function subscribeNativeFleet(workspaceId: string, changed: () => void) {
  const packet = Schema.Struct({ eventId: Schema.String, event: FleetRuntimeEvent });
  return listen<unknown>("telemetry-event", ({ payload }) => {
    let event: typeof FleetRuntimeEvent.Type;
    try {
      event = Schema.decodeUnknownSync(packet)(payload).event;
    } catch {
      return;
    }
    if (event.workspaceId === workspaceId) changed();
  });
}

/** Keeps the existing workspace-scoped view while the native host owns PostgreSQL. */
export function nativeTelemetryPort(): TelemetryPort {
  return {
    explorer: {
      async query(input) {
        const response = Schema.decodeUnknownSync(FleetEngineResponse)(await invoke<unknown>("query_fleet", { input }));
        if (!response.ok)
          return {
            ok: false,
            code:
              response.error.code === "unknown_workspace"
                ? "unknown-workspace"
                : response.error.code === "invalid_input" || response.error.code === "invalid_request"
                  ? "invalid-input"
                  : "unavailable",
          };
        return { ok: true, value: Schema.decodeUnknownSync(FleetExplorerPage)(response.value) };
      },
    },
    telemetry: {
      async listReadings(input) {
        const response = Schema.decodeUnknownSync(FleetEngineResponse)(
          await invoke<unknown>("list_readings", { input }),
        );
        if (!response.ok) {
          const code: TelemetryErrorCode =
            response.error.code === "unknown_workspace"
              ? "unknown-workspace"
              : response.error.code === "invalid_input" || response.error.code === "invalid_request"
                ? "invalid-input"
                : "unavailable";
          return {
            ok: false,
            operationId: response.id ?? "native-rejected",
            workspaceId: input.workspaceId,
            error: { code, retryable: code === "unavailable" },
          };
        }
        const page = Schema.decodeUnknownSync(FleetReadingPage)(response.value);
        return {
          ok: true,
          operationId: response.id,
          workspaceId: page.workspaceId,
          revision: page.revision,
          total: page.total,
          readings: page.readings.map(telemetryReading),
        };
      },
    },
  };
}
