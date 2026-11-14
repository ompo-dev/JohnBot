import { z } from "zod";
import { serverEnv } from "../config/env";
import { readDomain } from "../repositories/domain-store";
import { STORY_MARKETPLACE_AGENTS, STORY_MARKETPLACE_AGENT_DETAILS } from "../../preview/fixtures";
import {
  marketplaceAgentDetailSchema,
  marketplaceAgentPageSchema,
} from "../../contracts/marketplace-data";
const catalogSchema = z.object({ page: marketplaceAgentPageSchema, details: z.array(marketplaceAgentDetailSchema).max(1000) });
const catalog = (sessionId: string) => readDomain(sessionId, "marketplace-catalog", catalogSchema,
  () => ({ page: { agents: [], nextCursor: null }, details: [] }));

export async function getMarketplacePage(
  sessionId: string,
  query: {
    query?: string;
    category?: string;
    featured?: boolean;
    verified?: boolean;
    sort?: "installs";
    cursor?: string;
    limit?: number;
  },
) {
  const source = serverEnv().dataMode === "demo" ? STORY_MARKETPLACE_AGENTS : (await catalog(sessionId)).page.agents;
  const cached = async () => {
      const needle = query.query?.trim().toLocaleLowerCase();
      const matches = source.filter(
        (agent) =>
          (!needle ||
            `${agent.name} ${agent.title} ${agent.description} ${agent.creatorName}`
              .toLocaleLowerCase()
              .includes(needle)) &&
          (!query.category || (agent.category ?? "other") === query.category) &&
          (query.featured !== true || agent.featured) &&
          (query.verified === undefined || (agent.verified === true) === query.verified),
      ).sort((left, right) =>
        query.sort === "installs"
          ? right.installs - left.installs || left.name.localeCompare(right.name)
          : Number(right.featured) - Number(left.featured) ||
            right.updatedAt.localeCompare(left.updatedAt),
      );
      const start = Number(query.cursor ?? 0);
      const end = start + (query.limit ?? 50);
      return marketplaceAgentPageSchema.parse({
        agents: matches.slice(start, end),
        nextCursor: end < matches.length ? String(end) : null,
      });
    };
  return cached();
}

export async function getMarketplaceAgent(id: string, sessionId?: string) {
  if (serverEnv().dataMode !== "demo") {
    if (!sessionId) return undefined;
    return (await catalog(sessionId)).details.find((entry) => entry.id === id);
  }
  const detail = STORY_MARKETPLACE_AGENT_DETAILS[id];
  return detail ? marketplaceAgentDetailSchema.parse(detail) : undefined;
}

export async function getMarketplaceListing(id: string, sessionId?: string) {
  if (serverEnv().dataMode !== "demo") return getMarketplaceAgent(id, sessionId);
  const detail = STORY_MARKETPLACE_AGENT_DETAILS[id];
  return detail ? marketplaceAgentDetailSchema.parse(detail) : undefined;
}
