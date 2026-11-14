import { z } from "zod";

import {
  isWorkflowStepKind,
  type WorkflowDetail,
  type WorkflowGraph,
  type WorkflowSummary,
} from "../../contracts/ipc";
import { DEMO_OPTIONS } from "../../preview/demo-seed";
import {
  workflowDetailSchema,
  workflowGraphSchema,
  workflowIdSchema,
  workflowServerIdSchema,
} from "../../contracts/workflows-data";
import { readDomain, updateDomain } from "../repositories/domain-store";
import { invalidInput } from "../errors";
import { serverEnv } from "../config/env";
import { productFeatures } from "../../lib/product-features";
import { routineToGraph } from "../../lib/routine-unification";

const DOMAIN = "workflows-v1";

const recordSchema = z
  .object({
    detail: workflowDetailSchema,
    versions: z
      .array(
        z
          .object({
            id: workflowIdSchema,
            at: z.string(),
            kind: z.enum(["auto", "run", "restore"]),
            revision: z.number().int().nonnegative(),
            graph: workflowGraphSchema,
          })
          .strict(),
      )
      .max(50),
  })
  .strict();
const serverDataSchema = z
  .object({ serverId: workflowServerIdSchema, records: z.array(recordSchema).max(500), migratedRoutineIds: z.array(workflowIdSchema).max(500).default([]) })
  .strict();
const storeSchema = z.object({ servers: z.array(serverDataSchema).max(100) }).strict();
type Saved = z.infer<typeof recordSchema>;
type Store = z.infer<typeof storeSchema>;
type ServerData = z.infer<typeof serverDataSchema>;

const summary = (
  id: string,
  title: string,
  graph: WorkflowGraph,
  updatedAt: string,
): WorkflowSummary => ({
  id,
  title,
  steps: graph.nodes.filter((node) => isWorkflowStepKind(node.kind)).length,
  updatedAt,
  lastRun: null,
});
const detail = (
  id: string,
  title: string,
  graph: WorkflowGraph,
  revision: number,
  updatedAt: string,
): WorkflowDetail => ({
  summary: summary(id, title, graph, updatedAt),
  graph,
  revision,
  triggers: graph.nodes.flatMap((node) =>
    node.kind === "trigger" &&
    ["manual", "schedule", "webhook"].includes(String(node.fields.trigger ?? "manual"))
      ? [
          {
            nodeId: node.id,
            type: node.fields.trigger as "manual" | "schedule" | "webhook",
            nextDueAt: null,
            webhookUrl: null,
          },
        ]
      : [],
  ),
});
const demoRecords = (): Saved[] =>
  (DEMO_OPTIONS.workflows ?? []).map((workflow) => ({
    detail: detail(
      workflow.id,
      workflow.title,
      workflow.graph,
      0,
      workflow.updatedAt ?? new Date(0).toISOString(),
    ),
    versions: [],
  }));
