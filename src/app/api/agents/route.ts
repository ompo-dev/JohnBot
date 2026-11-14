import { cachedDataQuery } from "../../../server/cache/queries";

import { errorResponse, successResponse } from "../../../server/http/responses";
import { requestId } from "../../../server/http/request";
import { readSession } from "../../../server/http/session";
import { readAgentDomain } from "../../../server/services/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request): Promise<Response> {
  const id = requestId(request);
  try {
    const session = await readSession();
    const url = new URL(request.url);
    const domain = url.searchParams.get("domain") ?? "";
    const agentId = url.searchParams.get("agentId") ?? undefined;
    const data = await cachedDataQuery(session.sessionId, url.pathname + url.search, () =>
      readAgentDomain(session.sessionId, domain, agentId),
    );
    return successResponse(data, { requestId: id, session });
  } catch (error) {
    return errorResponse(error, id);
  }
}
