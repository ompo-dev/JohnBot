import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { DATA_CACHE_HEADER, REQUEST_ID_HEADER } from "../../contracts/data-api";
import { apiErrorFromUnknown, errorBody, invalidInput } from "../errors";
import { attachSessionCookie, type Session } from "./session";

export function successResponse(
  data: unknown,
  options: { requestId: string; session?: Session; generatedAt?: number; replayed?: boolean },
): NextResponse {
  const response = NextResponse.json({ ok: true, data });
  response.headers.set(REQUEST_ID_HEADER, options.requestId);
  if (options.generatedAt !== undefined) {
    response.headers.set(DATA_CACHE_HEADER, String(options.generatedAt));
  }
  if (options.replayed) response.headers.set("idempotency-replayed", "true");
  if (options.session) attachSessionCookie(response, options.session);
  return response;
}

export function errorResponse(error: unknown, id: string): NextResponse {
  if (error instanceof ZodError) {
    const mapped = invalidInput("The request payload is invalid.", error.issues);
    return NextResponse.json(errorBody(mapped, id), { status: mapped.status });
  }
  const mapped = apiErrorFromUnknown(error);
  const response = NextResponse.json(errorBody(mapped, id), { status: mapped.status });
  response.headers.set(REQUEST_ID_HEADER, id);
  if (mapped.retryAfterSeconds !== undefined) {
    response.headers.set("retry-after", String(mapped.retryAfterSeconds));
  }
  return response;
}
