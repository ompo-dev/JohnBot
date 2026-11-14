import { marketplaceListQuerySchema } from "../../../../contracts/marketplace-data";
import { errorResponse, successResponse } from "../../../../server/http/responses";
import { requestId } from "../../../../server/http/request";
import { getMarketplacePage } from "../../../../server/cache/marketplace";
import { readSession } from "../../../../server/http/session";
import { cachedDataQuery } from "../../../../server/cache/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const id = requestId(request);
  try {
    const session = await readSession();
    const parsed = marketplaceListQuerySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (!parsed.success) return errorResponse(parsed.error, id);
    const data = await cachedDataQuery(session.sessionId, request.url, () =>
      getMarketplacePage(session.sessionId, parsed.data),
    );
    return successResponse(data, { requestId: id, session });
  } catch (error) {
    return errorResponse(error, id);
  }
}
