import { cachedDataQuery } from "../../../server/cache/queries";

import { errorResponse, successResponse } from "../../../server/http/responses";
import { requestId } from "../../../server/http/request";
import { readSession } from "../../../server/http/session";
import { readPreferencesData } from "../../../server/services/preferences";
import { preferencesDataSchema } from "../../../contracts/preferences-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const id = requestId(request);
  try {
    const session = await readSession();
    const data = preferencesDataSchema.parse(
      await cachedDataQuery(session.sessionId, "preferences", () =>
        readPreferencesData(session.sessionId),
      ),
    );
    return successResponse(data, { requestId: id, session });
  } catch (error) {
    return errorResponse(error, id);
  }
}
