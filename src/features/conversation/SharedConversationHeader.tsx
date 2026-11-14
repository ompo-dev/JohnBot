import { Badge, Button, Clock3, Lock } from "@johnbot/ui";
import { ProviderModelPicker } from "@johnbot/ui/ProviderModelPicker";
import type { AgentProfile } from "@johnbot/ui/data";
import { AgentAvatar } from "@johnbot/features/agents/AgentAvatar";
import { agentAccessLockLabel } from "@johnbot/features/agents/agent-access";
import { RemoteDesktopIcon } from "@johnbot/features/conversation/ConversationIcons";
import { SidePanelToggle, type SidePanelToggleProps } from "@johnbot/features/conversation/SidePanel";
import { useText } from "@johnbot/ui/text";
import type { ComponentProps, JSX } from "@solidjs/web";
import { Show } from "solid-js";
import { cn } from "../../components/utils";

export interface ConversationHeaderProps {
  agent: AgentProfile | null | undefined;
  /** The title of a chat that has no one agent, such as a channel. It shows when `agent` is missing. */
  title?: JSX.Element | undefined;
  modelPicker: ComponentProps<typeof ProviderModelPicker>;
  /** A model, effort, provider or account chosen during the running turn. It applies from the next turn. */
  pendingModel?: ConversationHeaderPendingModel | undefined;
  onSettingsIntent: () => void;
  onOpenSettings: () => void;
  /** Set while a side thread is open: the agent's name then opens the agent's own chat, not its settings. */
  onOpenChat?: (() => void) | undefined;
  remoteControl?: ConversationHeaderRemoteControl | undefined;
  /** Missing when the chat has no side panel, such as a deleted channel. */
  sidePanel?: SidePanelToggleProps | undefined;
  /** The thread tabs of the agent, after its name. */
  threads?: JSX.Element | undefined;
}

export interface ConversationHeaderPendingModel {
  /** The model, and the effort when it changes too, of the running turn. */
  running: string;
  /** The same for the next turn. */
  next: string;
}

export interface ConversationHeaderRemoteControl {
  enabled: boolean;
  active: boolean;
  visible: boolean;
  onOpen: (trigger: HTMLButtonElement) => void;
}

export function ConversationHeader(props: ConversationHeaderProps) {
  const { t } = useText();
  return (
    <header className={cn("window-drag conversation-header flex items-center justify-between")}>
      <div className={cn("conversation-heading-group flex min-w-0 items-center gap-[7px]")}>
        <Show when={props.agent} fallback={props.title}>
          {(agent) => (
            <Button
              variant="ghost"
              size="sm"
              type="button"
              className="conversation-title no-drag"
              aria-label={props.onOpenChat ? t("conversation.header.mainChat") : t("conversation.header.settings")}
              onPointerEnter={() => props.onOpenChat || props.onSettingsIntent()}
              onFocus={() => props.onOpenChat || props.onSettingsIntent()}
              onClick={() => (props.onOpenChat ?? props.onOpenSettings)()}
            >
              <AgentAvatar agent={agent()} />
              <h1>{agent().name}</h1>
            </Button>
          )}
        </Show>
        <Show when={props.agent && agentAccessLockLabel(props.agent, t)}>
          {(label) => (
            <span className="conversation-access-lock" role="img" aria-label={label()} title={label()}>
              <Lock aria-hidden="true" />
            </span>
          )}
        </Show>
        {props.threads}
      </div>
      <div className={cn("conversation-header-actions no-drag flex min-w-0 items-center gap-[6px]")}>
        <Show when={props.agent && props.pendingModel}>
          {(change) => {
            const detail = () => t("conversation.header.modelNextTurnDetail", change());
            return (
              <Badge variant="info-light" className="conversation-model-pending" role="status" title={detail()}>
                <Clock3 aria-hidden="true" />
                {t("conversation.header.modelNextTurn")}
                <span className="sr-only">{detail()}</span>
              </Badge>
            );
          }}
        </Show>
        <Show when={props.agent}>
          <ProviderModelPicker {...props.modelPicker} />
        </Show>
        <Show when={props.remoteControl}>
          {(control) => (
            <Button
              variant="ghost"
              type="button"
              className="header-panel-toggle remote-desktop-button"
              aria-label={t(control().active ? "conversation.header.resumeRemote" : "conversation.header.openRemote")}
              aria-expanded={control().visible ? "true" : "false"}
              disabled={!control().enabled}
              onClick={(event) => control().onOpen(event.currentTarget)}
              data-cuelume-tap="open"
            >
              <RemoteDesktopIcon />
              <Show when={control().active}>
                <span className="remote-desktop-button-dot" aria-hidden="true" />
              </Show>
            </Button>
          )}
        </Show>
        <Show when={props.sidePanel}>{(sidePanel) => <SidePanelToggle {...sidePanel()} />}</Show>
      </div>
    </header>
  );
}
