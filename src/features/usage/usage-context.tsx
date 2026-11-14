import { createEffect, untrack } from "solid-js";
import { createSimpleContext } from "../../simple-context";
import { useServers } from "../servers/servers-context";
import { useUrlSignal } from "../../lib/url-state";
import { productFeatures } from "../../lib/product-features";

/**
 * The host pane over the middle of the workspace: the usage report, the routine schedule or the
 * workflows. One state holds them, so each path that uncovers the conversation closes any of them.
 */
type HostPaneView = "usage" | "schedule" | "workflows" | "twin";

const context = createSimpleContext({
  name: "UsageProvider",
  init: () => {
    const { activeServerId } = useServers();
    const [page, setPage] = useUrlSignal("page");
    const [usageAgent, setUsageAgent] = useUrlSignal("usageAgent");
    const hostPage = (): HostPaneView | null => {
      const value = page();
      if (value === "routines") return "workflows";
      return value === "usage" || value === "schedule" || value === "workflows" || value === "twin" ? value : null;
    };
    const state = {
      get serverId() { return hostPage() ? activeServerId() : null; },
      get agentId() { return usageAgent() ?? undefined; },
      get view(): HostPaneView { return hostPage() ?? "usage"; },
    };
    let trigger: HTMLElement | null = null;

    function open(view: HostPaneView, serverId: string, source: HTMLElement | null, agentId?: string) {
      trigger = source;
      setUsageAgent(agentId ?? null);
      setPage(view === "workflows" && productFeatures.unifiedRoutines ? "routines" : view);
    }

    function openUsage(serverId: string, source: HTMLElement | null, agentId?: string) {
      open("usage", serverId, source, agentId);
    }

    function openSchedule(serverId: string, source: HTMLElement | null) {
      open("schedule", serverId, source);
    }

    function openWorkflows(serverId: string, source: HTMLElement | null) {
      open("workflows", serverId, source);
    }

    function openTwin(serverId: string, source: HTMLElement | null) {
      open("twin", serverId, source);
    }

    /**
     * An open report follows the host the user switches to.
     *
     * This has to live here rather than in the shell that renders the panel.
     * `ServerScopeBoundary` is keyed on the active server, so everything below it
     * is disposed and rebuilt by a switch - a shell effect would initialize its
     * "previous" server to the *new* one on every mount and could never see the
     * change. This provider sits above that boundary, which is the whole reason
     * the report survives a switch, and so is the only place that can observe it.
     *
     * The trigger goes with the old scope, so `null` replaces it: Back has nothing
     * to return focus to once the element it was opened from is gone.
     */
    let previousServer = untrack(activeServerId);
    createEffect(activeServerId, (serverId) => {
      if (serverId !== previousServer && untrack(() => state.serverId))
        open(
          untrack(() => state.view),
          serverId,
          null,
        );
      previousServer = serverId;
    });

    function clear() {
      if (hostPage()) setPage("agents");
      setUsageAgent(null);
    }

    return {
      state,
      openUsage,
      openSchedule,
      openWorkflows,
      openTwin,
      closeUsage() {
        clear();
        queueMicrotask(() => {
          if (trigger?.isConnected) trigger.focus({ preventScroll: true });
        });
      },
      /**
       * Back gives focus to the element the report was opened from; this does not.
       * A command that opens a conversation - a global search result, a Dynamic
       * Island action - has to uncover it first, and the destination owns focus
       * from there: the transcript scrolls to the message the user picked, and
       * pulling focus back to the rail button would undo that.
       */
      dismissUsage: clear,
    };
  },
});
export const UsageProvider = context.provider;
export const useUsage = context.use;
