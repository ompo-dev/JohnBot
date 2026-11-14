import { AgentAvatar } from "../agents/AgentAvatar";

/** The same animated agent avatar used throughout JohnBot. */
export function MarketplaceNoMatchPlush() {
  return <span className="marketplace-empty-plush" aria-hidden="true"><AgentAvatar seed="johnbot-marketplace" hue={245} motion="idle" followPointer style={{width:"72px",height:"72px"}} /></span>;
}
