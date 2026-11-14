import type { SettingsPagePlacement } from "@johnbot/features/settings/SettingsDialogShell";
import { createEffect, createSignal, untrack } from "solid-js";
import { createSimpleContext } from "../../simple-context";
import { useServerSettings } from "../servers/server-settings";
import { useServers } from "../servers/servers-context";
import { useSettings } from "../settings/settings-context";
import { useUsage } from "../usage/usage-context";
import { useUrlSignal } from "../../lib/url-state";
import { productFeatures } from "../../lib/product-features";

/** The pages of the window rail. Each one fills the card below the top row. */
export type WindowPage =
  | "agents"
  | "dashboard"
  | "notebooks"
  | "connections"
  | "access"
  | "routines"
  | "schedule"
  | "workflows"
  | "twin"
  | "usage"
  | "marketplace"
  | "settings"
  | "server-settings";

/**
 * How a page sits in the window. A settings page starts below the top row. The John Twin renders
 * the agent sidebar itself, with the twin's entities in the place of the agents. The title of a
 * schedule, workflows, usage or Marketplace page goes in the top row after the server menu.
 */
export type WindowPageKind = "agents" | "settings" | "titled" | "twin";

export function windowPageKind(page: WindowPage): WindowPageKind {
  if (page === "settings" || page === "server-settings" || page === "access" || page === "dashboard") return "settings";
  if (page === "twin") return "twin";
  return page === "agents" ? "agents" : "titled";
}

/** The settings pages: the settings of the user, or the settings of one server. */
export type SettingsKind = "personal" | "server";

/**
 * The page of the desktop window, from the state that already opens each page: the settings flags,
 * the Marketplace flag and the host pane of `usage-context`. Every opener keeps its call, and this provider joins them.
 *
 * The user settings and the server settings are two pages. An opener of one closes the other. When
 * the user selects another server, the server settings page follows it.
 *
 * It sits above `ServerScopeBoundary`: the boundary rebuilds everything below it on a server switch,
 * so only a provider above it can see the switch.
 */
const context = createSimpleContext({
  name: "WindowPageProvider",
  init: () => {
    const settings = useSettings();
    const serverSettings = useServerSettings();
    const usage = useUsage();
    const { activeServerId } = useServers();
    /** The elements of the settings page that the settings panel shows in. The page sets them. */
    const [settingsMounts, setSettingsMounts] = createSignal<{ nav: HTMLElement; content: HTMLElement } | undefined>();

    // A single URL enum makes page flags mutually exclusive at their source.
    const [queryPage, setPage] = useUrlSignal("page");
    const [, setSidebar] = useUrlSignal("sidebar");
    const routineAlias = () => queryPage() === "routines" || (productFeatures.unifiedRoutines && queryPage() === "workflows");
    const page = () => routineAlias() ? "agents" as const : queryPage();
    createEffect(queryPage, () => {
      if (!routineAlias()) return;
      setSidebar("routines");
      setPage("agents");
    });

    // The server settings page follows the server that the user selects.
    createEffect(activeServerId, (serverId, previous) => {
      if (previous === undefined || serverId === previous || !serverId) return;
      // An effect calls this, and the opener reads the state of the server settings.
      if (untrack(serverSettings.serverSettingsOpen)) untrack(() => serverSettings.openServerSettings(serverId, null));
    });

    /** Where the panel of a settings page shows, or nothing while that page is not on screen. */
    function settingsPlacement(kind: SettingsKind): SettingsPagePlacement | undefined {
      const mounts = settingsMounts();
      if (!mounts || page() !== (kind === "personal" ? "settings" : "server-settings")) return undefined;
      return mounts;
    }

    return {
      page,
      /** Whether a page other than the agents covers the conversation. A message there is not seen. */
      conversationCovered: () => page() !== "agents",
      setSettingsMounts,
      settingsPlacement,
      /** Shows the agents and closes the other pages. */
      showAgents() {
        settings.setAppSettingsOpen(false);
        serverSettings.setServerSettingsOpen(false);
        settings.setSkillsMarketplaceOpen(false);
        usage.dismissUsage();
        setPage("agents");
      },
      openSchedule(source: HTMLElement | null) {
        const serverId = activeServerId();
        if (serverId) usage.openSchedule(serverId, source);
      },
      openWorkflows(source: HTMLElement | null) {
        const serverId = activeServerId();
        if (serverId) usage.openWorkflows(serverId, source);
      },
      openTwin(source: HTMLElement | null) {
        const serverId = activeServerId();
        if (serverId) usage.openTwin(serverId, source);
      },
      openUsage(source: HTMLElement | null) {
        const serverId = activeServerId();
        if (serverId) usage.openUsage(serverId, source);
      },
      openSettings(source: HTMLElement | null) {
        settings.openAppSettings(source);
      },
    };
  },
});

export const WindowPageProvider = context.provider;
export const useWindowPage = context.use;
