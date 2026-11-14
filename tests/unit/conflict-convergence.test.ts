import assert from "node:assert/strict";
import axios from "axios";
import { agentsSchema } from "../../src/contracts/agents-data";
import { agentSchema } from "../../src/contracts/workspace-data";
import { ApiError } from "../../src/lib/api/errors";
import { getData, http, runCommand } from "../../src/lib/api/client";
import { STORY_AGENT_SUMMARIES } from "../../src/preview/fixtures";
import { putQuery, readEntry, resetDataStore } from "../../src/stores/data-store";

const roster = "/api/agents?domain=agents";
const original = http.defaults.adapter;
const originalNow = Date.now;
const [chief, research, sales] = structuredClone(STORY_AGENT_SUMMARIES);
assert.ok(chief && research && sales);
const conflictBody = {
  ok: false,
  error: { code: "conflict", message: "Agent changed in another client. Reload before saving.", requestId: "req-conflict" },
};
let serverAgents = [chief, research, sales];
let writes = 0;
http.defaults.adapter = async (config) => {
  if (config.method === "get")
    return { config, status: 200, statusText: "OK", headers: {}, data: { ok: true, data: structuredClone(serverAgents) } };
  writes++;
  throw new axios.AxiosError("Request failed with status code 409", "ERR_BAD_REQUEST", config, {}, {
    config,
    status: 409,
    statusText: "Conflict",
    headers: {},
    data: conflictBody,
  });
};
try {
  Date.now = () => 1_000_000;
  resetDataStore();
  putQuery(roster, structuredClone(serverAgents));

  await assert.rejects(
    runCommand("agents.update", { agentId: research.id, agent: { ...research, name: "Renamed here" }, expectedUpdatedAt: research.updatedAt }, agentSchema),
    (error: unknown) => error instanceof ApiError && error.code === "conflict",
  );
  const rolledBack = readEntry(roster);
  assert.equal(writes, 1);
  assert.equal(agentsSchema.parse(rolledBack?.data)[1]?.name, research.name, "a refused write restores the confirmed roster");
  assert.equal(rolledBack?.pending, 0);
  assert.equal(rolledBack?.invalidated, true, "the stale base is marked for reload");
  assert.match(rolledBack?.error ?? "", /another client/);

  // The other client already saved: the reload the invalidation triggers must show that value.
  serverAgents = [chief, { ...research, name: "Renamed elsewhere", updatedAt: new Date(Date.now()).toISOString() }, sales];
  const fresh = await getData(roster, agentsSchema);
  assert.equal(fresh[1]?.name, "Renamed elsewhere", "invalidated reads bypass the snapshot TTL");
  assert.equal(readEntry(roster)?.error, null);
  assert.equal(readEntry(roster)?.invalidated, false);

  // A confirmed edit keeps the agent in its position instead of moving it to the end.
  const saved = { ...fresh[1], name: "Saved here", updatedAt: new Date(Date.now() + 1_000).toISOString() };
  serverAgents = [chief, saved, sales];
  http.defaults.adapter = async (config) => ({
    config,
    status: 200,
    statusText: "OK",
    headers: {},
    data: { ok: true, data: structuredClone(saved) },
  });
  await runCommand("agents.update", { agentId: research.id, agent: { ...saved }, expectedUpdatedAt: saved.updatedAt }, agentSchema);
  const ordered = agentsSchema.parse(readEntry(roster)?.data);
  assert.deepEqual(ordered.map((agent) => agent.id), [chief.id, research.id, sales.id]);
  assert.equal(ordered[1]?.name, "Saved here");
  assert.equal(readEntry(roster)?.invalidated, true, "a confirmed write still refreshes derived reads");

  // A network failure keeps the base and does not ask every reader to reload.
  http.defaults.adapter = async (config) => ({
    config,
    status: 200,
    statusText: "OK",
    headers: {},
    data: { ok: true, data: structuredClone(serverAgents) },
  });
  await getData(roster, agentsSchema, { force: true });
  assert.equal(readEntry(roster)?.invalidated, false);
  http.defaults.adapter = async () => {
    throw new Error("offline");
  };
  await assert.rejects(
    runCommand("agents.update", { agentId: research.id, agent: { ...saved, name: "Offline" }, expectedUpdatedAt: saved.updatedAt }, agentSchema),
    (error: unknown) => error instanceof ApiError && error.code === "network_error",
  );
  assert.equal(agentsSchema.parse(readEntry(roster)?.data)[1]?.name, "Saved here");
  assert.equal(readEntry(roster)?.invalidated, false, "a failed request does not force a reload");
  console.log("PASS: cross-client conflict rolls back, invalidates and reloads the other client's value; edits keep roster order");
} finally {
  Date.now = originalNow;
  http.defaults.adapter = original;
  resetDataStore();
}

