import { errorResponse, successResponse } from "../../../server/http/responses";
import { requestId } from "../../../server/http/request";
import { readSession } from "../../../server/http/session";
import { readExternalIntegrations } from "../../../server/services/external-integrations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const id = requestId(request);
  try {
    const session = await readSession();
    return successResponse(await readExternalIntegrations(), { requestId: id, session });
  } catch (error) {
    return errorResponse(error, id);
  }
}
