import type { z } from "zod";
import { Prisma } from "../../generated/prisma/client";
import { getDatabase } from "../database/client";
import { ApiError, storageUnavailable } from "../errors";
import { getRedis } from "../cache/redis";
import { publishDomainCache, readDomainCache } from "../cache/domain";

export function jsonPayload(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  const json = JSON.parse(JSON.stringify(value));
  return json === null ? Prisma.JsonNull : json;
}

function decode<T>(value: unknown, schema: z.ZodType<T>): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ApiError(500, "internal_error", "Stored domain data is invalid.");
  return parsed.data;
}

async function snapshot<T>(sessionId: string, domain: string, schema: z.ZodType<T>, seed: () => T) {
  const database = getDatabase();
  const where = { sessionId_domain: { sessionId, domain } };
  try {
    const metadata = await database.domainRecord.findUnique({ where, select: { revision: true } });
    if (metadata) {
      try {
        const cached = await readDomainCache(sessionId, domain, metadata.revision);
        const parsed = schema.safeParse(cached);
        if (cached !== undefined && parsed.success)
          return { revision: metadata.revision, data: parsed.data };
      } catch {
        /* PostgreSQL remains authoritative when Redis is unavailable. */
      }
    }
    let row = await database.domainRecord.findUnique({ where });
    if (!row) {
      // Upgrade existing sessions without overwriting records already committed to PostgreSQL.
      const redis = await getRedis();
      const legacyKey =
        domain === "session"
          ? `johnbot:session:${sessionId}`
          : `johnbot:domain:${domain}:${sessionId}`;
      const legacy = await redis.get(legacyKey);
      let initial: T;
      if (legacy === null) initial = schema.parse(seed());
      else {
        let parsed: unknown;
        try {
          parsed = JSON.parse(legacy);
        } catch {
          throw new ApiError(500, "internal_error", "Stored domain data is invalid.");
        }
        initial = decode(parsed, schema);
      }
      await database.domainRecord.createMany({
        data: [{ sessionId, domain, payload: jsonPayload(initial) }],
        skipDuplicates: true,
      });
      row = await database.domainRecord.findUniqueOrThrow({ where });
    }
    const data = decode(row.payload, schema);
    await publishDomainCache(sessionId, domain, row.revision, data).catch(() => undefined);
    return { revision: row.revision, data };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw storageUnavailable(error);
  }
}

/** Domains are internal constants; handlers supply the authenticated demo session scope. */
export async function readDomain<T>(
  sessionId: string,
  domain: string,
  schema: z.ZodType<T>,
  seed: () => T,
): Promise<T> {
  return (await snapshot(sessionId, domain, schema, seed)).data;
}

/** Change is synchronous and may be reapplied on contention; it must have no external effects. */
export async function updateDomain<T>(
  sessionId: string,
  domain: string,
  schema: z.ZodType<T>,
  seed: () => T,
  change: (current: T) => T,
): Promise<T> {
  const database = getDatabase();
  for (let attempt = 0; attempt < 30; attempt++) {
    const current = await snapshot(sessionId, domain, schema, seed);
    const next = schema.parse(change(current.data));
    try {
      const written = await database.$transaction(async (tx) => {
        const result = await tx.domainRecord.updateMany({
          where: { sessionId, domain, revision: current.revision },
          data: { payload: jsonPayload(next), revision: { increment: 1 } },
        });
        if (result.count === 1)
          await tx.backgroundJob.create({
            data: { sessionId, domain, revision: current.revision + 1 },
          });
        return result;
      });
      if (written.count === 1) {
        await publishDomainCache(sessionId, domain, current.revision + 1, next).catch(
          () => undefined,
        );
        return next;
      }
    } catch (error) {
      throw storageUnavailable(error);
    }
  }
  throw new ApiError(409, "conflict", "The domain changed too often to save this update.");
}
