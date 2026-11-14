import { z } from "zod";
import { workflowSimulationSchema, workflowRunPageSchema } from "../../contracts/workspace-ui";
import { productFeatures } from "../../lib/product-features";
import { recordRoutineOutcome } from "../services/operations";
import { csvRunInputSchema, csvRunResultSchema, executeMachineDowntime } from "../services/machine-downtime";
import { revalidateTag } from "next/cache";
import { LOCAL_SERVER_ID, type WorkflowSummary, type WorkflowGraph } from "../../contracts/ipc";
import {
  workflowCreateSchema,
  workflowDetailSchema,
  workflowGraphSchema,
  workflowIdSchema,
  workflowListSchema,
  workflowRenameSchema,
  workflowSaveResultSchema,
  workflowSaveSchema,
  workflowServerIdSchema,
  workflowVersionsSchema,
  workflowVersionInputSchema,
  workflowSummarySchema,
} from "../../contracts/workflows-data";
import { updateDomain } from "../repositories/domain-store";
import { ApiError, invalidInput } from "../errors";
import type { CommandDefinition, RegisteredCommand } from "./types";
import {
  workflowsDomain as DOMAIN,
  workflowsStoreSchema as storeSchema,
  seedWorkflows as seed,
  detail,
  recordsFor,
  replaceRecords,
  find,
  readStore,
} from "../services/workflows";

const scoped = <T extends z.ZodType>(payload: T) =>
  z.object({ serverId: workflowServerIdSchema.default(LOCAL_SERVER_ID), payload }).strict();
const emptyGraph: WorkflowGraph = { nodes: [], edges: [], strokes: [] };
const invalidate = (sessionId: string, serverId: string) =>
  revalidateTag(`workflows:${sessionId}:${serverId}`, { expire: 0 });

