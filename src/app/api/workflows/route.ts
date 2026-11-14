import { errorResponse, successResponse } from "../../../server/http/responses";
import { requestId } from "../../../server/http/request";
import { readSession } from "../../../server/http/session";
import { invalidInput } from "../../../server/errors";
import {
  getCachedWorkflow,
  getCachedWorkflows,
  getCachedWorkflowVersionGraph,
  getCachedWorkflowVersions,
} from "../../../server/cache/workflows";
import {
  workflowIdSchema,
  workflowServerIdSchema,
  workflowDetailSchema,
} from "../../../contracts/workflows-data";
import { LOCAL_SERVER_ID } from "../../../contracts/ipc";
import { readWorkflowRuns } from "../../../server/services/workspace-ui";
import { cachedDataQuery } from "../../../server/cache/queries";
import { readStore } from "../../../server/services/workflows";
import { workflowToRoutine } from "../../../lib/routine-unification";
import { unifiedRoutineListSchema } from "../../../contracts/unified-routines";
import { readRoutineCanvas } from "../../../server/services/routine-canvas";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request): Promise<Response> {
  const id = requestId(request);
  try {
    const session = await readSession(),
      url = new URL(request.url),
      op = url.searchParams.get("op") ?? "list",
      serverId = workflowServerIdSchema.parse(url.searchParams.get("serverId") ?? LOCAL_SERVER_ID);
    let data: unknown;
    if (op === "list") data = await getCachedWorkflows(session.sessionId, serverId);
    else if (op === "routine-graphs") {
      data = await cachedDataQuery(
        session.sessionId,
        JSON.stringify(["workflow", "routine-graphs", serverId]),
        async () =>
          workflowDetailSchema
            .array()
            .parse((await readStore(session.sessionId, serverId)).map((record) => record.detail)),
      );
    } else if (op === "routine-canvas") {
      const agentId = workflowIdSchema.parse(url.searchParams.get("agentId") ?? "");
      data = await cachedDataQuery(
        session.sessionId,
        JSON.stringify(["routine-canvas", serverId, agentId]),
        () => readRoutineCanvas(session.sessionId, serverId, agentId),
      );
    } else if (op === "routines") {
      const agentId = workflowIdSchema.parse(url.searchParams.get("agentId") ?? "");
      data = await cachedDataQuery(
        session.sessionId,
        JSON.stringify(["workflow", "routines", serverId, agentId]),
        async () =>
          unifiedRoutineListSchema.parse(
            (await readStore(session.sessionId, serverId)).flatMap((record) => {
              const routine = workflowToRoutine(record.detail);
              return routine?.agentId === agentId ? [routine] : [];
            }),
          ),
      );
    } else {
      const workflowId = workflowIdSchema.parse(url.searchParams.get("workflowId") ?? "");
      if (op === "get") data = await getCachedWorkflow(session.sessionId, workflowId, serverId);
      else if (op === "runs") {
        await getCachedWorkflow(session.sessionId, workflowId, serverId);
        data = await cachedDataQuery(
          session.sessionId,
          `workflow-runs:${serverId}:${workflowId}`,
          () => readWorkflowRuns(session.sessionId, serverId, workflowId),
        );
      } else if (op === "versions")
        data = await getCachedWorkflowVersions(session.sessionId, workflowId, serverId);
      else if (op === "version-graph")
        data = await getCachedWorkflowVersionGraph(
          session.sessionId,
          workflowId,
          url.searchParams.get("versionId") ?? "",
          serverId,
        );
      else throw invalidInput("Unknown workflows read operation.");
    }
    return successResponse(data, { requestId: id, session });
  } catch (error) {
    return errorResponse(error, id);
  }
}
