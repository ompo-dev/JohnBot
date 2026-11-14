import assert from "node:assert/strict";
import { loadEnvConfig } from "@next/env";
import { z } from "zod";
import { getDatabase, closeDatabase } from "../../src/server/database/client";
import { readDomain, updateDomain } from "../../src/server/repositories/domain-store";
import { getRedis, closeRedis } from "../../src/server/cache/redis";
import { importRedisRecords } from "../../src/server/repositories/redis-import";
import { loadSnapshot, seedSnapshot } from "../../src/server/repositories/session-store";

loadEnvConfig(process.cwd());
const tenant = `database-${crypto.randomUUID()}`;
const other = `${tenant}-other`;
const domain = "database-test:nested";
const key = `johnbot:domain:${domain}:${tenant}`;
const schema = z.object({ count: z.number().int().nonnegative() });
const seed = () => ({ count: 0 });
const redis = await getRedis();
try {
  await redis.set(key, JSON.stringify({ count: 7 }));
  const legacySession = { ...seedSnapshot(), version: 13 };
  await redis.set(`johnbot:session:${tenant}`, JSON.stringify(legacySession));
  assert.equal((await loadSnapshot(tenant)).version, 13);
  assert.equal((await readDomain(tenant, domain, schema, seed)).count, 7);
  await updateDomain(tenant, domain, schema, seed, (state) => ({ count: state.count + 1 }));
  await redis.set(key, JSON.stringify({ count: 999 }));
  await importRedisRecords();
  assert.equal((await readDomain(tenant, domain, schema, seed)).count, 8);
  assert.equal(await redis.get(key), JSON.stringify({ count: 999 }));
  console.log("PASS: legacy data imports without overwriting PostgreSQL or changing Redis");

  await closeDatabase();
  assert.equal((await readDomain(tenant, domain, schema, seed)).count, 8);
  assert.equal((await readDomain(other, domain, schema, seed)).count, 0);
  await assert.rejects(updateDomain(tenant, domain, schema, seed, () => ({ count: -1 })));
  assert.equal((await readDomain(tenant, domain, schema, seed)).count, 8);
  console.log("PASS: reconnect persistence, tenant isolation and invalid writes rejected");

  const badKey = `johnbot:domain:bad:${tenant}`;
  await redis.set(badKey, "not-json");
  await assert.rejects(readDomain(tenant, "bad", schema, seed));
  assert.equal(
    await getDatabase().domainRecord.count({ where: { sessionId: tenant, domain: "bad" } }),
    0,
  );
  await redis.del(badKey);
  await getDatabase().domainRecord.create({
    data: { sessionId: tenant, domain: "bad", payload: { count: "bad" } },
  });
  await assert.rejects(readDomain(tenant, "bad", schema, seed));
  console.log("PASS: corrupt legacy and PostgreSQL payloads fail closed without reseeding");
} finally {
  await getDatabase().domainRecord.deleteMany({ where: { sessionId: { in: [tenant, other] } } });
  await redis.del([key, `johnbot:session:${tenant}`, `johnbot:domain:bad:${tenant}`]);
  await Promise.all([closeDatabase(), closeRedis()]);
}
