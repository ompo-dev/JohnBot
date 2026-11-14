import { z } from "zod";
import { LOCAL_SERVER_ID, isWorkflowRunDetail, type WorkflowRunDetail } from "../../../contracts/ipc";
import type { MockjohnBotControls } from "../../../preview/mock-johnbot";
import { mockWorkflows, type MockWorkflowSeed } from "../../../preview/mock-workflows";
import {
  workflowDetailSchema,
  workflowGraphSchema,
  workflowListSchema,
  workflowSaveResultSchema,
  workflowSummarySchema,
  workflowVersionsSchema,
} from "../../../contracts/workflows-data";
import { getData, runCommand } from "../client";
import { dataStore } from "../../../stores/data-store";
import { workflowRunPageSchema } from "../../../contracts/workspace-ui";

/** Saved graph data is remote; simulation uses a per-server local runner synced before each run call. */
export function installWorkflowsData(mock: MockjohnBotControls, options: { simulate?: boolean } = {}): void {
  const api = mock.api.workflows;
  const unsubscribe = dataStore.subscribe((state, previous) => {
    for (const [key, value] of Object.entries(state.entries)) {
      if (!key.startsWith("/api/workflows?") || value.pending === previous.entries[key]?.pending)
        continue;
      const params = new URL(key, "http://local").searchParams;
      if ((params.get("serverId") ?? "local") === LOCAL_SERVER_ID)
        mock.emitAgentEvent({
          type: "workflows-changed",
          workflowId: params.get("workflowId") ?? "",
        });
    }
  });
  const dispose = mock.dispose;
  mock.dispose = () => {
    unsubscribe();
    dispose();
  };
  const runners = new Map<string, ReturnType<typeof mockWorkflows>>();
  const saves = new Map<string, Promise<unknown>>();
  const persistSimulation = (serverId: string, workflowId: string) => {
    const key = `${serverId}:${workflowId}`;
    const pending = (saves.get(key) ?? Promise.resolve()).catch(() => undefined).then(async () => {
      const current = runners.get(serverId);
      if (!current) return;
      const page = await current.runs({ workflowId, limit: 100 });
      await runCommand("workflows.save-simulation", { serverId, workflowId, page }, workflowRunPageSchema);
    });
    saves.set(key, pending);
    void pending.catch(() => undefined);
  };
  const server = (id?: string) => id ?? LOCAL_SERVER_ID;
  const read = <T>(
    op: string,
    schema: import("zod").ZodType<T>,
    serverId: string,
    workflowId?: string,
    versionId?: string,
  ) => {
    const params = new URLSearchParams({ op, serverId });
    if (workflowId) params.set("workflowId", workflowId);
    if (versionId) params.set("versionId", versionId);
    return getData(`/api/workflows?${params}`, schema);
  };
  const command = <T>(
    name: string,
    payload: unknown,
    schema: import("zod").ZodType<T>,
    serverId: string,
  ) => runCommand(name, { serverId, payload }, schema);
  const runner = async (serverId: string) => {
    const summaries = await read("list", workflowListSchema, serverId),
      seeds: MockWorkflowSeed[] = [];
    for (const item of summaries) {
      const value = await read("get", workflowDetailSchema, serverId, item.id);
      seeds.push({
        id: item.id,
        title: value.summary.title,
        graph: value.graph,
        updatedAt: value.summary.updatedAt,
      });
    }
    let current = runners.get(serverId);
    if (!current) {
      current = mockWorkflows(seeds, (workflowId) => {
        persistSimulation(serverId, workflowId);
        if (serverId === LOCAL_SERVER_ID)
          mock.emitAgentEvent({ type: "workflows-changed", workflowId });
      });
      runners.set(serverId, current);
      return current;
    }
    const currentRows = await current.list();
    for (const item of currentRows) {
      if (!summaries.some((saved) => saved.id === item.id)) await current.delete(item.id);
    }
    for (const seed of seeds) {
      const saved = await current.get(seed.id);
      if (saved.summary.title !== seed.title)
        await current.rename({ workflowId: seed.id, title: seed.title });
      const latest = await current.get(seed.id);
      if (JSON.stringify(latest.graph) !== JSON.stringify(seed.graph)) {
        const response = await current.saveGraph({
          workflowId: seed.id,
          baseRevision: latest.revision,
          graph: seed.graph,
        });
        if (!response.ok) throw new Error("Workflow simulation sync conflicted.");
      }
    }
    return current;
  };
  api.list = (serverId) => read("list", workflowListSchema, server(serverId));
  api.get = (workflowId, serverId) =>
    read("get", workflowDetailSchema, server(serverId), workflowId);
  api.create = async (input, serverId) => {
    const value = (
      await command(
        "workflows.create",
        { ...input, id: crypto.randomUUID() },
        workflowDetailSchema,
        server(serverId),
      )
    ).data;
    if (server(serverId) === LOCAL_SERVER_ID)
      mock.emitAgentEvent({ type: "workflows-changed", workflowId: value.summary.id });
    return value;
  };
  api.rename = async (input, serverId) => {
    const value = (
      await command("workflows.rename", input, workflowSummarySchema, server(serverId))
    ).data;
    if (server(serverId) === LOCAL_SERVER_ID)
      mock.emitAgentEvent({ type: "workflows-changed", workflowId: input.workflowId });
    return value;
  };
  api.delete = async (workflowId, serverId) => {
    await command("workflows.delete", workflowId, z.null(), server(serverId));
    if (server(serverId) === LOCAL_SERVER_ID)
      mock.emitAgentEvent({ type: "workflows-changed", workflowId });
  };
  api.saveGraph = async (input, serverId) => {
    const value = (
      await command("workflows.save-graph", input, workflowSaveResultSchema, server(serverId))
    ).data;
    if (server(serverId) === LOCAL_SERVER_ID)
      mock.emitAgentEvent({ type: "workflows-changed", workflowId: input.workflowId });
    return value;
  };
  api.versions = (workflowId, serverId) =>
    read("versions", workflowVersionsSchema, server(serverId), workflowId);
  api.versionGraph = (input, serverId) =>
    read("version-graph", workflowGraphSchema, server(serverId), input.workflowId, input.versionId);
  api.restoreVersion = async (input, serverId) => {
    const graph = await api.versionGraph(input, serverId),
      saved = await api.get(input.workflowId, serverId);
    return api
      .saveGraph({ workflowId: input.workflowId, baseRevision: saved.revision, graph }, serverId)
      .then(async (result) => {
        if (!result.ok) return result.conflict;
        return api.get(input.workflowId, serverId);
      });
  };
  const withRunner = <T>(
    serverId: string | undefined,
    call: (value: ReturnType<typeof mockWorkflows>) => Promise<T>,
  ) => runner(server(serverId)).then(call);
  const runCsv = async (input: { workflowId: string; requestId: string; fromNodeId?: string }, serverId?: string) => {
    const result = (await runCommand("workflows.run-csv", { ...input, serverId: server(serverId) }, z.custom<WorkflowRunDetail>(isWorkflowRunDetail))).data;
    mock.emitAgentEvent({ type: "workflows-changed", workflowId: input.workflowId });
    return result;
  };
  api.startRun = (input, serverId) => input.workflowId === "wf-machine-downtime-csv" ? runCsv(input, serverId) : withRunner(serverId, (r) => r.startRun(input));
  api.runStep = async (input, serverId) => {
    if (input.workflowId !== "wf-machine-downtime-csv") return withRunner(serverId, (r) => r.runStep(input));
    const result = await runCsv({ workflowId: input.workflowId, requestId: input.requestId }, serverId);
    return result.steps.find((step) => step.nodeId === input.nodeId)!;
  };
  api.stopStep = (id, serverId) => withRunner(serverId, (r) => r.stopStep(id));
  api.stopRun = (id, serverId) => withRunner(serverId, (r) => r.stopRun(id));
  api.retryStep = (input, serverId) => withRunner(serverId, (r) => r.retryStep(input));
  api.decide = (input, serverId) => withRunner(serverId, (r) => r.decide(input));
  api.runs = (input, serverId) => withRunner(serverId, (r) => r.runs(input));
  api.run = (id, serverId) => withRunner(serverId, (r) => r.run(id));
  api.rotateWebhookSecret = (input, serverId) =>
    withRunner(serverId, (r) => r.rotateWebhookSecret(input));
  if (options.simulate) {
    api.runs = async (input, serverId) => {
      const scope = server(serverId), local = await withRunner(scope, (r) => r.runs(input));
      await saves.get(`${scope}:${input.workflowId}`);
      const saved = await read("runs", workflowRunPageSchema, scope, input.workflowId);
      return { ...saved, runs: [...local.runs, ...saved.runs.filter((entry) => !local.runs.some((item) => item.run.id === entry.run.id))] };
    };
    api.run = async (id, serverId) => {
      const scope = server(serverId), current = runners.get(scope);
      if (current) { try { return await current.run(id); } catch { /* Read durable history after reload. */ } }
      for (const workflow of await read("list", workflowListSchema, scope)) {
        const page = await read("runs", workflowRunPageSchema, scope, workflow.id);
        const result = page.runs.find((entry) => entry.run.id === id);
        if (result) return result;
      }
      throw new Error("Execução não encontrada.");
    };
  }
  if (!options.simulate) {
    const unavailable = async (): Promise<never> => { throw new Error("Workflow execution requires a connected executor. No simulated run was started."); };
    api.startRun = unavailable;
    api.runStep = unavailable;
    api.stopStep = unavailable;
    api.stopRun = unavailable;
    api.retryStep = unavailable;
    api.decide = unavailable;
    api.run = unavailable;
    api.rotateWebhookSecret = unavailable;
    api.runs = (input, serverId) => read("runs", workflowRunPageSchema, server(serverId), input.workflowId);
  }
}
