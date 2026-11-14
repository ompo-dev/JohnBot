import { Schema } from "effect";

export const FLEET_FILE_BYTES = 5 * 1024 * 1024;
export const FLEET_ENCODED_LENGTH = Math.ceil(FLEET_FILE_BYTES / 3) * 4;
export const FleetId = Schema.Number.check(
  Schema.isInt(),
  Schema.isBetween({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER }),
);
const Count = Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0));
const Sensor = Schema.NullOr(Schema.Number.check(Schema.isFinite()));
export const FleetSensor = Schema.Literals([
  "temperature",
  "oilPressure",
  "rpm",
  "vibration",
  "consumption",
  "engineHours",
]);
export type FleetSensor = typeof FleetSensor.Type;

export const FleetReading = Schema.Struct({
  id: FleetId,
  machineId: FleetId,
  timestamp: Schema.String,
  temperature: Sensor,
  oilPressure: Sensor,
  rpm: Sensor,
  vibration: Sensor,
  consumption: Sensor,
  engineHours: Sensor,
  version: FleetId,
});
export type FleetReading = typeof FleetReading.Type;

export const FleetImportCounts = Schema.Struct({
  received: Count,
  valid: Count,
  unique: Count,
  duplicate: Count,
  invalid: Count,
});
export type FleetImportCounts = typeof FleetImportCounts.Type;
export const FleetRowIssue = Schema.Struct({
  row: FleetId,
  code: Schema.Literals(["invalid_id", "invalid_date", "column_count"]),
});
export type FleetRowIssue = typeof FleetRowIssue.Type;
export const FleetNormalizedFile = Schema.Struct({
  counts: FleetImportCounts,
  readings: Schema.Array(FleetReading),
  issues: Schema.Array(FleetRowIssue),
  worksheet: Schema.optionalKey(Schema.String),
});
export type FleetNormalizedFile = typeof FleetNormalizedFile.Type;

export const FleetPreview = Schema.Struct({
  filename: Schema.String,
  digest: Schema.String,
  counts: FleetImportCounts,
  sample: Schema.Array(FleetReading),
  issues: Schema.Array(FleetRowIssue),
  machineCount: Count,
  alertReadingCount: Count,
  worksheet: Schema.optionalKey(Schema.String),
});
export type FleetPreview = typeof FleetPreview.Type;

export const FleetPrepareInput = Schema.Struct({
  filename: Schema.String.check(Schema.isBetweenLength(1, 255)),
  content: Schema.String.check(Schema.isMaxLength(FLEET_ENCODED_LENGTH)),
  encoding: Schema.optionalKey(Schema.Literal("base64")),
});
export type FleetPrepareInput = typeof FleetPrepareInput.Type;

const WorkspaceId = Schema.String.check(Schema.isBetweenLength(1, 100));
const CommandKey = Schema.String.check(Schema.isBetweenLength(1, 100));
export const FleetConfirmInput = Schema.Struct({
  ...FleetPrepareInput.fields,
  workspaceId: WorkspaceId,
  expectedDigest: Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/)),
  idempotencyKey: CommandKey,
});
export type FleetConfirmInput = typeof FleetConfirmInput.Type;

export const FleetImportReceipt = Schema.Struct({
  importId: Schema.String,
  workspaceId: WorkspaceId,
  filename: Schema.String,
  digest: Schema.String,
  counts: FleetImportCounts,
  inserted: Count,
  preserved: Count,
  revision: Count,
});
export type FleetImportReceipt = typeof FleetImportReceipt.Type;

export const FleetEditInput = Schema.Struct({
  workspaceId: WorkspaceId,
  id: FleetId,
  sensor: FleetSensor,
  value: Sensor,
  expectedVersion: FleetId,
  reason: Schema.String.check(Schema.isBetweenLength(1, 500)),
  idempotencyKey: CommandKey,
});
export type FleetEditInput = typeof FleetEditInput.Type;
export const FleetEditReceipt = Schema.Struct({
  reading: FleetReading,
  revision: Count,
  auditId: Schema.String,
});
export type FleetEditReceipt = typeof FleetEditReceipt.Type;

