import { getCachedUsage } from "../../../server/cache/app";
import { errorResponse, successResponse } from "../../../server/http/responses";
import { requestId } from "../../../server/http/request";
import { readSession } from "../../../server/http/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const id = requestId(request);
  try {
    const session = await readSession();
    const agentId = new URL(request.url).searchParams.get("agentId");
    const cached = await getCachedUsage(session.sessionId, agentId ? agentId.slice(0, 200) : null);
    return successResponse(cached.data, {
      requestId: id,
      session,
      generatedAt: cached.generatedAt,
    });
  } catch (error) {
    return errorResponse(error, id);
  }
}