const list: CommandDefinition = {
  payloadSchema: scoped(z.object({}).strict()),
  resultSchema: workflowListSchema,
  run: async (ctx, raw) => {
    const { serverId } = scoped(z.object({}).strict()).parse(raw);
    return workflowListSchema.parse(
      (await readStore(ctx.sessionId, serverId))
        .map((item) => item.detail.summary)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    );
  },
};
const get: CommandDefinition = {
  payloadSchema: scoped(workflowIdSchema),
  resultSchema: workflowDetailSchema,
  run: async (ctx, raw) => {
    const { serverId, payload } = scoped(workflowIdSchema).parse(raw);
    return find(await readStore(ctx.sessionId, serverId), payload).detail;
  },
};
const create: CommandDefinition = {
  payloadSchema: scoped(workflowCreateSchema),
  resultSchema: workflowDetailSchema,
  run: async (ctx, raw) => {
    const { serverId, payload } = scoped(workflowCreateSchema).parse(raw),
      id = payload.id ?? crypto.randomUUID(),
      now = new Date().toISOString(),
      value = detail(id, payload.title, payload.graph ?? emptyGraph, 0, now);
    await updateDomain(ctx.sessionId, DOMAIN, storeSchema, seed, (store) => {
      if (recordsFor(store, serverId).some((entry) => entry.detail.summary.id === id))
        throw new ApiError(409, "conflict", "Workflow ID already exists.");
      return replaceRecords(store, serverId, [
        ...recordsFor(store, serverId),
        { detail: value, versions: [] },
      ]);
    });
    invalidate(ctx.sessionId, serverId);
    return value;
  },
};
const rename: CommandDefinition = {
  payloadSchema: scoped(workflowRenameSchema),
  resultSchema: workflowSummarySchema,
  run: async (ctx, raw) => {
    const { serverId, payload } = scoped(workflowRenameSchema).parse(raw),
      now = new Date().toISOString();
    let result!: WorkflowSummary;
    await updateDomain(ctx.sessionId, DOMAIN, storeSchema, seed, (store) => {
      const records = recordsFor(store, serverId),
        old = find(records, payload.workflowId),
        next = detail(
          payload.workflowId,
          payload.title,
          old.detail.graph,
          old.detail.revision,
          now,
        );
      result = next.summary;
      return replaceRecords(
        store,
        serverId,
        records.map((entry) => (entry === old ? { ...old, detail: next } : entry)),
      );
    });
    invalidate(ctx.sessionId, serverId);
    return result;
  },
};
const remove: CommandDefinition = {
  payloadSchema: scoped(workflowIdSchema),
  resultSchema: z.null(),
  run: async (ctx, raw) => {
    const { serverId, payload } = scoped(workflowIdSchema).parse(raw);
    await updateDomain(ctx.sessionId, DOMAIN, storeSchema, seed, (store) =>
      replaceRecords(
        store,
        serverId,
        recordsFor(store, serverId).filter((entry) => entry.detail.summary.id !== payload),
      ),
    );
    invalidate(ctx.sessionId, serverId);
    return null;
  },
};
const saveGraph: CommandDefinition = {
  payloadSchema: scoped(workflowSaveSchema),
  resultSchema: workflowSaveResultSchema,
  run: async (ctx, raw) => {
    const { serverId, payload } = scoped(workflowSaveSchema).parse(raw),
      now = new Date().toISOString(),
      versionId = crypto.randomUUID();
    let result!: ReturnType<typeof workflowSaveResultSchema.parse>;
    await updateDomain(ctx.sessionId, DOMAIN, storeSchema, seed, (store) => {
      const records = recordsFor(store, serverId),
        old = find(records, payload.workflowId);
      if (old.detail.revision !== payload.baseRevision) {
        result = { ok: false, conflict: old.detail };
        return store;
      }
      const next = detail(
          payload.workflowId,
          old.detail.summary.title,
          payload.graph,
          old.detail.revision + 1,
          now,
        ),
        last = old.versions[0],
        versions =
          !last || Date.now() - Date.parse(last.at) >= 5 * 60_000
            ? [
                {
                  id: versionId,
                  at: now,
                  kind: "auto" as const,
                  revision: next.revision,
                  graph: payload.graph,
                },
                ...old.versions,
              ].slice(0, 50)
            : old.versions;
      result = { ok: true, revision: next.revision };
      return replaceRecords(
        store,
        serverId,
        records.map((entry) => (entry === old ? { detail: next, versions } : entry)),
      );
    });
    if (result.ok) invalidate(ctx.sessionId, serverId);
    return result;
  },
};
const versions: CommandDefinition = {
  payloadSchema: scoped(workflowIdSchema),
  resultSchema: workflowVersionsSchema,
  run: async (ctx, raw) => {
    const { serverId, payload } = scoped(workflowIdSchema).parse(raw);
    return workflowVersionsSchema.parse(
      find(await readStore(ctx.sessionId, serverId), payload).versions.map(
        ({ graph: _, ...version }) => version,
      ),
    );
  },
};
const versionGraph: CommandDefinition = {
  payloadSchema: scoped(workflowVersionInputSchema),
  resultSchema: workflowGraphSchema,
  run: async (ctx, raw) => {
    const { serverId, payload } = scoped(workflowVersionInputSchema).parse(raw),
      entry = find(await readStore(ctx.sessionId, serverId), payload.workflowId).versions.find(
        (version) => version.id === payload.versionId,
      );
    if (!entry) throw invalidInput("Workflow version was not found.");
    return entry.graph;
  },
};
export const WORKFLOWS_DATA_COMMANDS: Readonly<Record<string, RegisteredCommand>> = {
  "workflows.run-csv": { payloadSchema: csvRunInputSchema, resultSchema: csvRunResultSchema, idempotent: true,
    run: async (ctx, raw) => {
      const result = await executeMachineDowntime(ctx.sessionId, csvRunInputSchema.parse(raw));
      await recordRoutineOutcome(ctx.sessionId, "Machine Downtime · Bronze, Prata e Ouro", result, "local");
      return result;
    },
  },
  "workflows.save-simulation": {
    payloadSchema: workflowSimulationSchema, resultSchema: workflowRunPageSchema, idempotent: true,
    run: async (ctx, raw) => {
      if (!productFeatures.workflowSimulation) throw invalidInput("Simulação desabilitada.");
      const { serverId, workflowId, page } = workflowSimulationSchema.parse(raw);
      const workflow = find(await readStore(ctx.sessionId, serverId), workflowId);
      const saved = await updateDomain(ctx.sessionId, `workflow-runs:${serverId}:${workflowId}`, workflowRunPageSchema,
        () => ({ runs: [], soloSteps: [], nextBefore: null }), (current) => ({
          runs: [...page.runs, ...current.runs.filter((entry) => !page.runs.some((incoming) => incoming.run.id === entry.run.id))]
            .sort((a, b) => b.run.startedAt.localeCompare(a.run.startedAt)).slice(0, 100),
          soloSteps: page.soloSteps, nextBefore: null,
        }));
      for (const run of page.runs) await recordRoutineOutcome(ctx.sessionId, workflow.detail.summary.title, run, "simulation");
      return saved;
    },
  },
  "workflows.list": { ...list, idempotent: true },
  "workflows.get": { ...get, idempotent: true },
  "workflows.create": { ...create, idempotent: true },
  "workflows.rename": { ...rename, idempotent: true },
  "workflows.delete": { ...remove, idempotent: true },
  "workflows.save-graph": { ...saveGraph, idempotent: true },
  "workflows.versions": { ...versions, idempotent: true },
  "workflows.version-graph": { ...versionGraph, idempotent: true },
};
