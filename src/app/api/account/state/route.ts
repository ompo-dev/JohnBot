import { cachedDataQuery } from "../../../../server/cache/queries";

import { errorResponse, successResponse } from "../../../../server/http/responses";
import { requestId } from "../../../../server/http/request";
import { loadSnapshot } from "../../../../server/repositories/session-store";
import { readSession } from "../../../../server/http/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const id = requestId(request);
  try {
    const session = await readSession();
    const snapshot = await cachedDataQuery(session.sessionId, "session", () =>
      loadSnapshot(session.sessionId),
    );
    return successResponse(snapshot.auth, { requestId: id, session });
  } catch (error) {
    return errorResponse(error, id);
  }
}
