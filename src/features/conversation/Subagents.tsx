import { cn } from "../../components/utils";
import type {
  ConversationSubagent,
  ConversationSubagentStatus,
  ConversationSubagentStepKind,
} from "@johnbot/contracts/ipc";
import type { AppTextKey } from "@johnbot/i18n";
import {
  Badge,
  Brain,
  Button,
  ChevronRight,
  CircleCheck,
  Code,
  File,
  Globe2,
  LoaderCircle,
  MessageCircle,
  Minus,
  Pencil,
  Puzzle,
  RadialProgress,
  Search,
  TriangleAlert,
  X,
} from "@johnbot/ui";
import { useText } from "@johnbot/ui/text";
import type { JSX } from "@solidjs/web";
import { createEffect, createMemo, createSignal, createUniqueId, For, Match, Show, Switch } from "solid-js";

const STATE_LABEL = {
  running: "chat.subagents.state.running",
  completed: "chat.subagents.state.completed",
  failed: "chat.subagents.state.failed",
  stopped: "chat.subagents.state.stopped",
} as const satisfies Record<ConversationSubagentStatus, AppTextKey>;

/** The Claude type of a subagent with no special role. The meta line does not name it. */
const GENERAL_AGENT_TYPE = "general-purpose";

/** The time now, once a second while `running` is true. */
function createClock(running: () => boolean) {
  const [now, setNow] = createSignal(Date.now());
  createEffect(running, (active) => {
    setNow(Date.now());
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  });
  return now;
}

function timeOf(value: string | null, fallback: number): number {
  const time = value === null ? Number.NaN : Date.parse(value);
  return Number.isFinite(time) ? time : fallback;
}

function elapsedMs(subagent: ConversationSubagent, now: number): number {
  return timeOf(subagent.endedAt, now) - timeOf(subagent.startedAt, now);
}

/** "12s" or "1m 05s": the time of a subagent, or of a turn in its steps row. */
export function useDuration() {
  const { t } = useText();
  return (ms: number) => {
    const total = Math.max(0, Math.floor(ms / 1_000));
    if (total < 60) return t("chat.subagents.seconds", { seconds: total });
    return t("chat.subagents.minutes", {
      minutes: Math.floor(total / 60),
      seconds: String(total % 60).padStart(2, "0"),
    });
  };
}

function StepGlyph(props: { kind: ConversationSubagentStepKind; className: string }): JSX.Element {
  return (
    <Switch>
      <Match when={props.kind === "thinking"}>
        <Brain className={props.className} aria-hidden="true" />
      </Match>
      <Match when={props.kind === "search"}>
        <Search className={props.className} aria-hidden="true" />
      </Match>
      <Match when={props.kind === "read"}>
        <File className={props.className} aria-hidden="true" />
      </Match>
      <Match when={props.kind === "web"}>
        <Globe2 className={props.className} aria-hidden="true" />
      </Match>
      <Match when={props.kind === "edit"}>
        <Pencil className={props.className} aria-hidden="true" />
      </Match>
      <Match when={props.kind === "command"}>
        <Code className={props.className} aria-hidden="true" />
      </Match>
      <Match when={props.kind === "text"}>
        <MessageCircle className={props.className} aria-hidden="true" />
      </Match>
      <Match when={props.kind === "tool"}>
        <Puzzle className={props.className} aria-hidden="true" />
      </Match>
    </Switch>
  );
}

/** The state of one subagent, in the icons and colours of the chat action markers. */
function SubagentStatus(props: { status: ConversationSubagentStatus }) {
  const { t } = useText();
  return (
    <span className="subagents-status" data-state={props.status} role="img" aria-label={t(STATE_LABEL[props.status])}>
      <Show when={props.status === "running"}>
        <LoaderCircle className="subagents-status-icon" aria-hidden="true" />
      </Show>
      <Show when={props.status === "completed"}>
        <CircleCheck className="subagents-status-icon" aria-hidden="true" />
      </Show>
      <Show when={props.status === "failed"}>
        <X className="subagents-status-icon" aria-hidden="true" />
      </Show>
      <Show when={props.status === "stopped"}>
        <Minus className="subagents-status-icon" aria-hidden="true" />
      </Show>
    </span>
  );
}

