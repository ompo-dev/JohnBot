import assert from "node:assert/strict";
import {
  agentsSchema,
  agentStatusSchema,
  conversationDomainSchema,
  conversationPageSchema,
  modelsSchema,
  queueSchema,
  receiptSchema,
} from "../../src/contracts/agents-data";
import {
  STORY_AGENT_STATUS,
  STORY_AGENT_SUMMARIES,
  STORY_MODELS,
  STORY_SNAPSHOTS,
} from "../../src/preview/fixtures";

assert.deepEqual(agentsSchema.parse(STORY_AGENT_SUMMARIES), STORY_AGENT_SUMMARIES);
assert.deepEqual(agentStatusSchema.parse(STORY_AGENT_STATUS), STORY_AGENT_STATUS);
assert.deepEqual(modelsSchema.parse(STORY_MODELS), STORY_MODELS);
for (const [agentId, snapshot] of Object.entries(STORY_SNAPSHOTS)) {
  const data = {
    snapshot,
    readState: { unreadCount: 0, firstUnreadMessageId: null, throughMessageId: null },
    queue: { agentId, deliveries: [] },
    version: 0,
  };
  assert.deepEqual(conversationDomainSchema.parse(data), data);
  assert.equal(
    conversationPageSchema.safeParse({
      ...snapshot,
      references: {},
      pageInfo: { hasOlder: false, olderCursor: null },
    }).success,
    true,
  );
}
assert.deepEqual(
  receiptSchema.parse({
    messageId: "m1",
    deliveries: [{ id: "d1", recipientAgentId: "a1", status: "queued", position: 1 }],
  }),
  {
    messageId: "m1",
    deliveries: [{ id: "d1", recipientAgentId: "a1", status: "queued", position: 1 }],
  },
);
assert.equal(queueSchema.safeParse({ agentId: "a", deliveries: [{ wrong: true }] }).success, false);

const base = process.env.JOHNBOT_TEST_BASE_URL ?? "http://127.0.0.1:3000";
async function isolatedSession() {
  const cookie = new Map<string, string>();
  const request = async (path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (cookie.has("johnbot_session"))
      headers.set("cookie", `johnbot_session=${cookie.get("johnbot_session")}`);
    const response = await fetch(new URL(path, base), { ...init, headers });
    const setCookie = response.headers.get("set-cookie")?.match(/johnbot_session=([^;,]+)/u)?.[1];
    if (setCookie) cookie.set("johnbot_session", setCookie);
    return response;
  };
  return request;
}

const first = await isolatedSession();
const second = await isolatedSession();
const initial = await first("/api/agents?domain=agents");
assert.equal(initial.status, 200);
const roster = agentsSchema.parse((await initial.json()).data);
assert.ok(roster.some((agent) => agent.id === "research"));
const load = async (request: typeof first) => {
  const response = await request("/api/agents?domain=conversation&agentId=research");
  assert.equal(response.status, 200);
  return conversationDomainSchema.parse((await response.json()).data);
};
const before = await load(first);
assert.equal(before.snapshot.threadId, "thread-research");
const messageId = crypto.randomUUID();
const payload = {
  agentId: "research",
  expectedVersion: before.version,
  snapshot: {
    ...before.snapshot,
    revision: before.snapshot.revision + 1,
    messages: [
      ...before.snapshot.messages,
      {
        id: messageId,
        author: "user",
        source: "user",
        text: "Persisted HTTP test",
        createdAt: new Date().toISOString(),
        status: "completed",
      },
    ],
  },
  queue: before.queue,
  readState: before.readState,
};
const key = crypto.randomUUID();
const save = (data: unknown, id: string) =>
  first("/api/commands/agents.persist-conversation", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": id },
    body: JSON.stringify({ payload: data }),
  });
const saved = await save(payload, key);
assert.equal(saved.status, 200, await saved.clone().text());
assert.equal((await load(first)).version, before.version + 1);
assert.ok((await load(first)).snapshot.messages.some((message) => message.id === messageId));
const replay = await save(payload, key);
assert.equal(replay.status, 200);
assert.equal(replay.headers.get("idempotency-replayed"), "true");
assert.equal((await save({ ...payload, expectedVersion: before.version + 1 }, key)).status, 409);
assert.equal((await save(payload, crypto.randomUUID())).status, 409);
assert.equal((await first("/api/agents/conversation?agentId=research&limit=50")).status, 200);
assert.equal((await first("/api/agents?domain=reads")).status, 200);
assert.equal((await first("/api/agents?domain=queue&agentId=research")).status, 200);
assert.equal(
  (await load(second)).snapshot.messages.some((message) => message.id === messageId),
  false,
);
console.log(
  "PASS: conversation persistence, replay, stale revision conflict, queue/read endpoints and tenant isolation",
);