export const FleetListInput = Schema.Struct({
  workspaceId: WorkspaceId,
  machineId: Schema.optionalKey(FleetId),
  readingId: Schema.optionalKey(FleetId),
  limit: Schema.optionalKey(Schema.Number.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 500 }))),
});
export type FleetListInput = typeof FleetListInput.Type;
export const FleetReadingPage = Schema.Struct({
  workspaceId: WorkspaceId,
  revision: Count,
  total: Count,
  readings: Schema.Array(FleetReading),
});
export type FleetReadingPage = typeof FleetReadingPage.Type;

export const FleetExplorerInput = Schema.Struct({
  workspaceId: WorkspaceId,
  machineId: Schema.optionalKey(FleetId),
  period: Schema.optionalKey(Schema.Literals(["all", "day"])),
  view: Schema.optionalKey(Schema.Literals(["fleet", "alerts"])),
  offset: Schema.optionalKey(
    Schema.Number.check(Schema.isInt(), Schema.isBetween({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER })),
  ),
  limit: Schema.optionalKey(Schema.Number.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 500 }))),
});
export type FleetExplorerInput = typeof FleetExplorerInput.Type;
export const FleetSummary = Schema.Struct({
  readings: Count,
  machines: Count,
  alerts: Count,
  averageTemperature: Sensor,
  averageVibration: Sensor,
  latestAt: Schema.NullOr(Schema.String),
});
export type FleetSummary = typeof FleetSummary.Type;
export const FleetExplorerPage = Schema.Struct({
  page: FleetReadingPage,
  summary: FleetSummary,
  offset: Count,
  limit: FleetId,
});
export type FleetExplorerPage = typeof FleetExplorerPage.Type;

export const FleetReportInput = Schema.Struct({
  workspaceId: WorkspaceId,
  machineId: Schema.optionalKey(FleetId),
  period: Schema.optionalKey(Schema.Literals(["all", "day"])),
});
export type FleetReportInput = typeof FleetReportInput.Type;
export const FleetDailyPoint = Schema.Struct({
  day: Schema.String,
  readings: Count,
  alerts: Count,
  averageTemperature: Sensor,
  averageVibration: Sensor,
});
export type FleetDailyPoint = typeof FleetDailyPoint.Type;
export const FleetReceivedImport = Schema.Struct({ ...FleetImportReceipt.fields, createdAt: Schema.String });
export const FleetReport = Schema.Struct({
  workspaceId: WorkspaceId,
  revision: Count,
  daily: Schema.Array(FleetDailyPoint),
  latestMachines: Schema.Array(FleetReading),
  recent: Schema.Array(FleetReading),
  imports: Schema.Array(FleetReceivedImport),
});
export type FleetReport = typeof FleetReport.Type;

export const FLEET_ATTACHMENT_TEXT = 1_500_000;
export const FleetAttachmentInput = Schema.Struct({
  ...FleetPrepareInput.fields,
  extractedText: Schema.optionalKey(Schema.String.check(Schema.isMaxLength(FLEET_ATTACHMENT_TEXT))),
  pages: Schema.optionalKey(FleetId),
  textTruncated: Schema.optionalKey(Schema.Boolean),
});
export type FleetAttachmentInput = typeof FleetAttachmentInput.Type;
const AttachmentMetadata = {
  filename: Schema.String,
  digest: Schema.String,
  characters: Count,
  lineCount: Count,
  truncated: Schema.Boolean,
  previewText: Schema.String,
};
export const FleetAttachmentAnalysis = Schema.Union([
  Schema.Struct({
    ...AttachmentMetadata,
    kind: Schema.Literal("telemetry"),
    format: Schema.Literals(["csv", "json", "xlsx"]),
    counts: FleetImportCounts,
    summary: FleetSummary,
    sample: Schema.Array(FleetReading),
    daily: Schema.Array(FleetDailyPoint),
    worksheet: Schema.optionalKey(Schema.String),
  }),
  Schema.Struct({
    ...AttachmentMetadata,
    kind: Schema.Literal("document"),
    format: Schema.Literals(["pdf", "txt", "markdown", "json"]),
    pages: Schema.optionalKey(FleetId),
  }),
]);
export type FleetAttachmentAnalysis = typeof FleetAttachmentAnalysis.Type;

