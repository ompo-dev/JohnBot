/**
 * A small chat over the canvas, where the user asks an agent to change the diagram. The agent's
 * reply lists the edits it made, so the user can match each line to what moved on the canvas.
 * Collapsed, it is one button, and the canvas keeps the whole area. The button and the panel are
 * both always mounted, so the panel can grow out of the button's shape and fold back into it; the
 * hidden one is inert. The user drags the chat by the button or the panel header, inside the canvas.
 */

import { ArrowUp, Bubble, BubbleContent, Button, Check, Minimize2, Spinner } from "@johnbot/ui";
import { createEffect, createSignal, For, Show } from "solid-js";
import type { AvatarMood } from "../../components/bloub-avatar";
import type { AgentProfile } from "../../data";
import { useText } from "../../components/text";
import { AgentAvatar } from "../agents/AgentAvatar";
import { ComposerEditor } from "../conversation/ComposerEditor";
import { MarkdownMessageText } from "../conversation/MarkdownMessageText";
import type { DiagramChatMessage } from "./diagram-model";

/** A press that moves less than this is a click, so the button still opens the panel. */
const DRAG_THRESHOLD_PX = 4;

export interface DiagramChatPanelProps {
  labels?: { launcher: string; title: string; empty: string; placeholder: string };
  agent: AgentProfile;
  messages: DiagramChatMessage[];
  /** True while the agent works on the last message. */
  working: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (text: string) => void;
  /** Opens a link in an agent's answer. Without it, links do nothing. */
  onOpenLink?: ((url: string) => void) | undefined;
}

