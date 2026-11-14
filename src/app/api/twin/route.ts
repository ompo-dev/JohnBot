import { errorResponse, successResponse } from "../../../server/http/responses";
import { requestId } from "../../../server/http/request";
import { getDatabase } from "../../../server/database/client";
import { twinDataSchema } from "../../../contracts/twin-data";
import { readSession } from "../../../server/http/session";
import { readOperations } from "../../../server/services/operations";
import { operationsProjection } from "../../../lib/operations-model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The factory twin: nodes, links, notebooks and access exceptions, straight from PostgreSQL. */
export async function GET(request: Request): Promise<Response> {
  const id = requestId(request);
  try {
    const session = await readSession();
    const database = getDatabase();
    const [nodes, edges, accessExceptions] = await Promise.all([
      database.twinNode.findMany({ orderBy: [{ position: "asc" }, { id: "asc" }] }),
      database.twinEdge.findMany({ orderBy: [{ from: "asc" }, { to: "asc" }] }),
      database.twinAccessException.findMany({ orderBy: { id: "asc" } }),
    ]);

    const operations = operationsProjection(await readOperations(session.sessionId));
    const people = new Map(operations.people.map((person) => [person.id, person]));
    const organizationalEdges = operations.people.flatMap((person) => [
      ...person.sectorIds.map((id) => ({ from: person.id, to: id, label: "pertence" })),
      ...person.roleIds.map((id) => ({ from: person.id, to: id, label: "ocupa" })),
      ...person.reportsTo.map((id) => ({ from: person.id, to: id, label: "reporta" })),
    ]);
    const data = twinDataSchema.parse({
      nodes: nodes.map((node) => ({
        id: node.id,
        kind: node.kind,
        name: people.get(node.id)?.name ?? node.name,
        detail: node.detail,
        dept: people.get(node.id)?.sectorIds[0] ?? node.dept,
        status: node.status,
      })),
      edges: [...edges.filter((edge) => !people.has(edge.from) || !["ocupa", "pertence", "reporta"].includes(edge.label ?? ""))
        .map((edge) => ({ from: edge.from, to: edge.to, label: edge.label })), ...organizationalEdges],
      notebooks: operations.notebooks.map((notebook) => ({
        id: notebook.id,
        title: notebook.title,
        ownerKind: notebook.ownerKind === "sector" ? "department" : notebook.ownerKind === "machine" ? "equipment" : notebook.ownerKind,
        ownerId: notebook.ownerId,
        visibility: notebook.sectorIds.map((id) => operations.sectors.find((sector) => sector.id === id)?.name ?? id),
        entries: notebook.entries.map((entry) => ({
          id: entry.id,
          date: entry.createdAt,
          author: (operations.people.find((person) => person.id === entry.authorId)?.name ?? entry.authorId).slice(0, 200),
          text: `${entry.objective}\n\n${entry.result}`.slice(0, 8000),
          tags: [entry.importance, ...(entry.agentId ? ["agente"] : [])],
          links: entry.sourceRefs,
        })),
      })),
      accessExceptions: accessExceptions.map((exception) => ({
        id: exception.id,
        personId: exception.personId,
        scope: exception.scope,
        reason: exception.reason,
        expiresAt: exception.expiresAt?.toISOString() ?? null,
      })),
    });

    const response = successResponse(data, { requestId: id, session });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    return errorResponse(error, id);
  }
}
