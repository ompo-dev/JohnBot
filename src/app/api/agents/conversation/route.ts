import { errorResponse, successResponse } from "../../../../server/http/responses";
import { requestId } from "../../../../server/http/request";
import { readSession } from "../../../../server/http/session";
import { readAgentDomain, readAgentPage } from "../../../../server/services/agents";
import { cachedDataQuery } from "../../../../server/cache/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request): Promise<Response> {
  const id = requestId(request);
  try {
    const session = await readSession();
    const url = new URL(request.url);
    const agentId = url.searchParams.get("agentId") ?? "";
    if (
      url.searchParams.has("limit") ||
      url.searchParams.has("before") ||
      url.searchParams.has("around")
    ) {
      return successResponse(
        await cachedDataQuery(session.sessionId, url.pathname + url.search, () =>
          readAgentPage(session.sessionId, {
            agentId,
            before: url.searchParams.get("before") ?? undefined,
            around: url.searchParams.get("around") ?? undefined,
            limit: Number(url.searchParams.get("limit") ?? 50),
          }),
        ),
        { requestId: id, session },
      );
    }
    return successResponse(
      await cachedDataQuery(session.sessionId, url.pathname + url.search, () =>
        readAgentDomain(session.sessionId, "conversation", agentId),
      ),
      {
        requestId: id,
        session,
      },
    );
  } catch (error) {
    return errorResponse(error, id);
  }
}