const seed = (): Store => ({ servers: [] });
function repairFactoryWorkflowCopies(records: Saved[]): Saved[] {
  const factory = demoRecords();
  const byId = new Map(factory.map((record) => [record.detail.summary.id, record]));
  const outdated = records.filter((record) => byId.has(record.detail.summary.id));
  // Factory graphs were formerly persisted as short, copied linear flows. Replace only those legacy
  // records; later user edits have more than five nodes and stay authoritative.
  const copied = new Set(outdated.map((record) => JSON.stringify(record.detail.graph))).size === 1;
  if (!outdated.length || (!copied && !outdated.every((record) => record.detail.graph.nodes.length <= 5))) return records;
  return records.map((record) => byId.get(record.detail.summary.id) ?? record);
}
function recordsFor(store: Store, serverId: string): Saved[] {
  const records = store.servers.find((entry) => entry.serverId === serverId)?.records;
  // Early PostgreSQL workspaces stored only the blank workflow created before factory fixtures existed.
  const onlyLegacyPlaceholders = records?.length !== undefined && records.length > 0 && records.every(
    (record) => record.detail.graph.nodes.length === 0 && /^(Fluxo de trabalho sem título|Untitled workflow)$/.test(record.detail.summary.title),
  );
  if (!records?.length || onlyLegacyPlaceholders) return demoRecords();
  const repaired = repairFactoryWorkflowCopies(records).map((record) => ({ ...record, detail: { ...record.detail,
    graph: { ...record.detail.graph, nodes: record.detail.graph.nodes.map((node) => ({ ...node, fields: { ...node.fields,
      ...(node.kind === "agent" && !node.fields.task && node.fields.text ? { task: node.fields.text } : {}),
      ...(node.kind === "llm" && !node.fields.prompt && node.fields.text ? { prompt: node.fields.text } : {}),
      ...(node.kind === "condition" && !node.fields.rule && node.fields.expression ? { rule: node.fields.expression } : {}),
      ...(node.kind === "approval" && !node.fields.question && node.fields.title ? { question: node.fields.title } : {}),
    } })), edges: record.detail.graph.edges.map((edge) => record.detail.summary.id === "wf-machine-downtime-csv" && !edge.branch
      ? { ...edge, ...(["csv-e4", "csv-e12"].includes(edge.id) ? { branch: "no" as const } : ["csv-e5", "csv-e11"].includes(edge.id) ? { branch: "yes" as const } : {}) }
      : edge),
    },
  } }));
  const csv = demoRecords().find((record) => record.detail.summary.id === "wf-machine-downtime-csv")!;
  return repaired.some((record) => record.detail.summary.id === csv.detail.summary.id)
    ? repaired.map((record) => record.detail.summary.id === csv.detail.summary.id && record.detail.graph.nodes.some((node) => node.id === "csv-source") ? csv : record)
    : [...repaired, csv];
}
function replaceRecords(store: Store, serverId: string, records: Saved[]): Store {
  const value: ServerData = { serverId, records, migratedRoutineIds: store.servers.find((entry) => entry.serverId === serverId)?.migratedRoutineIds ?? [] };
  return {
    servers: store.servers.some((entry) => entry.serverId === serverId)
      ? store.servers.map((entry) => (entry.serverId === serverId ? value : entry))
      : [...store.servers, value],
  };
}
function find(records: Saved[], id: string): Saved {
  const value = records.find((entry) => entry.detail.summary.id === id);
  if (!value) throw invalidInput("Workflow was not found.");
  return value;
}
async function readStore(sessionId: string, serverId: string) {
  const store = await readDomain(sessionId, DOMAIN, storeSchema, seed);
  const records = recordsFor(store, serverId);
  const saved = store.servers.find((server) => server.serverId === serverId);
  const legacy = productFeatures.unifiedRoutines && serverId === "local" ? Object.values(DEMO_OPTIONS.routines ?? {}).flat() : [];
  if (JSON.stringify(saved?.records) === JSON.stringify(records) && legacy.every((routine) => saved?.migratedRoutineIds.includes(routine.id))) return records;
  const updated = await updateDomain(sessionId, DOMAIN, storeSchema, seed, (current) => {
    const previous = current.servers.find((server) => server.serverId === serverId);
    const migrated = new Set(previous?.migratedRoutineIds ?? []);
    const canonical = recordsFor(current, serverId);
    const existing = new Set(canonical.map((record) => record.detail.summary.id));
    const additions = legacy.filter((routine) => !migrated.has(routine.id) && !existing.has(routine.id)).map((routine) => ({
      detail: detail(routine.id, routine.name, routineToGraph(routine, DEMO_OPTIONS.routineFlowLinks), 0, routine.updatedAt), versions: [],
    }));
    const next = replaceRecords(current, serverId, [...canonical, ...additions]);
    next.servers.find((server) => server.serverId === serverId)!.migratedRoutineIds = [...new Set([...migrated, ...legacy.map((routine) => routine.id)])];
    return next;
  });
  return updated.servers.find((server) => server.serverId === serverId)!.records;
}

export {
  detail,
  recordsFor,
  replaceRecords,
  find,
  readStore,
  DOMAIN as workflowsDomain,
  storeSchema as workflowsStoreSchema,
  seed as seedWorkflows,
  demoRecords as seedWorkflowsForServer,
};
