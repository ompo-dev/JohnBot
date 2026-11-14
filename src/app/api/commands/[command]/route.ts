import { findCommand, runRegisteredCommand } from "../../../../server/commands";
import { ApiError } from "../../../../server/errors";
import { errorResponse, successResponse } from "../../../../server/http/responses";
import { requestId } from "../../../../server/http/request";
import { readCommandContext } from "../../../../server/middlewares/command-context";
import { readOperations } from "../../../../server/services/operations";
import { operationsProjection } from "../../../../lib/operations-model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ command: string }> },
): Promise<Response> {
  const id = requestId(request);
  try {
    const { command } = await context.params;
    const definition = findCommand(command);
    if (!definition) {
      throw new ApiError(404, "not_found", "Unknown command.");
    }
    const { key, payload, session } = await readCommandContext(request);
    const result = await runRegisteredCommand(definition, {
      sessionId: session.sessionId,
      command,
      idempotencyKey: key,
      payload,
      signal: request.signal,
    });
    // An idempotent write must not replay a projection authorized for a previous simulation persona.
    const data = (command === "operations.change" || command === "dashboards.compose") && result.replayed
      ? operationsProjection(await readOperations(session.sessionId)) : result.data;
    return successResponse(data, {
      requestId: id,
      session,
      replayed: result.replayed,
    });
  } catch (error) {
    return errorResponse(error, id);
  }
}
