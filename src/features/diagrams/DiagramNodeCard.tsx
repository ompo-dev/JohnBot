/**
 * One node on the canvas: a routine that starts a run, or an agent that takes input and returns
 * output. An agent card shows the output of its last run inline, so the canvas reads as the result
 * of the run as well as its plan. The card itself does not listen for the pointer: the board moves
 * it and draws connections from its ports, and finds it through the `data-diagram-*` attributes.
 */

import { Button, Check, Clock3, Minus, Play, Spinner, TriangleAlert, Webhook, X } from "@johnbot/ui";
import { For, Match, Show, Switch } from "solid-js";
import type { AvatarMood } from "../../components/bloub-avatar";
import type { AgentProfile } from "../../data";
import { useText } from "../../components/text";
import { AgentAvatar } from "../agents/AgentAvatar";
import { DiagramRoutineRunDots } from "./DiagramRoutineVisuals";
import { DIAGRAM_NODE_WIDTH, diagramAgentTask } from "./diagram-graph";
import type { DiagramNode, DiagramStepRun, DiagramStepStatus } from "./diagram-model";
import { DIAGRAM_STEP_STATUS_KEY, diagramRoutineTrigger, diagramStepSeconds } from "./diagram-text";

/** How an input port answers a connection in progress. */
export type DiagramPortTarget = "none" | "valid" | "invalid";

/** A routine whose run reaches an agent, and how the agent's step went in that run. */
export interface DiagramRoutineChip {
  id: string;
  name: string;
  color: number;
  status: DiagramStepStatus | undefined;
}

export interface DiagramNodeCardProps {
  node: DiagramNode;
  name: string;
  /** Only the face and the kicker read it, so a sample agent needs no more than these. */
  agent?:
    | (Pick<AgentProfile, "avatarSeed" | "avatarHue" | "avatarUrl" | "title"> & Partial<Pick<AgentProfile, "model">>)
    | undefined;
  /** The step an agent runs in when the focused routine fires; absent outside its path. */
  step?: number | undefined;
  /** True for an agent that no routine reaches, so it never runs. */
  unreachable: boolean;
  /** True outside the focused routine's path. */
  dimmed: boolean;
  /** A routine's colour, from `diagramRoutineColor`. */
  routineColor?: number | undefined;
  /** For an agent: the routines that start it. Empty while the diagram has one routine. */
  routines: DiagramRoutineChip[];
  focusRoutineId: string | null;
  onFocusRoutine: (routineId: string) => void;
  stepRun?: DiagramStepRun | undefined;
  selected: boolean;
  /** Whether its ports take a new connection. */
  connectable: boolean;
  /** Whether the user may take it off the canvas. */
  removable: boolean;
  /** True while this node's output is the source of a connection in progress. */
  connecting: boolean;
  inputTarget: DiagramPortTarget;
  /** True while the run this routine started is in progress. */
  firing?: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onOutputPort: () => void;
  onInputPort: () => void;
  onRunRoutine?: (() => void) | undefined;
  /** Whether an idle card shows the gray "no run yet" preview. A diagram of entities that never runs turns it off. */
  showIdlePreview?: boolean | undefined;
  /** Whether an agent that no routine reaches shows the warning. A diagram of entities that never runs turns it off. */
  showUnreachable?: boolean | undefined;
}