/** What the subagent does now, with the icon of that kind of step, or how it ended. */
function LiveLine(props: { subagent: ConversationSubagent }) {
  const { t } = useText();
  /** The step that the line shows: the current step, or the answer of a subagent that ended. */
  const shown = () => {
    const last = props.subagent.steps.at(-1);
    if (props.subagent.status === "running") return last;
    return props.subagent.status !== "failed" && last?.kind === "text" ? last : undefined;
  };
  const text = () => {
    const subagent = props.subagent;
    if (subagent.status === "failed") return subagent.error ?? t(STATE_LABEL.failed);
    return shown()?.text ?? t(STATE_LABEL[subagent.status]);
  };
  return (
    <span className="subagents-live" data-state={props.subagent.status}>
      <Show when={shown()}>{(step) => <StepGlyph kind={step().kind} className="subagents-live-glyph" />}</Show>
      <span className={cn("subagents-live-text", { "agent-activity-label": props.subagent.status === "running" })}>
        {text()}
      </span>
    </span>
  );
}

export interface SubagentGroupProps {
  subagents: readonly ConversationSubagent[];
  /** The subagent that the side panel shows now. */
  selectedId?: string | null | undefined;
  /** Opens the subagent in the side panel, or closes the panel when it shows that subagent. */
  onOpen: (subagentId: string) => void;
}

/**
 * The subagents that an agent started in one turn. The header shows how far they are and opens or
 * closes the list; the list is open while a subagent works, unless the user chose. Each row shows
 * what its subagent does now. A click on a row opens its steps in the side panel.
 */
export function SubagentGroup(props: SubagentGroupProps) {
  const { t } = useText();
  const duration = useDuration();
  const listId = createUniqueId();
  const total = () => props.subagents.length;
  const running = () => props.subagents.filter((subagent) => subagent.status === "running").length;
  const failed = () => props.subagents.filter((subagent) => subagent.status === "failed").length;
  const finished = () => total() - running();
  const now = createClock(() => running() > 0);
  const [choice, setChoice] = createSignal<boolean>();
  const expanded = () => choice() ?? running() > 0;
  const groupElapsed = createMemo(() => {
    const current = now();
    const start = Math.min(...props.subagents.map((subagent) => timeOf(subagent.startedAt, current)));
    const end =
      running() > 0 ? current : Math.max(...props.subagents.map((subagent) => timeOf(subagent.endedAt, current)));
    return duration(end - start);
  });
  const rowLabel = (subagent: ConversationSubagent) =>
    t("chat.subagents.open", {
      title: subagent.title,
      state: t(STATE_LABEL[subagent.status]).toLocaleLowerCase(),
    });
  return (
    <section className="subagents-group" aria-label={t("chat.subagents.label")}>
      <Button
        type="button"
        variant="ghost"
        className="subagents-group-header"
        aria-expanded={expanded() ? "true" : "false"}
        aria-controls={expanded() ? listId : undefined}
        onClick={() => setChoice(!expanded())}
      >
        <span className="subagents-group-title">
          {running() > 0
            ? t("chat.subagents.running", { count: total() })
            : t("chat.subagents.ran", { count: total() })}
        </span>
        <Show
          when={running() > 0}
          fallback={
            <Badge className="subagents-progress">
              {t("chat.subagents.done", { count: finished() - failed() })}
              <Show when={failed() > 0}>
                <span className="subagents-progress-failed">· {t("chat.subagents.failed", { count: failed() })}</span>
              </Show>
            </Badge>
          }
        >
          <Badge className="subagents-progress">
            <RadialProgress
              className="subagents-ring"
              aria-label={t("chat.subagents.progressLabel")}
              value={(finished() / Math.max(total(), 1)) * 100}
            />
            {t("chat.subagents.progress", { finished: finished(), total: total() })}
          </Badge>
        </Show>
        <span className="subagents-elapsed">{groupElapsed()}</span>
        <ChevronRight className="subagents-group-chevron" aria-hidden="true" />
      </Button>
      <Show when={expanded()}>
        <ul id={listId} className="subagents-list">
          <For each={props.subagents} keyed={(subagent) => subagent.id}>
            {(subagent) => {
              const selected = () => props.selectedId === subagent().id;
              return (
                <li>
                  <Button
                    type="button"
                    variant="ghost"
                    className={cn("subagents-row", { "subagents-row-selected": selected() })}
                    aria-current={selected() ? "true" : undefined}
                    aria-label={rowLabel(subagent())}
                    onClick={() => props.onOpen(subagent().id)}
                  >
                    <SubagentStatus status={subagent().status} />
                    <span className="subagents-row-copy">
                      <span className="subagents-row-title">{subagent().title}</span>
                      <LiveLine subagent={subagent()} />
                    </span>
                    <span className="subagents-elapsed">{duration(elapsedMs(subagent(), now()))}</span>
                    <ChevronRight className="subagents-row-chevron" aria-hidden="true" />
                  </Button>
                </li>
              );
            }}
          </For>
        </ul>
      </Show>
    </section>
  );
}

