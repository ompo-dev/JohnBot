import assert from "node:assert/strict";
import { z } from "zod";
import { http, getData, runCommand } from "../../src/lib/api/client";
import { invalidateQueries, putQuery, readEntry, resetDataStore } from "../../src/stores/data-store";
import { queryDomains, queryRevalidateSeconds } from "../../src/server/cache/policy";
import { commandQueryPrefixes } from "../../src/contracts/data-cache";
const previous = http.defaults.adapter;
const originalNow = Date.now;
let now = 100_000;
Date.now = () => now;
resetDataStore();
let reads = 0;
let release!: () => void;
const gate = new Promise<void>((resolve) => release = resolve);
http.defaults.adapter = async (config) => {
  if (config.method === "get") { reads++; await gate; }
  return { data: { ok: true, data: { count: reads } }, status: 200, statusText: "OK", headers: {}, config };
};
const schema = z.object({ count: z.number() });
try {
  const path = "/api/agents?domain=conversation&agentId=one";
  const a = getData(path, schema), b = getData(path, schema);
  release();
  assert.deepEqual(await a, await b);
  assert.equal(reads, 1, "Parallel readers share one request");
  await getData(path, schema);
  assert.equal(reads, 1, "Fresh snapshots come from Zustand");
  now += 5_001;
  await getData(path, schema);
  assert.equal(reads, 2, "Conversation TTL expires");
  invalidateQueries("/api/agents");
  await getData(path, schema);
  assert.equal(reads, 3, "Invalidated snapshots bypass their TTL");
  await getData(path, schema, { force: true });
  assert.equal(reads, 4);
  putQuery("/api/workflows?op=list&serverId=local", []);
  await runCommand("settings.unknown-test", {}, schema);
  assert.equal(readEntry("/api/workflows?op=list&serverId=local")?.invalidated, false, "Settings do not invalidate unrelated workflows");
  assert.deepEqual(queryDomains(path), ["agents", "conversation:one"]);
  assert.deepEqual(queryDomains('["workflow","local","list",""]'), ["workflows-v1"]);
  assert.equal(queryRevalidateSeconds(path), 5);
  assert.deepEqual(commandQueryPrefixes("workspace.memory"), ["/api/workspace", "/api/jobs"]);
  console.log("PASS: deduplicated reads, TTL, force/invalidation and resource-scoped caches");
} finally { Date.now = originalNow; http.defaults.adapter = previous; resetDataStore(); }
