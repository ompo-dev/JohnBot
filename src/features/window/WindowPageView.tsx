import { useText } from "@johnbot/ui/text";
import { Loading } from "solid-js";
import { AgentUsagePanel, JohnTwinPage, WorkflowsPage } from "../../lazy-views";
import { SkillsMarketplace } from "../../WorkspaceOverlays";
import { SchedulePanel } from "../schedule/SchedulePanel";
import { useServers } from "../servers/servers-context";
import { useUsage } from "../usage/usage-context";
import { SettingsPage } from "./SettingsPage";
import { useWindowPage } from "./window-page-context";
import { OperationsPage } from "../operations/OperationsPage";
import { productFeatures } from "../../lib/product-features";
import { useEffect } from "react";
import { useUrlActions } from "../../lib/url-state";

/**
 * The page of the desktop window that covers the conversation: a settings page, usage, schedule,
 * workflows or the Marketplace.
 */
export function WindowPageView() {
  const { t } = useText();
  const windowPage = useWindowPage();
  const usage = useUsage();
  const { servers, activeServerId } = useServers();
  const page = windowPage.page();
  const navigate = useUrlActions();
  useEffect(() => {
    if (page === "notebooks") navigate?.({ page: "agents", notebook: null }, { history: "replace" });
    if (page === "connections") navigate?.({ page: "marketplace", mpTab: "apps", mpInstalled: true }, { history: "replace" });
  }, [page, navigate]);
  if (page === "agents") return null;
  if (page === "notebooks" || page === "connections") return null;
  if (page === "dashboard" || page === "access") return <OperationsPage key={page} view={page} />;
  if (page === "settings") return <SettingsPage key={page} kind="personal" />;
  if (page === "server-settings") return productFeatures.serverManagement ? <SettingsPage key={page} kind="server" /> : null;
  if (page === "marketplace") return <SkillsMarketplace />;
  const serverId = activeServerId();
  if (!serverId) return null;
  const hostName = servers().find((server) => server.id === serverId)?.name ?? t("app.page.serverFallback");
  const loading = <p role="status">{t("app.loading")}</p>;
  switch (page) {
    case "schedule":
      return <SchedulePanel key={serverId} serverId={serverId} hostName={hostName} onBack={usage.closeUsage} />;
    case "workflows":
      return <Loading fallback={loading}><WorkflowsPage key={serverId} serverId={serverId} /></Loading>;
    case "twin":
      return <Loading fallback={loading}><JohnTwinPage hostName={hostName} onBack={usage.closeUsage} /></Loading>;
    case "usage":
      return (
        <Loading fallback={loading}>
          <AgentUsagePanel serverId={serverId} hostName={hostName} agentId={usage.state.agentId} onBack={usage.closeUsage} />
        </Loading>
      );
  }
}
