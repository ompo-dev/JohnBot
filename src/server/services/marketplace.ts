import { STORY_AGENT_SUBMISSIONS } from "../../preview/fixtures";
import { readDomain } from "../repositories/domain-store";
import { marketplaceDomainSchema } from "../../contracts/marketplace-data";
import { serverEnv } from "../config/env";

export const MARKETPLACE_DOMAIN = "marketplace";
export const marketplaceSeed = () => ({ submissions: serverEnv().dataMode === "demo" ? STORY_AGENT_SUBMISSIONS : [] });

export function readMarketplace(sessionId: string) {
  return readDomain(sessionId, MARKETPLACE_DOMAIN, marketplaceDomainSchema, marketplaceSeed);
}
