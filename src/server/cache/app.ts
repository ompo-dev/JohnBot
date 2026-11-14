import { revalidateTag, unstable_cache } from "next/cache";
import {
  type AccountUsage,
  type AppInfo,
  accountUsageSchema,
  appInfoSchema,
} from "../../contracts/data-api";
import { STORY_APP_INFO } from "../../preview/fixtures";
import { loadSnapshot, usageFor } from "../repositories/session-store";
import { cachedDataQuery } from "./queries";

export const APP_INFO_TAG = "data:app-info";
export const usageTag = (sessionId: string) => `data:usage:${sessionId}`;

export interface CachedValue<T> {
  data: T;
  generatedAt: number;
}

const appInfoCache = unstable_cache(
  async (): Promise<CachedValue<AppInfo>> => ({
    data: appInfoSchema.parse(STORY_APP_INFO),
    generatedAt: Date.now(),
  }),
  ["data-app-info"],
  { tags: [APP_INFO_TAG], revalidate: 3_600 },
);

export function getCachedAppInfo(): Promise<CachedValue<AppInfo>> {
  return appInfoCache();
}

/** The tag is scoped per tenant; a cache shared globally would leak usage across sessions. */
function usageCache(sessionId: string) {
  return (agentId: string | null) =>
    cachedDataQuery(
      sessionId,
      `usage:${agentId ?? "all"}`,
      async (): Promise<CachedValue<AccountUsage>> => {
        const snapshot = await loadSnapshot(sessionId);
        const usage = usageFor(snapshot.auth);
        const data = agentId
          ? accountUsageSchema.parse({
              limits: usage.limits.filter((limit) => limit.id === agentId),
            })
          : usage;
        return { data, generatedAt: Date.now() };
      },
    );
}

export function getCachedUsage(
  sessionId: string,
  agentId: string | null,
): Promise<CachedValue<AccountUsage>> {
  return usageCache(sessionId)(agentId);
}

export async function revalidateUsage(sessionId: string): Promise<void> {
  revalidateTag(usageTag(sessionId), { expire: 0 });
}
