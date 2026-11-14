import {
  SKILL_CATEGORIES,
  type MarketplaceSkillSort,
  type SkillCategory,
} from "@johnbot/contracts/ipc";
import {
  isMarketplaceAgentId,
  isMarketplaceSkillSlug,
  type MarketplaceListingLink,
} from "@johnbot/contracts/marketplace-links";
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import type { MarketplaceTab, MarketplaceView, SkillGroup, SkillSource } from "./marketplace-view";

/** The view kinds that a URL can name. A listing view is fetched again from its id. */
export type MarketplaceQueryView =
  | "browse"
  | "app"
  | "agent"
  | "appGroup"
  | "agentGroup"
  | "skill"
  | "skillGroup"
  | "localSkill";

const TABS = ["apps", "agents", "skills"] as const satisfies readonly MarketplaceTab[];
const SORTS = ["installs", "updated", "name"] as const satisfies readonly MarketplaceSkillSort[];
const SOURCES = ["verified", "public"] as const satisfies readonly SkillSource[];
const VIEWS = [
  "browse",
  "app",
  "agent",
  "appGroup",
  "agentGroup",
  "skill",
  "skillGroup",
  "localSkill",
] as const satisfies readonly MarketplaceQueryView[];
const GROUPS = ["yours", ...SKILL_CATEGORIES] as const satisfies readonly SkillGroup[];

export const MARKETPLACE_QUERY_URL_KEYS = {
  tab: "mpTab",
  query: "mpQ",
  skillSort: "mpSort",
  agentSource: "mpAgentSource",
  skillSource: "mpSkillSource",
  view: "mpView",
  item: "mpItem",
} as const;

export const marketplaceQueryParsers = {
  tab: parseAsStringLiteral(TABS).withDefault("apps"),
  query: parseAsString.withDefault(""),
  skillSort: parseAsStringLiteral(SORTS).withDefault("installs"),
  agentSource: parseAsStringLiteral(SOURCES),
  skillSource: parseAsStringLiteral(SOURCES),
  view: parseAsStringLiteral(VIEWS).withDefault("browse"),
  item: parseAsString.withDefault(""),
} as const;

/** The Marketplace URL state. Field changes replace the history entry; view changes push one. */
export function useMarketplaceQuery() {
  return useQueryStates(marketplaceQueryParsers, {
    urlKeys: MARKETPLACE_QUERY_URL_KEYS,
    history: "replace",
    scroll: false,
  });
}

function isCategory(value: string): value is SkillCategory {
  return (SKILL_CATEGORIES as readonly string[]).includes(value);
}

function isGroup(value: string): value is SkillGroup {
  return (GROUPS as readonly string[]).includes(value);
}

function safeItem(item: string): string {
  return item.length > 0 && item.length <= 512 ? item : "";
}

/** The listing that a URL names. A missing, malformed or unknown pair is no listing. */
export function marketplaceListingFromQuery(
  view: MarketplaceQueryView,
  item: string,
): MarketplaceListingLink | null {
  if (view === "agent" && isMarketplaceAgentId(item)) return { kind: "agent", id: item };
  if (view === "skill" && isMarketplaceSkillSlug(item)) return { kind: "skill", id: item };
  return null;
}

/** The view that a URL names. A listing needs its fetched object, so it starts on the list. */
export function marketplaceViewFromQuery(view: MarketplaceQueryView, item: string): MarketplaceView {
  const id = safeItem(item);
  switch (view) {
    case "app":
      return id ? { kind: "app", id } : { kind: "browse" };
    case "appGroup":
      return isCategory(id) ? { kind: "appGroup", category: id } : { kind: "browse" };
    case "agentGroup":
      return isCategory(id) ? { kind: "agentGroup", category: id } : { kind: "browse" };
    case "skillGroup":
      return isGroup(id) ? { kind: "skillGroup", group: id } : { kind: "browse" };
    case "localSkill":
      return id ? { kind: "localSkill", skillId: id } : { kind: "browse" };
    default:
      return { kind: "browse" };
  }
}

/** The URL pair of a view. A fetched listing view has no URL pair and reads as browse. */
export function marketplaceQueryView(view: MarketplaceView | undefined): {
  view: MarketplaceQueryView;
  item: string;
} {
  switch (view?.kind) {
    case "app":
      return { view: "app", item: view.id };
    case "agent":
      return { view: "agent", item: view.listing.id };
    case "skill":
      return { view: "skill", item: view.listing.slug };
    case "appGroup":
      return { view: "appGroup", item: view.category };
    case "agentGroup":
      return { view: "agentGroup", item: view.category };
    case "skillGroup":
      return { view: "skillGroup", item: view.group };
    case "localSkill":
      return { view: "localSkill", item: view.skillId };
    default:
      return { view: "browse", item: "" };
  }
}

/** The URL pair as one comparable string, so only a real view change reloads the stack. */
export function marketplaceViewKey(view: MarketplaceQueryView, item: string): string {
  return `${view}:${item}`;
}
