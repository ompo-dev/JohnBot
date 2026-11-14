import assert from "node:assert/strict";
import {
  agentSubmissionSchema,
  marketplaceAgentDetailSchema,
  marketplaceAgentPageSchema,
  marketplaceListQuerySchema,
  marketplaceSubmissionsSchema,
  marketplacePublicationPreviewSchema,
  submitMarketplaceAgentSchema,
} from "../../src/contracts/marketplace-data";
import {
  STORY_AGENT_SUBMISSIONS,
  STORY_MARKETPLACE_AGENTS,
  STORY_MARKETPLACE_AGENT_DETAILS,
} from "../../src/preview/fixtures";
import type { MockjohnBotControls } from "../../src/preview/mock-johnbot";
import { DEMO_OPTIONS } from "../../src/preview/demo-seed";
import { installMarketplaceData } from "../../src/lib/api/bridges/marketplace";
import { http } from "../../src/lib/api/client";

const baseUrl = process.env.JOHNBOT_TEST_BASE_URL ?? "http://127.0.0.1:3000";
type Jar = { cookie: string };
function setCookie(jar: Jar, response: Response): void {
  const value = response.headers.get("set-cookie")?.split(";")[0];
  if (value) jar.cookie = value;
}
async function request(jar: Jar, path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (jar.cookie) headers.set("Cookie", jar.cookie);
  const response = await fetch(new URL(path, baseUrl), { ...init, headers, redirect: "manual" });
  setCookie(jar, response);
  return response;
}
async function data<T>(response: Response): Promise<T> {
  const text = await response.text();
  let body: { ok: boolean; data?: T; error?: unknown };
  try {
    body = JSON.parse(text) as typeof body;
  } catch {
    throw new Error(
      `Expected JSON response; got HTTP ${response.status} ${response.headers.get("content-type")}: ${text.slice(0, 200)}`,
    );
  }
  assert.equal(body.ok, true, JSON.stringify(body.error));
  return body.data as T;
}
function key(): string {
  return crypto.randomUUID();
}

for (const agent of STORY_MARKETPLACE_AGENTS)
  assert.deepEqual(marketplaceAgentPageSchema.parse({ agents: [agent], nextCursor: null }), {
    agents: [agent],
    nextCursor: null,
  });
for (const detail of Object.values(STORY_MARKETPLACE_AGENT_DETAILS))
  assert.deepEqual(marketplaceAgentDetailSchema.parse(detail), detail);
assert.deepEqual(
  marketplaceSubmissionsSchema.parse(STORY_AGENT_SUBMISSIONS),
  STORY_AGENT_SUBMISSIONS,
);
assert.equal(marketplaceListQuerySchema.safeParse({ limit: "101" }).success, false);
assert.equal(marketplaceListQuerySchema.safeParse({ unknown: "1" }).success, false);
for (const field of ["featured", "verified"]) {
  assert.equal(
    marketplaceListQuerySchema.parse({ [field]: "false" })[field as "featured" | "verified"],
    false,
  );
  assert.equal(
    marketplaceListQuerySchema.parse({ [field]: "true" })[field as "featured" | "verified"],
    true,
  );
  for (const value of ["0", "1", "False", "yes", "", "null"]) {
    assert.equal(marketplaceListQuerySchema.safeParse({ [field]: value }).success, false);
  }
}
for (const cursor of ["NaN", "-1", "1.5", "1e2", "", "9007199254740992"]) {
  assert.equal(marketplaceListQuerySchema.safeParse({ cursor }).success, false);
}
assert.equal(
  submitMarketplaceAgentSchema.safeParse({ agentId: "x", unexpected: true }).success,
  false,
);

