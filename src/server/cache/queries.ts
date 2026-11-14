import { createHash } from "node:crypto";
import { unstable_cache } from "next/cache";
import { getDatabase } from "../database/client";
import { storageUnavailable } from "../errors";
import { getRedis } from "./redis";
import { queryDomains, queryRevalidateSeconds } from "./policy";

/** Revision keys work across worker/web replicas without calling Next APIs in the worker. */
export async function cachedDataQuery<T>(
  sessionId: string,
  resource: string,
  load: () => Promise<T>,
): Promise<T> {
  const domains = queryDomains(resource);
  const seconds = queryRevalidateSeconds(resource);
  let revisions: { domain: string; revision: number }[];
  try {
    revisions = await getDatabase().domainRecord.findMany({
      where: { sessionId, ...(domains ? { domain: { in: domains } } : {}) },
      select: { domain: true, revision: true },
      orderBy: { domain: "asc" },
    });
  } catch (error) {
    throw storageUnavailable(error);
  }
  const signature = createHash("sha256").update(JSON.stringify(revisions)).digest("hex");
  let jobsVersion: string;
  try {
    jobsVersion = resource.startsWith("jobs:")
      ? JSON.stringify(
          await getDatabase().backgroundJob.findMany({
            where: { sessionId },
            select: { id: true, status: true, attempts: true, generation: true, updatedAt: true },
            orderBy: { id: "asc" },
          }),
        )
      : "";
  } catch (error) {
    throw storageUnavailable(error);
  }
  const key = createHash("sha256")
    .update(JSON.stringify([sessionId, resource, signature, jobsVersion]))
    .digest("hex");
  return unstable_cache(
    async () => {
      try {
        const raw = await (await getRedis()).get(`johnbot:cache:query:${key}`);
        if (raw !== null) return JSON.parse(raw) as T;
      } catch {
        /* A projection cache failure does not replace database data. */
      }
      const data = await load();
      try {
        await (await getRedis()).set(`johnbot:cache:query:${key}`, JSON.stringify(data), {
          expiration: { type: "EX", value: seconds },
        });
      } catch {
        /* The domain outbox and the next read repair the caches. */
      }
      return data;
    },
    ["data-query-v1", sessionId, resource, signature, key],
    {
      revalidate: seconds,
    },
  )();
}
