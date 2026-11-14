import { createHash } from "node:crypto";
import { getRedis } from "./redis";

export const domainCacheKey = (sessionId: string, domain: string) =>
  `johnbot:cache:domain:${createHash("sha256")
    .update(JSON.stringify([sessionId, domain]))
    .digest("hex")}`;
const publish = `
local raw = redis.call('GET', KEYS[1])
if raw then
  local ok, current = pcall(cjson.decode, raw)
  if ok and type(current) == 'table' and tonumber(current.revision) and tonumber(current.revision) > tonumber(ARGV[1]) then return 0 end
end
redis.call('SET', KEYS[1], ARGV[2], 'EX', 300)
return 1
`;

export async function publishDomainCache(
  sessionId: string,
  domain: string,
  revision: number,
  data: unknown,
): Promise<void> {
  const redis = await getRedis();
  await redis.eval(publish, {
    keys: [domainCacheKey(sessionId, domain)],
    arguments: [String(revision), JSON.stringify({ revision, data })],
  });
}

export async function readDomainCache(
  sessionId: string,
  domain: string,
  revision: number,
): Promise<unknown | undefined> {
  const raw = await (await getRedis()).get(domainCacheKey(sessionId, domain));
  if (!raw) return undefined;
  try {
    const cached = JSON.parse(raw);
    return cached?.revision === revision && Object.hasOwn(cached, "data") ? cached.data : undefined;
  } catch {
    return undefined;
  }
}