// A typed local preview double avoids importing renderer hooks into the HTTP test runtime.
const chiefPreview = marketplacePublicationPreviewSchema.parse({
  agentId: "chief",
  name: "Chief",
  title: "Chief of staff",
  description: "Local agent publication",
  avatarSeed: "chief",
  avatarHue: null,
  avatarUrl: null,
  skills: [],
  routines: [],
});
const custom = { id: "custom-publisher" };
const customPreview = marketplacePublicationPreviewSchema.parse({
  ...chiefPreview,
  agentId: custom.id,
  name: "Custom publisher",
});
const nativePreview = async (id: string) => {
  assert.ok(id === "chief" || id === custom.id);
  return structuredClone(id === "chief" ? chiefPreview : customPreview);
};
const mock = {
  api: { marketplaceAgents: { preview: nativePreview } },
  dispose: () => undefined,
} as unknown as MockjohnBotControls;
const originalAdapter = http.defaults.adapter;
const forwarded: unknown[] = [];
try {
  mock.api.marketplaceAgents.submit = async () => {
    throw new Error("Native mutating submit must not run.");
  };
  http.defaults.adapter = async (config) => {
    assert.equal(config.url, "/api/commands/marketplace.submit");
    forwarded.push(JSON.parse(config.data as string).payload);
    return {
      config,
      status: 200,
      statusText: "OK",
      headers: {},
      data: { ok: true, data: STORY_AGENT_SUBMISSIONS[0] },
    };
  };
  installMarketplaceData(mock);
  assert.equal(
    mock.api.marketplaceAgents.preview,
    nativePreview,
    "preview keeps its original signature and implementation",
  );
  await mock.api.marketplaceAgents.submit({ agentId: "chief" });
  await mock.api.marketplaceAgents.submit({ agentId: custom.id });
  assert.deepEqual(forwarded, [
    { agentId: "chief", preview: chiefPreview },
    { agentId: custom.id, preview: customPreview },
  ]);
} finally {
  http.defaults.adapter = originalAdapter;
  mock.dispose();
}
assert.equal(
  marketplacePublicationPreviewSchema.safeParse({ ...chiefPreview, name: "x".repeat(81) }).success,
  false,
);
assert.equal(
  marketplacePublicationPreviewSchema.safeParse({
    ...chiefPreview,
    routines: [{ name: "invalid", instruction: "x", active: true, schedule: { kind: "unknown" } }],
  }).success,
  false,
);

if (process.argv.includes("--local-only")) {
  console.log("marketplace fixtures, query contracts and native preview bridge passed");
  process.exit(0);
}

const a: Jar = { cookie: "" };
const b: Jar = { cookie: "" };
const initialA = await data<{ agents: { id: string }[]; nextCursor: string | null }>(
  await request(a, "/api/marketplace/agents?limit=1"),
);
assert.equal(initialA.agents.length, 1);
assert.ok(initialA.nextCursor);
const firstAgent = initialA.agents[0];
assert.ok(firstAgent);
const filtered = await data<{ agents: { id: string }[] }>(
  await request(a, "/api/marketplace/agents?category=coding&featured=true"),
);
assert.ok(filtered.agents.length > 0);
for (const verified of [true, false]) {
  const response = marketplaceAgentPageSchema.parse(
    await data<unknown>(await request(a, `/api/marketplace/agents?verified=${verified}`)),
  );
  const expected = STORY_MARKETPLACE_AGENTS.filter(
    (agent) => (agent.verified === true) === verified,
  );
  assert.deepEqual(
    response.agents.map((agent) => agent.id).sort(),
    expected.map((agent) => agent.id).sort(),
  );
  assert.ok(response.agents.every((agent) => (agent.verified === true) === verified));
}
const uncategorized = marketplaceAgentPageSchema.parse(
  await data<unknown>(await request(a, "/api/marketplace/agents?featured=false")),
);
assert.equal(
  uncategorized.agents.length,
  STORY_MARKETPLACE_AGENTS.length,
  "featured=false preserves the native all-agents query",
);
const sorted = await data<{ agents: { id: string; installs: number }[] }>(
  await request(a, "/api/marketplace/agents?sort=installs"),
);
assert.deepEqual(
  sorted.agents.map((agent) => agent.installs),
  [...sorted.agents.map((agent) => agent.installs)].sort((x, y) => y - x),
);
const sortedFirst = marketplaceAgentPageSchema.parse(
  await data<unknown>(await request(a, "/api/marketplace/agents?sort=installs&limit=1")),
);
assert.ok(sortedFirst.nextCursor);
const sortedSecond = marketplaceAgentPageSchema.parse(
  await data<unknown>(
    await request(
      a,
      `/api/marketplace/agents?sort=installs&limit=1&cursor=${sortedFirst.nextCursor}`,
    ),
  ),
);
assert.equal(sortedSecond.agents[0]?.id, sorted.agents[1]?.id);
const detail = await data<unknown>(
  await request(a, `/api/marketplace/agents/${encodeURIComponent(firstAgent.id)}`),
);
marketplaceAgentDetailSchema.parse(detail);
const mineA = await data<unknown[]>(await request(a, "/api/marketplace/submissions"));
assert.doesNotThrow(() => marketplaceSubmissionsSchema.parse(mineA));
const ownListing = await data<unknown>(
  await request(a, "/api/marketplace/agents/listing-release-manager?listing=1"),
);
marketplaceAgentDetailSchema.parse(ownListing);

