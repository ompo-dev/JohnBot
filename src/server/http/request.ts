import {
  IDEMPOTENCY_HEADER,
  idempotencyKeySchema,
  REQUEST_ID_HEADER,
} from "../../contracts/data-api";
import { invalidInput } from "../errors";

export function requestId(request: Request): string {
  const provided = request.headers.get(REQUEST_ID_HEADER);
  return provided && provided.length <= 200 ? provided : crypto.randomUUID();
}

export function idempotencyKey(request: Request): string {
  const raw = request.headers.get(IDEMPOTENCY_HEADER);
  const parsed = idempotencyKeySchema.safeParse(raw);
  if (!parsed.success) {
    throw invalidInput(
      "A valid Idempotency-Key header (8-128 characters: letters, digits, . _ : -) is required.",
    );
  }
  return parsed.data;
}

export async function readCommandBody(request: Request): Promise<{ payload: unknown }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw invalidInput("The request body must be JSON.");
  }
  if (!body || typeof body !== "object" || !("payload" in body)) {
    throw invalidInput("The request body must contain a payload field.");
  }
  return { payload: (body as { payload: unknown }).payload };
}