export interface SubagentPanelProps {
  /** The subagent to show. A subagent that is not in the chat any more shows an empty pane. */
  subagent: ConversationSubagent | undefined;
  /** The agent that started the subagent. */
  agentName: string;
  onClosePanel: () => void;
}

/** The side panel pane of one subagent: its task, its state, and all of its steps. */
export function SubagentPanel(props: SubagentPanelProps) {
  const { t } = useText();
  const duration = useDuration();
  const now = createClock(() => props.subagent?.status === "running");
  return (
    <aside className="browser-panel subagents-panel" aria-label={t("conversation.sidePanel.pane.subagent")}>
      <header className="file-preview-header side-panel-pane-header">
        <h2 className="side-panel-pane-title">{t("conversation.sidePanel.pane.subagent")}</h2>
        <Button
          type="button"
          variant="ghost"
          className="browser-toolbar-button side-panel-pane-close"
          aria-label={t("conversation.sidePanel.closePanel")}
          onClick={() => props.onClosePanel()}
        >
          <X className="browser-toolbar-icon" />
        </Button>
      </header>
      <Show when={props.subagent}>
        {(subagent) => (
          <section className="subagents-panel-detail" aria-label={subagent().title}>
            <div className="subagents-panel-head">
              <SubagentStatus status={subagent().status} />
              <h3>{subagent().title}</h3>
            </div>
            <p className="subagents-panel-meta">
              {[
                subagent().agentType === GENERAL_AGENT_TYPE ? null : subagent().agentType,
                t(STATE_LABEL[subagent().status]),
                duration(elapsedMs(subagent(), now())),
                t("chat.subagents.stepCount", { count: subagent().steps.length }),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <div className="subagents-steps">
              <Show when={subagent().prompt}>
                {(prompt) => (
                  <p className="subagents-prompt">
                    <span className="subagents-prompt-label">
                      {t("chat.subagents.taskFrom", { name: props.agentName })}
                    </span>
                    {prompt()}
                  </p>
                )}
              </Show>
              <ol className="subagents-step-list" aria-label={t("chat.subagents.steps", { title: subagent().title })}>
                <For each={subagent().steps} keyed={(step) => step.id}>
                  {(step, index) => {
                    const live = () => subagent().status === "running" && index() === subagent().steps.length - 1;
                    return (
                      <li className="subagents-step" data-kind={step().kind}>
                        <StepGlyph kind={step().kind} className="subagents-step-glyph" />
                        <span className={cn("subagents-step-text", { "agent-activity-label": live() })}>{step().text}</span>
                      </li>
                    );
                  }}
                </For>
              </ol>
              <Show when={subagent().error}>
                {(error) => (
                  <p className="subagents-error">
                    <TriangleAlert className="subagents-error-icon" aria-hidden="true" />
                    {error()}
                  </p>
                )}
              </Show>
            </div>
          </section>
        )}
      </Show>
    </aside>
  );
}
