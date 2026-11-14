import { errorResponse, successResponse } from "../../../server/http/responses";
import { requestId } from "../../../server/http/request";
import { readSession } from "../../../server/http/session";
import { readConnectorPreview } from "../../../server/services/connector-preview";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request): Promise<Response> {
  const id = requestId(request);
  try {
    const connectorId = z
      .string()
      .regex(/^[\w-]{1,64}$/u)
      .parse(new URL(request.url).searchParams.get("connector"));
    const session = await readSession();
    const response = successResponse(await readConnectorPreview(session.sessionId, connectorId), {
      requestId: id,
      session,
    });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    return errorResponse(error, id);
  }
}
