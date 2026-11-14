import { cachedDataQuery } from "./queries";
import {
  LOCAL_SERVER_ID,
  type WorkflowDetail,
  type WorkflowGraph,
  type WorkflowSummary,
  type WorkflowVersion,
} from "../../contracts/ipc";
import {
  workflowDetailSchema,
  workflowGraphSchema,
  workflowIdSchema,
  workflowListSchema,
  workflowServerIdSchema,
  workflowVersionsSchema,
} from "../../contracts/workflows-data";
import { readStore } from "../services/workflows";
async function cached(sessionId: string, serverId: string, operation: string, id: string) {
  const scope = workflowServerIdSchema.parse(serverId);
  return cachedDataQuery(
    sessionId,
    // v3: older projections bypassed the service's legacy-placeholder and copied-canvas repair.
    // Keep that stale Redis/Next entry isolated from this canonical read path.
    JSON.stringify(["workflow", "v4", scope, operation, id]),
    async () => {
      const records = await readStore(sessionId, scope);
      if (operation === "list")
        return workflowListSchema.parse(
          records
            .map((entry) => entry.detail.summary)
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
        );
      const [workflowId, versionId] = operation === "version-graph" ? id.split("/", 2) : [id, ""];
      const record = records.find((entry) => entry.detail.summary.id === workflowId);
      if (!record) throw new Error("Workflow was not found.");
      if (operation === "get") return workflowDetailSchema.parse(record.detail);
      if (operation === "versions")
        return workflowVersionsSchema.parse(
          record.versions.map(({ graph: _, ...version }) => version),
        );
      const version = record.versions.find((entry) => entry.id === versionId);
      if (!version) throw new Error("Workflow version was not found.");
      return workflowGraphSchema.parse(version.graph);
    },
  );
}
export const getCachedWorkflows = (session: string, server = LOCAL_SERVER_ID) =>
  cached(session, server, "list", "") as Promise<WorkflowSummary[]>;
export const getCachedWorkflow = (session: string, id: string, server = LOCAL_SERVER_ID) =>
  cached(session, server, "get", workflowIdSchema.parse(id)) as Promise<WorkflowDetail>;
export const getCachedWorkflowVersions = (session: string, id: string, server = LOCAL_SERVER_ID) =>
  cached(session, server, "versions", workflowIdSchema.parse(id)) as Promise<WorkflowVersion[]>;
export const getCachedWorkflowVersionGraph = (
  session: string,
  workflowId: string,
  versionId: string,
  server = LOCAL_SERVER_ID,
) =>
  cached(
    session,
    server,
    "version-graph",
    `${workflowIdSchema.parse(workflowId)}/${workflowIdSchema.parse(versionId)}`,
  ) as Promise<WorkflowGraph>;