export function DiagramNodeCard(props: DiagramNodeCardProps) {
  const { t, format } = useText();
  const routine = () => (props.node.kind === "routine" ? props.node : undefined);
  const unreachable = () => props.unreachable && props.showUnreachable !== false;
  const status = (): DiagramStepStatus | "idle" => props.stepRun?.status ?? "idle";
  const mood = (): AvatarMood => {
    if (status() === "running") return "working";
    return status() === "failed" ? "failed" : "idle";
  };
  /** A routine's kicker says when it fires next, or that it is paused. */
  const routineKicker = (node: Extract<DiagramNode, { kind: "routine" }>) => {
    if (!node.active) return t("diagram.node.paused");
    if (!node.schedule && !node.webhook) return "Manual";
    const next = node.upcomingRuns[0];
    if (!next) return t("diagram.node.routine");
    return t("diagram.node.nextRun", {
      time: format.date(new Date(next), { weekday: "short", hour: "numeric", minute: "2-digit" }),
    });
  };
  const label = () => {
    const node = routine();
    if (node) return t("diagram.node.routineLabel", { name: props.name, schedule: diagramRoutineTrigger(node) });
    if (unreachable()) return t("diagram.node.agentUnreachableLabel", { name: props.name });
    return props.step === undefined ? props.name : t("diagram.node.agentLabel", { name: props.name, step: props.step });
  };
  return (
    <div
      className="diagram-node"
      style={{
        "--diagram-node-x": `${props.node.position.x}px`,
        "--diagram-node-y": `${props.node.position.y}px`,
        "--diagram-node-width": `${DIAGRAM_NODE_WIDTH[props.node.kind]}px`,
      }}
      data-diagram-node={props.node.id}
      data-kind={props.node.kind}
      data-status={status()}
      data-firing={props.firing ? "" : undefined}
      data-selected={props.selected ? "" : undefined}
      data-unreachable={unreachable() ? "" : undefined}
      data-dimmed={props.dimmed ? "" : undefined}
      data-routine-color={props.routineColor}
    >
      <Show when={props.node.kind === "agent"}>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="diagram-port diagram-port-in"
          data-diagram-control=""
          data-diagram-port="in"
          data-target={props.inputTarget}
          disabled={!props.connectable}
          aria-label={t("diagram.port.input", { name: props.name })}
          onClick={() => props.onInputPort()}
        />
      </Show>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="diagram-port diagram-port-out"
        data-diagram-control=""
        data-diagram-port="out"
        data-connecting={props.connecting ? "" : undefined}
        disabled={!props.connectable}
        aria-label={t("diagram.port.output", { name: props.name })}
        aria-pressed={props.connecting ? "true" : "false"}
        onClick={() => props.onOutputPort()}
      />

      <div className="diagram-node-header">
        <Button
          type="button"
          variant="ghost"
          className="diagram-node-select"
          aria-label={label()}
          aria-pressed={props.selected ? "true" : "false"}
          onClick={() => props.onSelect()}
        >
          <Show
            when={props.agent}
            fallback={
              <span className="diagram-node-icon" aria-hidden="true">
                <Show when={props.node.kind === "routine" && props.node.webhook} fallback={<Clock3 />}>
                  <Webhook />
                </Show>
              </span>
            }
          >
            {(agent) => <AgentAvatar agent={agent()} className="diagram-node-avatar" motion="idle" mood={mood()} />}
          </Show>
          <span className="diagram-node-heading">
            <span className="diagram-node-kicker">
              <Show when={routine()} fallback={props.agent?.title || props.agent?.model}>
                {(node) => <>{routineKicker(node())}</>}
              </Show>
            </span>
            <strong className="diagram-node-name">{props.name}</strong>
          </span>
        </Button>
        <Show when={props.selected && props.removable}>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="diagram-node-remove"
            data-diagram-control=""
            aria-label={t("diagram.node.remove", { name: props.name })}
            onClick={() => props.onRemove()}
          >
            <X aria-hidden="true" />
          </Button>
        </Show>
      </div>

      <Show
        when={routine()}
        fallback={
          <div className="diagram-node-body">
            <p className="diagram-node-task">{diagramAgentTask(props.node, props.focusRoutineId)}</p>
            <Show when={props.routines.length > 0}>
              <ul className="diagram-node-routines" aria-label={t("diagram.node.startedBy")}>
                <For each={props.routines}>
                  {(chip) => (
                    <li>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        className="diagram-routine-chip"
                        data-diagram-control=""
                        data-routine-color={chip.color}
                        aria-pressed={props.focusRoutineId === chip.id ? "true" : "false"}
                        title={t("diagram.node.showRoutine", { name: chip.name })}
                        onClick={() => props.onFocusRoutine(chip.id)}
                      >
                        <span className="diagram-routine-chip-name">{chip.name}</span>
                        <Show when={chip.status}>{(status) => <DiagramStepIcon status={status()} />}</Show>
                      </Button>
                    </li>
                  )}
                </For>
              </ul>
            </Show>
            <Show when={props.showIdlePreview !== false || Boolean(props.stepRun)}>
              <div className="diagram-node-preview" data-empty={props.stepRun?.output ? undefined : ""}>
                <Show
                  when={props.stepRun?.error ?? props.stepRun?.output}
                  fallback={
                    <span className="diagram-node-preview-empty">
                      {props.stepRun?.status === "running"
                        ? t("diagram.step.running")
                        : props.stepRun?.status === "succeeded"
                          ? t("diagram.node.noAnswer")
                          : t("diagram.node.noRun")}
                    </span>
                  }
                >
                  {(text) => <p>{text()}</p>}
                </Show>
              </div>
            </Show>
            <div className="diagram-node-footer">
              <Show
                when={!unreachable()}
                fallback={
                  <span className="diagram-node-status" data-status="unreachable">
                    <TriangleAlert aria-hidden="true" />
                    {t("diagram.node.unreachable")}
                  </span>
                }
              >
                <Show when={props.stepRun}>
                  {(run) => (
                    <span className="diagram-node-status" data-status={run().status}>
                      <DiagramStepIcon status={run().status} />
                      {t(DIAGRAM_STEP_STATUS_KEY[run().status])}
                      <Show when={diagramStepSeconds(run())}>
                        {(seconds) => (
                          <span className="diagram-node-duration">
                            {t("diagram.inspector.seconds", { seconds: format.number(seconds()) })}
                          </span>
                        )}
                      </Show>
                    </span>
                  )}
                </Show>
              </Show>
            </div>
          </div>
        }
      >
        {(node) => (
          <div className="diagram-node-body">
            <p className="diagram-node-schedule">{diagramRoutineTrigger(node())}</p>
            <p className="diagram-routine-instruction">{node().instruction}</p>
            <div className="diagram-node-footer">
              <DiagramRoutineRunDots runs={node().recentRuns} limit={8} />
              <Show when={props.onRunRoutine}>
                {(run) => (
                  <Button
                    type="button"
                    variant="secondary"
                    size="xs"
                    className="diagram-node-run"
                    data-diagram-control=""
                    onClick={() => run()()}
                  >
                    <Play aria-hidden="true" />
                    {t("diagram.node.runNow")}
                  </Button>
                )}
              </Show>
            </div>
          </div>
        )}
      </Show>
    </div>
  );
}

export function DiagramStepIcon(props: { status: DiagramStepStatus }) {
  return (
    <Switch>
      <Match when={props.status === "running"}>
        <Spinner size="sm" />
      </Match>
      <Match when={props.status === "succeeded"}>
        <Check aria-hidden="true" />
      </Match>
      <Match when={props.status === "failed"}>
        <TriangleAlert aria-hidden="true" />
      </Match>
      <Match when={props.status === "skipped"}>
        <Minus aria-hidden="true" />
      </Match>
      <Match when={props.status === "waiting"}>
        <Clock3 aria-hidden="true" />
      </Match>
    </Switch>
  );
}
