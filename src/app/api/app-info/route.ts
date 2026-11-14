import { getCachedAppInfo } from "../../../server/cache/app";
import { errorResponse, successResponse } from "../../../server/http/responses";
import { requestId } from "../../../server/http/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const id = requestId(request);
  try {
    const cached = await getCachedAppInfo();
    return successResponse(cached.data, { requestId: id, generatedAt: cached.generatedAt });
  } catch (error) {
    return errorResponse(error, id);
  }
}
