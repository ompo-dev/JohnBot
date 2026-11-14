import { errorResponse, successResponse } from "../../../server/http/responses";
import { requestId } from "../../../server/http/request";
import { readSession } from "../../../server/http/session";
import { cachedDataQuery } from "../../../server/cache/queries";
import { readSidebar, readMemories } from "../../../server/services/workspace-ui";
import { entityIdSchema } from "../../../contracts/workspace-data";
import { invalidInput } from "../../../server/errors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const session = await readSession();
    const url = new URL(request.url);
    const resource = url.searchParams.get("resource");
    if (resource !== "sidebar" && resource !== "memories") throw invalidInput("Unknown workspace resource.");
    const agentId = resource === "memories" ? entityIdSchema.parse(url.searchParams.get("agentId")) : "";
    const data = await cachedDataQuery<unknown>(session.sessionId, url.pathname + url.search,
      () => resource === "sidebar" ? readSidebar(session.sessionId) : readMemories(session.sessionId, agentId));
    return successResponse(data, { requestId: id, session });
  } catch (error) { return errorResponse(error, id); }
}