export function DiagramChatPanel(props: DiagramChatPanelProps) {
  const { t } = useText();
  const [draft, setDraft] = createSignal("");
  const mood = (): AvatarMood => (props.working ? "working" : "idle");
  const [focusRequest, setFocusRequest] = createSignal(0);
  const [offset, setOffset] = createSignal({ x: 0, y: 0 });
  let launcher: HTMLElement | undefined;
  let log: HTMLDivElement | undefined;
  /** A new message, or the agent starting on one, scrolls the log to its end. */
  createEffect(
    () => [props.messages.length, props.working] as const,
    () => {
      requestAnimationFrame(() => log?.scrollTo({ top: log.scrollHeight }));
    },
  );
  let morph: HTMLDivElement | undefined;
  /** Set by a press that moved the chat, so the click that ends it does not open the panel. */
  let dragged = false;
  const startDrag = (event: PointerEvent & { currentTarget: HTMLElement }) => {
    if (event.button !== 0 || !morph) return;
    const handle = event.currentTarget;
    const area = morph.parentElement?.offsetParent?.getBoundingClientRect();
    const box = morph.getBoundingClientRect();
    const start = { x: event.clientX, y: event.clientY, offset: offset() };
    dragged = false;
    const move = (moveEvent: PointerEvent) => {
      let dx = moveEvent.clientX - start.x;
      let dy = moveEvent.clientY - start.y;
      if (!dragged && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      dragged = true;
      if (area) {
        dx = Math.min(Math.max(dx, area.left - box.left), area.right - box.right);
        dy = Math.min(Math.max(dy, area.top - box.top), area.bottom - box.bottom);
      }
      setOffset({ x: start.offset.x + dx, y: start.offset.y + dy });
    };
    const end = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
    };
    handle.setPointerCapture(event.pointerId);
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  };
  /** Focus follows the surface that is now shown, once it has stopped being inert. */
  const setOpen = (open: boolean) => {
    props.onOpenChange(open);
    requestAnimationFrame(() => (open ? setFocusRequest((count) => count + 1) : launcher?.focus()));
  };
  const send = () => {
    const text = draft().trim();
    if (!text || props.working) return;
    props.onSend(text);
    setDraft("");
  };
  return (
    <div
      ref={(element) => (morph = element)}
      className="diagram-chat-morph"
      data-open={props.open ? "true" : "false"}
      data-diagram-overlay=""
      style={{ translate: `${offset().x}px ${offset().y}px` }}
    >
      <Button
        ref={(element) => (launcher = element)}
        type="button"
        variant="outline"
        className="diagram-chat-launcher"
        aria-expanded="false"
        aria-hidden={props.open ? "true" : undefined}
        tabIndex={props.open ? -1 : 0}
        onPointerDown={startDrag}
        onClick={() => {
          if (dragged) dragged = false;
          else setOpen(true);
        }}
      >
        <AgentAvatar agent={props.agent} className="diagram-chat-avatar" motion="idle" />
        {props.labels?.launcher ?? t("diagram.chat.show")}
      </Button>
      <section
        className="diagram-chat"
        aria-label={props.labels?.title ?? t("diagram.chat.label")}
        inert={!props.open}
      >
        <header
          className="diagram-chat-header"
          onPointerDown={(event) => {
            if (!(event.target instanceof Element && event.target.closest("button")))
              startDrag(event);
          }}
        >
          <AgentAvatar
            agent={props.agent}
            className="diagram-chat-avatar"
            motion="idle"
            mood={mood()}
          />
          <h2 className="diagram-chat-title">
            {props.labels?.title ?? t("diagram.chat.title", { name: props.agent.name })}
          </h2>
          <Button
            type="button"
            variant="ghost"
            className="header-panel-toggle"
            aria-label={t("diagram.chat.hide")}
            title={t("diagram.chat.hide")}
            onClick={() => setOpen(false)}
          >
            <Minimize2 aria-hidden="true" className="size-[14px]" />
          </Button>
        </header>

        <div
          ref={(element) => (log = element)}
          className="diagram-chat-messages"
          role="log"
          aria-live="polite"
        >
          <Show
            when={props.messages.length > 0}
            fallback={
              <p className="diagram-chat-empty">
                {props.labels?.empty ?? t("diagram.chat.empty", { name: props.agent.name })}
              </p>
            }
          >
            <For each={props.messages}>
              {(message) => (
                <Bubble
                  align={message.author === "user" ? "end" : "start"}
                  variant={message.author === "user" ? "secondary" : "muted"}
                  className="diagram-chat-bubble"
                >
                  <BubbleContent>
                    <Show
                      when={message.author === "agent"}
                      fallback={<p className="diagram-chat-text">{message.text}</p>}
                    >
                      {/* An agent answers in Markdown, as in the chat. */}
                      <div className="diagram-chat-markdown message-markdown">
                        <MarkdownMessageText
                          body={message.text}
                          agents={[]}
                          onSelectAgent={() => undefined}
                          onOpenLink={(url) => props.onOpenLink?.(url)}
                        />
                      </div>
                    </Show>
                    <Show when={message.changes?.length ? message.changes : undefined}>
                      {(changes) => (
                        <ul className="diagram-chat-changes" aria-label={t("diagram.chat.changes")}>
                          <For each={changes()}>
                            {(change) => (
                              <li>
                                <Check aria-hidden="true" />
                                <span>{change}</span>
                              </li>
                            )}
                          </For>
                        </ul>
                      )}
                    </Show>
                  </BubbleContent>
                </Bubble>
              )}
            </For>
          </Show>
          <Show when={props.working}>
            <p className="diagram-chat-working">
              <Spinner size="sm" />
              {t("diagram.chat.working", { name: props.agent.name })}
            </p>
          </Show>
        </div>

        <form
          className="composer diagram-chat-composer"
          data-compact=""
          onSubmit={(event: SubmitEvent) => {
            event.preventDefault();
            send();
          }}
        >
          <div className="composer-input-label">
            <ComposerEditor
              agentId={undefined}
              agents={[]}
              value={draft()}
              placeholder={props.labels?.placeholder ?? t("diagram.chat.placeholder")}
              ariaLabel={props.labels?.placeholder ?? t("diagram.chat.placeholder")}
              disabled={false}
              focusRequest={focusRequest()}
              onValueChange={setDraft}
              onSubmit={send}
            />
          </div>
          <div className="composer-primary-actions">
            <Button
              type="submit"
              variant="ghost"
              className="voice-button"
              disabled={!draft().trim() || props.working}
              aria-label={t("diagram.chat.send")}
              title={t("diagram.chat.send")}
            >
              <ArrowUp aria-hidden="true" />
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