async function submit(payload: unknown, idempotencyKey = key()): Promise<Response> {
  return request(a, "/api/commands/marketplace.submit", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({ payload }),
  });
}
const chiefPayload = { agentId: "chief", preview: chiefPreview, category: "productivity" };
const submitKey = key();
const submission = agentSubmissionSchema.parse(
  await data<unknown>(await submit(chiefPayload, submitKey)),
);
assert.equal(submission.name, chiefPreview.name);
assert.equal(submission.listingId, "listing-chief");
assert.equal(submission.status, "pending");
assert.equal(submission.skillCount, chiefPreview.skills.length);
assert.equal(submission.routineCount, chiefPreview.routines.length);
assert.equal(
  submission.activeRoutineCount,
  chiefPreview.routines.filter((routine) => routine.active).length,
);
const replay = await submit(chiefPayload, submitKey);
assert.equal(replay.headers.get("idempotency-replayed"), "true");
assert.deepEqual(agentSubmissionSchema.parse(await data<unknown>(replay)), submission);
const conflict = await submit({ ...chiefPayload, category: "coding" }, submitKey);
assert.equal(conflict.status, 409);
assert.equal((await conflict.json()).error.code, "idempotency_conflict");
const customSubmission = agentSubmissionSchema.parse(
  await data<unknown>(await submit({ agentId: custom.id, preview: customPreview })),
);
assert.equal(customSubmission.name, customPreview.name);
assert.equal(customSubmission.listingId, `listing-${custom.id}`);
assert.equal(customSubmission.skillCount, customPreview.skills.length);
assert.equal(customSubmission.routineCount, customPreview.routines.length);
const fallbackSubmission = agentSubmissionSchema.parse(
  await data<unknown>(await submit({ agentId: "chief" })),
);
assert.equal(fallbackSubmission.name, chiefPreview.name);
assert.equal(fallbackSubmission.routineCount, DEMO_OPTIONS.routines?.chief?.length ?? 0);
for (const payload of [
  { agentId: "chief", preview: customPreview },
  { agentId: "listing-release-manager" },
  { agentId: "not-a-local-seed" },
  { agentId: "chief", preview: { ...chiefPreview, name: "x".repeat(81) } },
]) {
  const invalid = await submit(payload);
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).error.code, "invalid_input");
}
const mineAfter = await data<unknown[]>(await request(a, "/api/marketplace/submissions"));
assert.equal(
  marketplaceSubmissionsSchema.parse(mineAfter).length,
  marketplaceSubmissionsSchema.parse(mineA).length + 3,
);
const mineB = await data<unknown[]>(await request(b, "/api/marketplace/submissions"));
assert.notEqual(a.cookie, b.cookie, "each cookie jar must have its own tenant session");
assert.equal(
  marketplaceSubmissionsSchema.parse(mineB).length,
  marketplaceSubmissionsSchema.parse(mineA).length,
);
const cachedUnverified = marketplaceAgentPageSchema.parse(
  await data<unknown>(await request(b, "/api/marketplace/agents?verified=false")),
);
assert.deepEqual(
  cachedUnverified.agents.map((agent) => agent.id).sort(),
  STORY_MARKETPLACE_AGENTS.filter((agent) => agent.verified !== true)
    .map((agent) => agent.id)
    .sort(),
);
const ownAfterOtherRead = marketplaceSubmissionsSchema.parse(
  await data<unknown>(await request(a, "/api/marketplace/submissions")),
);
assert.equal(ownAfterOtherRead.length, mineA.length + 3);

const badCommand = await request(a, "/api/commands/marketplace.nope", {
  method: "POST",
  headers: { "Content-Type": "application/json", "Idempotency-Key": key() },
  body: JSON.stringify({ payload: {} }),
});
assert.equal(badCommand.status, 404);
for (const query of ["surprise=1", "verified=invalid", "featured=0", "cursor=NaN", "cursor=-1"]) {
  const badQuery = await request(a, `/api/marketplace/agents?${query}`);
  assert.equal(badQuery.status, 400);
  assert.equal((await badQuery.json()).error.code, "invalid_input");
}
console.log("marketplace data HTTP integration passed");
