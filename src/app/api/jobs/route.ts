import { errorResponse, successResponse } from "../../../server/http/responses";
import { requestId } from "../../../server/http/request";
import { listJobs } from "../../../server/jobs/service";
import { readSession } from "../../../server/http/session";
import { jobsPageSchema } from "../../../contracts/jobs";
import { cachedDataQuery } from "../../../server/cache/queries";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request): Promise<Response> {
  const id = requestId(request);
  try {
    const session = await readSession();
    const data = jobsPageSchema.parse(
      await cachedDataQuery(session.sessionId, `jobs:${new URL(request.url).search}`, () =>
        listJobs(session.sessionId, Object.fromEntries(new URL(request.url).searchParams)),
      ),
    );
    return successResponse(data, { requestId: id, session });
  } catch (error) {
    return errorResponse(error, id);
  }
}