export const FleetJobState = Schema.Literals(["queued", "running", "succeeded", "failed"]);
export const FleetImportJob = Schema.Struct({
  id: Schema.String,
  workspaceId: WorkspaceId,
  filename: Schema.String,
  state: FleetJobState,
  attempts: Count,
  createdAt: Schema.String,
  updatedAt: Schema.String,
  error: Schema.NullOr(Schema.String),
  result: Schema.NullOr(FleetImportReceipt),
});
export type FleetImportJob = typeof FleetImportJob.Type;
const JobId = Schema.String.check(Schema.isPattern(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/));
export const FleetJobInput = Schema.Struct({ workspaceId: WorkspaceId, jobId: JobId });
export type FleetJobInput = typeof FleetJobInput.Type;
export const FleetJobRetryInput = Schema.Struct({ ...FleetJobInput.fields, idempotencyKey: CommandKey });
export type FleetJobRetryInput = typeof FleetJobRetryInput.Type;
export const FleetJobListInput = Schema.Struct({
  workspaceId: WorkspaceId,
  limit: Schema.optionalKey(Schema.Number.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 100 }))),
});
export const FleetJobPage = Schema.Struct({ workspaceId: WorkspaceId, jobs: Schema.Array(FleetImportJob) });
export const FleetRuntimeEvent = Schema.Union([
  Schema.Struct({ type: Schema.Literal("workspace-changed"), workspaceId: WorkspaceId, revision: Count }),
  Schema.Struct({ type: Schema.Literal("job-updated"), workspaceId: WorkspaceId, jobId: JobId, state: FleetJobState }),
]);
export type FleetRuntimeEvent = typeof FleetRuntimeEvent.Type;

/** New telemetry boundary only. Released Team API and Electron IPC contracts are unchanged. */
export const FleetEngineRequest = Schema.Struct({
  version: Schema.Literal(1),
  id: Schema.String.check(Schema.isBetweenLength(1, 100)),
  command: Schema.Union([
    Schema.Struct({ operation: Schema.Literal("health") }),
    Schema.Struct({ operation: Schema.Literal("prepareImport"), input: FleetPrepareInput }),
    Schema.Struct({ operation: Schema.Literal("analyzeAttachment"), input: FleetAttachmentInput }),
    Schema.Struct({ operation: Schema.Literal("listReadings"), input: FleetListInput }),
    Schema.Struct({ operation: Schema.Literal("queryFleet"), input: FleetExplorerInput }),
    Schema.Struct({ operation: Schema.Literal("fleetReport"), input: FleetReportInput }),
    Schema.Struct({ operation: Schema.Literal("confirmImport"), input: FleetConfirmInput }),
    Schema.Struct({ operation: Schema.Literal("editReading"), input: FleetEditInput }),
    Schema.Struct({ operation: Schema.Literal("queueImport"), input: FleetConfirmInput }),
    Schema.Struct({ operation: Schema.Literal("jobStatus"), input: FleetJobInput }),
    Schema.Struct({ operation: Schema.Literal("listJobs"), input: FleetJobListInput }),
    Schema.Struct({ operation: Schema.Literal("retryJob"), input: FleetJobRetryInput }),
  ]),
});
export type FleetEngineRequest = typeof FleetEngineRequest.Type;

export const FleetEngineResponse = Schema.Union([
  Schema.Struct({
    version: Schema.Literal(1),
    id: Schema.String,
    ok: Schema.Literal(true),
    value: Schema.Union([
      FleetPreview,
      FleetReadingPage,
      FleetExplorerPage,
      FleetReport,
      FleetAttachmentAnalysis,
      FleetImportReceipt,
      FleetEditReceipt,
      FleetImportJob,
      FleetJobPage,
      Schema.Struct({
        ready: Schema.Boolean,
        capabilities: Schema.Array(Schema.String),
        persistence: Schema.Boolean,
        databaseScope: Schema.optionalKey(Schema.String),
      }),
    ]),
  }),
  Schema.Struct({
    version: Schema.Literal(1),
    id: Schema.NullOr(Schema.String),
    ok: Schema.Literal(false),
    error: Schema.Struct({ code: Schema.String, message: Schema.String }),
  }),
]);
