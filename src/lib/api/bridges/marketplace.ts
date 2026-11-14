import {
  agentSubmissionSchema,
  marketplaceAgentDetailSchema,
  marketplaceAgentPageSchema,
  marketplaceSubmissionsSchema,
  marketplacePublicationPreviewSchema,
  submitMarketplaceAgentSchema,
} from "../../../contracts/marketplace-data";
import type { MockjohnBotControls } from "../../../preview/mock-johnbot";
import { getData, runCommand } from "../client";

/** Replaces catalog and publication JSON calls; install remains a local host operation. */
export function installMarketplaceData(mock: MockjohnBotControls): void {
  const api = mock.api;
  const nativePreview = api.marketplaceAgents.preview;
  api.marketplaceAgents.list = async (query) => {
    const params = new URLSearchParams();
    if (query)
      for (const [key, value] of Object.entries(query))
        if (value !== undefined) params.set(key, String(value));
    return getData(
      `/api/marketplace/agents${params.size ? `?${params}` : ""}`,
      marketplaceAgentPageSchema,
    );
  };
  api.marketplaceAgents.get = (id) =>
    getData(`/api/marketplace/agents/${encodeURIComponent(id)}`, marketplaceAgentDetailSchema);
  api.marketplaceAgents.getListing = (id) =>
    getData(
      `/api/marketplace/agents/${encodeURIComponent(id)}?listing=1`,
      marketplaceAgentDetailSchema,
    );
  api.marketplaceAgents.listMine = async () =>
    getData("/api/marketplace/submissions", marketplaceSubmissionsSchema);
  api.marketplaceAgents.submit = async (input) => {
    const preview = marketplacePublicationPreviewSchema.parse(await nativePreview(input.agentId));
    const payload = submitMarketplaceAgentSchema.parse({ ...input, preview });
    return (await runCommand("marketplace.submit", payload, agentSubmissionSchema)).data;
  };
}
