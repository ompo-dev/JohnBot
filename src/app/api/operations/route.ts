import { errorResponse, successResponse } from "../../../server/http/responses";
import { requestId } from "../../../server/http/request";
import { readSession } from "../../../server/http/session";
import { cachedDataQuery } from "../../../server/cache/queries";
import { readOperations } from "../../../server/services/operations";
import { operationsProjection } from "../../../lib/operations-model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const id = requestId(request);
  try {
    const session = await readSession();
    const state = await cachedDataQuery(session.sessionId, "operations", () =>
      readOperations(session.sessionId),
    );
    // Evaluate expiry on every read, outside Next/Redis projection caches.
    const response = successResponse(operationsProjection(state), { requestId: id, session });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    return errorResponse(error, id);
  }
}
