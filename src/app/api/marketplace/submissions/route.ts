import { cachedDataQuery } from "../../../../server/cache/queries";

import { marketplaceSubmissionsSchema } from "../../../../contracts/marketplace-data";
import { errorResponse, successResponse } from "../../../../server/http/responses";
import { requestId } from "../../../../server/http/request";
import { readMarketplace } from "../../../../server/services/marketplace";
import { readSession } from "../../../../server/http/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const id = requestId(request);
  try {
    const session = await readSession();
    const state = await cachedDataQuery(session.sessionId, "marketplace-submissions", () =>
      readMarketplace(session.sessionId),
    );
    return successResponse(marketplaceSubmissionsSchema.parse(state.submissions), {
      requestId: id,
      session,
    });
  } catch (error) {
    return errorResponse(error, id);
  }
}
