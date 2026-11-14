import assert from "node:assert/strict";
import { jobsPageSchema } from "../../src/contracts/jobs";
const base = process.env.JOHNBOT_TEST_BASE_URL ?? "http://127.0.0.1:3000";
const tenant = crypto.randomUUID();
const other = crypto.randomUUID();
async function call(cookie: string, path: string, payload?: unknown) {
  const response = await fetch(`${base}${path}`, {
    method: payload === undefined ? "GET" : "POST",
    headers: {
      Cookie: `johnbot_session=${cookie}`,
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: payload === undefined ? undefined : JSON.stringify({ payload }),
  });
  return { status: response.status, body: await response.json() };
}
assert.equal((await call(tenant, "/api/preferences")).status, 200);
assert.equal(
  (await call(tenant, "/api/commands/preferences.set-analytics", { enabled: true })).status,
  200,
);
const result = await call(tenant, "/api/jobs?limit=1");
assert.equal(result.status, 200);
const own = jobsPageSchema.parse(result.body.data);
assert.equal(own.jobs.length, 1);
const job = own.jobs[0];
assert.ok(job);
assert.equal(job.type, "cache.refresh");
assert.equal(jobsPageSchema.parse((await call(other, "/api/jobs")).body.data).jobs.length, 0);
assert.equal((await call(other, "/api/commands/jobs.retry", { id: job.id })).status, 409);
assert.equal((await call(other, "/api/commands/jobs.cancel", { id: job.id })).status, 409);
assert.equal((await call(tenant, "/api/jobs?limit=1000")).status, 400);
assert.equal((await call(tenant, "/api/jobs?status=INVALID")).status, 400);
console.log(
  "PASS: jobs HTTP listing, bounded queries, counts, tenant isolation and scoped controls",
);
