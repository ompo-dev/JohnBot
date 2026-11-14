/**
 * What the list shows with nothing in it. A brand new profile offers `props.emptyAction` - the first
 * agent, rendered as a pressed row so the sidebar is never a blank column. A roster still on its way
 * from a joined server says that it connects.
 */

import { Button } from "@johnbot/ui";
import { Show } from "solid-js";
import { useText } from "../../components/text";
import { AgentAvatar } from "../agents/AgentAvatar";
import { useSidebarScope } from "./sidebar-scope";

export function SidebarEmptyState() {
  const { props } = useSidebarScope();
  const { t } = useText();
  return (
    <Show
      when={props.emptyAction}
      fallback={
        <p className="empty-search">{props.agentsConnecting ? t("common.connecting") : t("sidebar.empty.noAgents")}</p>
      }
    >
      {(action) => (
        <div className={props.layout.sections.length === 0 ? "sidebar-first-agent-state" : undefined}>
          <Button
            variant="ghost"
            type="button"
            className="agent-row agent-row-active sidebar-first-agent-action"
            aria-label={action().label}
            aria-pressed="true"
            data-avatar-seed={action().avatarSeed}
            data-avatar-hue={action().avatarHue ?? "automatic"}
            onClick={action().onSelect}
          >
            <span className="agent-row-avatar">
              <AgentAvatar seed={action().avatarSeed} hue={action().avatarHue} motion="hover" />
            </span>
            <span className="agent-row-copy">
              <span className="agent-row-heading">
                <span className="agent-row-title">
                  <strong>{action().label}</strong>
                </span>
              </span>
            </span>
          </Button>
        </div>
      )}
    </Show>
  );
}
