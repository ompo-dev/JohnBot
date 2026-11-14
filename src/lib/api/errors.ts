import type { DataErrorCode } from "../../contracts/data-api";

export class ApiError extends Error {
  readonly status: number;
  readonly code: DataErrorCode | "network_error";
  readonly requestId: string | null;
  readonly retryAfterSeconds: number | undefined;
  readonly details: unknown;

  constructor(
    status: number,
    code: DataErrorCode | "network_error",
    message: string,
    options: { requestId?: string | null; retryAfterSeconds?: number; details?: unknown; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.requestId = options.requestId ?? null;
    this.retryAfterSeconds = options.retryAfterSeconds;
    this.details = options.details;
  }
}
