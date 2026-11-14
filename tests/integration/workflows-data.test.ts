import assert from "node:assert/strict";
import { workflowGraphSchema } from "../../src/contracts/workflows-data";
const emptyGraph = { nodes: [], edges: [], strokes: [] };
assert.deepEqual(workflowGraphSchema.parse(emptyGraph), emptyGraph);
assert.equal(
  workflowGraphSchema.safeParse({
    nodes: [{ id: "n", kind: "untrusted", at: { x: 0, y: 0 }, fields: {} }],
    edges: [],
    strokes: [],
  }).success,
  false,
  "graph schema rejects unknown node kinds",
);
const base = process.env.JOHNBOT_TEST_BASE_URL ?? "http://127.0.0.1:3000";
function session() {
  let cookie = "";
  return async (path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (cookie) headers.set("cookie", cookie);
    const response = await fetch(new URL(path, base), { ...init, headers });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];
    return response;
  };
}
const one = session(),
  two = session();
type ApiData<T> = { data: T };
type Summary = { id: string; title: string };
type Detail = { summary: Summary; revision: number };
type Version = { id: string };
async function read(
  client: ReturnType<typeof session>,
  op: string,
  serverId: string,
  workflowId?: string,
  versionId?: string,
): Promise<unknown> {
  const q = new URLSearchParams({ op, serverId });
  if (workflowId) q.set("workflowId", workflowId);
  if (versionId) q.set("versionId", versionId);
  const response = await client(`/api/workflows?${q}`);
  if (response.status !== 200)
    throw new Error(`GET ${op} failed: ${response.status} ${await response.text()}`);
  return ((await response.json()) as ApiData<unknown>).data;
}
async function readDefault(client: ReturnType<typeof session>) {
  const response = await client("/api/workflows?op=list");
  if (response.status !== 200)
    throw new Error(
      `Default local workflow list failed: ${response.status} ${await response.text()}`,
    );
  return ((await response.json()) as ApiData<Summary[]>).data;
}
async function command(
  client: ReturnType<typeof session>,
  name: string,
  payload: unknown,
): Promise<unknown> {
  const response = await client(`/api/commands/${name}`, {
    method: "POST",
    headers: { "content-type": "application/json", "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify({ payload }),
  });
  if (response.status !== 200)
    throw new Error(`Command ${name} failed: ${response.status} ${await response.text()}`);
  return ((await response.json()) as ApiData<unknown>).data;
}
const seedOne = (await read(one, "list", "server-a")) as Summary[],
  seedTwo = (await read(one, "list", "server-b")) as Summary[],
  otherTenantServerA = (await read(two, "list", "server-a")) as Summary[],
  otherTenantServerB = (await read(two, "list", "server-b")) as Summary[];
assert.ok(seedOne.length > 0, "demo workflows seed the domain");
assert.equal(seedTwo.length, seedOne.length);
assert.equal(otherTenantServerA.length, seedOne.length);
assert.equal(otherTenantServerB.length, seedTwo.length);
assert.deepEqual(await readDefault(one), await read(one, "list", "local"));
const invalidScope = await one("/api/workflows?op=list&serverId=server-a%20");
assert.equal(invalidScope.status, 400, "server ID validation rejects aliases and whitespace");
const stableId = crypto.randomUUID();
const created = (await command(one, "workflows.create", {
  serverId: "server-a",
  payload: { id: stableId, title: "Tenant one flow", graph: { nodes: [], edges: [], strokes: [] } },
})) as Detail;
assert.equal(created.summary.id, stableId, "optimistic creation preserves the client-generated ID");
assert.ok(((await read(one, "get", "server-a", created.summary.id)) as Detail).summary.id);
assert.equal(
  ((await read(one, "list", "server-b")) as Summary[]).some(
    (item) => item.id === created.summary.id,
  ),
  false,
  "server scopes isolate workflows",
);
assert.equal(
  ((await read(two, "list", "server-a")) as Summary[]).some(
    (item) => item.id === created.summary.id,
  ),
  false,
  "session scopes isolate workflows",
);
assert.equal(
  ((await read(two, "list", "server-b")) as Summary[]).some(
    (item) => item.id === created.summary.id,
  ),
  false,
  "tenant and server scopes stay isolated together",
);
const saved = (await command(one, "workflows.save-graph", {
  serverId: "server-a",
  payload: {
    workflowId: created.summary.id,
    baseRevision: 0,
    graph: { nodes: [], edges: [], strokes: [] },
  },
})) as { ok: boolean; revision?: number };
assert.deepEqual(saved, { ok: true, revision: 1 });
const conflict = (await command(one, "workflows.save-graph", {
  serverId: "server-a",
  payload: {
    workflowId: created.summary.id,
    baseRevision: 0,
    graph: { nodes: [], edges: [], strokes: [] },
  },
})) as { ok: boolean; conflict: { revision: number } };
assert.equal(conflict.ok, false);
assert.equal(conflict.conflict.revision, 1);
const versions = (await read(one, "versions", "server-a", created.summary.id)) as Version[];
assert.equal(versions.length, 1);
assert.deepEqual(await read(one, "version-graph", "server-a", created.summary.id, versions[0].id), {
  nodes: [],
  edges: [],
  strokes: [],
});
await command(one, "workflows.rename", {
  serverId: "server-a",
  payload: { workflowId: created.summary.id, title: "Renamed" },
});
assert.equal(
  ((await read(one, "get", "server-a", created.summary.id)) as Detail).summary.title,
  "Renamed",
);
await command(one, "workflows.delete", {
  serverId: "server-a",
  payload: created.summary.id,
});
assert.equal(
  ((await read(one, "list", "server-a")) as Summary[]).some(
    (item) => item.id === created.summary.id,
  ),
  false,
);
console.log(
  "workflow HTTP integration: tenant/server isolation, seed, CRUD, CAS conflict, version read passed",
);
