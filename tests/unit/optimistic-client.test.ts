import assert from "node:assert/strict";
import { z } from "zod";
import { http, runCommand, getData } from "../../src/lib/api/client";
import { putQuery, readEntry, resetDataStore } from "../../src/stores/data-store";
import { preferencesDataSchema, seedPreferencesData } from "../../src/contracts/preferences-data";
import {
  workflowDetailSchema,
  workflowListSchema,
  workflowSaveResultSchema,
} from "../../src/contracts/workflows-data";
const original = http.defaults.adapter;
const envelope = z.object({
  preferences: preferencesDataSchema,
  value: z.object({ enabled: z.boolean() }),
});
let release!: () => void;
const deferred = () =>
  new Promise<void>((resolve) => {
    release = resolve;
  });
try {
  resetDataStore();
  putQuery("/api/preferences", seedPreferencesData());
  const gate = deferred();
  http.defaults.adapter = async () => {
    await gate;
    throw new Error("offline");
  };
  const failed = runCommand("preferences.set-analytics", { enabled: true }, envelope);
  assert.equal(
    preferencesDataSchema.parse(readEntry("/api/preferences")?.data).analytics.enabled,
    true,
  );
  release();
  await assert.rejects(failed);
  assert.equal(
    preferencesDataSchema.parse(readEntry("/api/preferences")?.data).analytics.enabled,
    false,
  );
  assert.equal(readEntry("/api/preferences")?.pending, 0);

  const id = crypto.randomUUID();
  const list = "/api/workflows?op=list&serverId=local";
  const key = `/api/workflows?op=get&serverId=local&workflowId=${id}`;
  putQuery(list, []);
  const createGate = deferred();
  const detail = {
    summary: { id, title: "Draft", steps: 0, lastRun: null, updatedAt: new Date().toISOString() },
    graph: { nodes: [], edges: [], strokes: [] },
    revision: 0,
    triggers: [],
  };
  let reads = 0;
  http.defaults.adapter = async (config) => {
    if (config.method === "get") {
      reads++;
      throw new Error("optimistic detail should be local");
    }
    await createGate;
    return { status: 200, statusText: "OK", config, headers: {}, data: { ok: true, data: detail } };
  };
  const creating = runCommand(
    "workflows.create",
    { serverId: "local", payload: { id, title: "Draft" } },
    workflowDetailSchema,
  );
  assert.equal(workflowListSchema.parse(readEntry(list)?.data)[0]?.id, id);
  assert.equal((await getData(key, workflowDetailSchema)).summary.id, id);
  assert.equal(reads, 0);
  release();
  await creating;
  assert.equal(workflowListSchema.parse(readEntry(list)?.data)[0]?.id, id);

  http.defaults.adapter = async (config) => ({
    status: 200,
    statusText: "OK",
    config,
    headers: {},
    data: { ok: true, data: { ok: false, conflict: detail } },
  });
  const conflict = await runCommand(
    "workflows.save-graph",
    {
      serverId: "local",
      payload: {
        workflowId: id,
        baseRevision: 0,
        graph: { nodes: [], edges: [], strokes: [{ id: "invalid-for-display" }] },
      },
    },
    workflowSaveResultSchema,
  );
  assert.equal(conflict.data.ok, false);
  assert.deepEqual(workflowDetailSchema.parse(readEntry(key)?.data).graph, detail.graph);

  const readGate = deferred();
  http.defaults.adapter = async (config) => {
    await readGate;
    return {
      status: 200,
      statusText: "OK",
      config,
      headers: {},
      data: { ok: true, data: { value: "old-session" } },
    };
  };
  const stale = getData("/api/private", z.object({ value: z.string() }));
  resetDataStore();
  release();
  await assert.rejects(stale);
  assert.equal(readEntry("/api/private"), undefined);
  console.log(
    "PASS: optimistic before HTTP, failure rollback, stable create IDs, pending reads, conflict rollback and session fencing",
  );
} finally {
  http.defaults.adapter = original;
  resetDataStore();
}
