import { z } from "zod";
import { getDatabase } from "../database/client";
import { jsonPayload } from "./domain-store";
import { getRedis } from "../cache/redis";

const legacySchema = z.object({
  sessionId: z.string().min(1).max(128),
  domain: z.string().min(1).max(256),
  payload: z.json(),
});

/** Run while old writers are stopped. Import only missing rows; Redis stays untouched. */
export async function importRedisRecords(): Promise<{ imported: number; skipped: number }> {
  const redis = await getRedis();
  const database = getDatabase();
  let imported = 0;
  let skipped = 0;
  for (const pattern of ["johnbot:session:*", "johnbot:domain:*"]) {
    for await (const keys of redis.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      for (const key of keys) {
        const raw = await redis.get(key);
        if (raw === null) continue;
        const isSession = key.startsWith("johnbot:session:");
        const suffix = key.slice(isSession ? "johnbot:session:".length : "johnbot:domain:".length);
        const split = suffix.lastIndexOf(":");
        if (!isSession && split < 1) throw new Error("Invalid legacy domain key.");
        const record = legacySchema.parse({
          sessionId: isSession ? suffix : suffix.slice(split + 1),
          domain: isSession ? "session" : suffix.slice(0, split),
          payload: JSON.parse(raw),
        });
        const result = await database.domainRecord.createMany({
          data: [{ ...record, payload: jsonPayload(record.payload) }],
          skipDuplicates: true,
        });
        imported += result.count;
        skipped += 1 - result.count;
      }
    }
  }
  return { imported, skipped };
}
