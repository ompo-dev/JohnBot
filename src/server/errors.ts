import type { DataErrorBody, DataErrorCode } from "../contracts/data-api";

export class ApiError extends Error {
  readonly status: number;
  readonly code: DataErrorCode;
  readonly retryAfterSeconds: number | undefined;
  readonly details: unknown;

  constructor(
    status: number,
    code: DataErrorCode,
    message: string,
    options: { retryAfterSeconds?: number; details?: unknown; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = options.retryAfterSeconds;
    this.details = options.details;
  }
}

export function storageUnavailable(cause?: unknown): ApiError {
  return new ApiError(503, "storage_unavailable", "The data store is unavailable.", { cause });
}

export function invalidInput(message = "The request payload is invalid.", details?: unknown): ApiError {
  return new ApiError(400, "invalid_input", message, { details });
}

export function cancelled(): ApiError {
  return new ApiError(499, "cancelled", "The request was cancelled.");
}

export function errorBody(error: ApiError, requestId: string): DataErrorBody {
  return {
    ok: false,
    error: {
      code: error.code,
      message: error.message,
      requestId,
      ...(error.retryAfterSeconds === undefined ? {} : { retryAfterSeconds: error.retryAfterSeconds }),
      ...(error.details === undefined ? {} : { details: error.details }),
    },
  };
}

export function apiErrorFromUnknown(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof DOMException && error.name === "AbortError") {
    return new ApiError(499, "cancelled", "The request was cancelled.", { cause: error });
  }
  return new ApiError(500, "internal_error", "The request failed.", { cause: error });
}
