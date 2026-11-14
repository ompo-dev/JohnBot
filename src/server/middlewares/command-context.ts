import { idempotencyKey, readCommandBody } from "../http/request";
import { readSession } from "../http/session";

/** The shared HTTP boundary: validate the command envelope before resolving its demo session. */
export async function readCommandContext(request: Request) {
  const key = idempotencyKey(request);
  const { payload } = await readCommandBody(request);
  const session = await readSession();
  return { key, payload, session };
}
