import { ApiError } from "../../../../../server/errors";
import { errorResponse, successResponse } from "../../../../../server/http/responses";
import { requestId } from "../../../../../server/http/request";
import { getMarketplaceAgent, getMarketplaceListing } from "../../../../../server/cache/marketplace";
import { readSession } from "../../../../../server/http/session";
import { cachedDataQuery } from "../../../../../server/cache/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const id = requestId(request);
  try {
    const session = await readSession();
    const { id: agentId } = await context.params;
    const data = await cachedDataQuery(session.sessionId, request.url, async () =>
      new URL(request.url).searchParams.get("listing") === "1"
        ? await getMarketplaceListing(agentId, session.sessionId)
        : await getMarketplaceAgent(agentId, session.sessionId),
    );
    if (!data) throw new ApiError(404, "not_found", "Marketplace agent not found.");
    return successResponse(data, { requestId: id, session });
  } catch (error) {
    return errorResponse(error, id);
  }
}
