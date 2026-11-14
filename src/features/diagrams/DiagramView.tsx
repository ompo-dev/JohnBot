/**
 * A diagram in the chat area: its header, the canvas, the assistant over the canvas, and the last
 * run beside it. The view owns what is only presentation (the selection, the routine in focus, and
 * which panels are open); the diagram and every edit to it belong to the caller.
 *
 * When an agent is started by several routines, one routine is in focus at a time: the canvas shows
 * its path and its last run, and the panel shows what each agent received and returned in it. The
 * focus follows the newest run until the user picks a routine.
 */

import {
  Button,
  ChevronRight,
  PanelRight,
  Play,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Workflow,
} from "@johnbot/ui";
import { createSignal, createStore, Show } from "solid-js";
import { cn } from "../../components/utils";
import type { AgentProfile } from "../../data";
import { useText } from "../../components/text";
import { AgentAvatar } from "../agents/AgentAvatar";
import { DiagramBoard } from "./DiagramBoard";
import { DiagramBoardEmpty } from "./DiagramBoardEmpty";
import { DiagramChatPanel } from "./DiagramChatPanel";
import { DiagramInspector } from "./DiagramInspector";
import type { DiagramModelChoice, DiagramNewAgentDraft } from "./DiagramNewAgentCard";
import { DiagramStepIcon } from "./DiagramNodeCard";
import { diagramRunStepStatus } from "./DiagramRoutineVisuals";
import type { DiagramWebhookActions } from "./DiagramRoutineWebhookConfig";
import { diagramLatestRun, diagramRoutineColor, diagramRunOf } from "./diagram-graph";
import type {
  Diagram,
  DiagramChatMessage,
  DiagramNode,
  DiagramPoint,
  DiagramRunStatus,
} from "./diagram-model";
import type { ReactNode } from "react";

export interface DiagramViewProps {
  /** Optional editing tools remain inside the diagram's original header, assistant and sidebar. */
  canvas?: ReactNode;
  onEditRoutine?: ((nodeId: string) => void) | undefined;
  onCloseEditor?: (() => void) | undefined;
  diagram: Diagram;
  agents: AgentProfile[];
  /** The agent whose routines the diagram holds; its face replaces the diagram icon. */
  owner?: AgentProfile | undefined;
  /** Selection held by the caller, such as a tree beside the canvas. Given, it wins over the view's own. */
  selectedNodeId?: string | null | undefined;
  /** Reports every selection change, from the canvas or the inspector, back to the caller. */
  onSelectNodeChange?: ((nodeId: string | null) => void) | undefined;
  /** The day the routine week strips start on. Defaults to the time the view opens. */
  now?: string | undefined;
  editable?: boolean | undefined;
  /**
   * Whether the view holds the inspector beside the canvas. A page that shows the selection in a
   * panel of its own, as the John Twin shows an entity in the agent settings, turns it off.
   */
  inspector?: boolean | undefined;
  /** The lens entry that shows every routine, when the routines stand for something else (the Twin's sectors). */
  routineAllLabel?: string | undefined;
  /** The lens's name for assistive tech, when the routines stand for something else. */
  routineLensLabel?: string | undefined;
  /** Whether an idle card shows the gray "no run yet" preview. A diagram of entities that never runs turns it off. */
  showIdlePreview?: boolean | undefined;
  /** Whether an agent that no routine reaches shows the warning. A diagram of entities that never runs turns it off. */
  showUnreachable?: boolean | undefined;
  /** A selector in the header in place of the title, when one diagram serves several views (the Twin's roles and people). */
  headerSelect?:
    | {
        value: string;
        options: readonly { value: string; label: string }[];
        onChange: (value: string) => void;
        ariaLabel: string;
      }
    | undefined;
  /** Whether selecting a routine focuses it and dims the rest. A tree of entities that stands for a whole organization never dims. */
  focusRoutineOnSelect?: boolean | undefined;
  /** The agent that edits the diagram from the chat panel. Without it, the panel is hidden. */
  assistant?:
    | {
        agent: AgentProfile;
        messages: DiagramChatMessage[];
        working: boolean;
        onSend: (text: string) => void;
        onOpenLink?: ((url: string) => void) | undefined;
      }
    | undefined;
  onMoveNode: (nodeId: string, position: DiagramPoint) => void;
  /**
   * `routineId` is the routine in focus when the connection was drawn, or null on "All routines".
   * Answers whether the connection was saved, as on `DiagramBoard`.
   */
  onConnect: (from: string, to: string, routineId: string | null) => boolean | Promise<boolean>;
  onRemoveEdge: (edgeId: string) => void;
  onRemoveNode: (nodeId: string, routineId: string | null) => void;
  /** A connection belongs to one routine, so new ones are drawn only while a routine is in focus. */
  connectsWithinRoutine?: boolean;
  canRemoveNode?: ((nodeId: string) => boolean) | undefined;
  canRemoveEdge?: ((edgeId: string) => boolean) | undefined;
  onRunRoutine?: ((nodeId: string) => void) | undefined;
  /** Agents the canvas's right-click menu offers to place where the user clicked. */
  addableAgents?: readonly AgentProfile[] | undefined;
  onPlaceAgent?: ((agentId: string, position: DiagramPoint) => void) | undefined;
  /** Creates an agent from the right-click menu and places it. */
  onCreateAgent?:
    | ((draft: DiagramNewAgentDraft, position: DiagramPoint) => Promise<void>)
    | undefined;
  newAgentModels?: DiagramModelChoice | undefined;
  /** Sets the webhook of a routine that a webhook starts, from the panel. */
  webhooks?: DiagramWebhookActions | undefined;
  /** Saves what an agent does in one routine, from the panel. Without it, tasks are read-only. */
  onEditTask?: ((nodeId: string, routineId: string, task: string) => void) | undefined;
  /** Opens the settings of a new routine, from the canvas before its first routine. */
  onCreateRoutine?: (() => void) | undefined;
}

/** One choice in the routine selector, with its colour and how its last run went. */
interface RoutineOption {
  id: string;
  name: string;
  color: number | undefined;
  status: DiagramRunStatus | undefined;
}

function RoutineOptionLabel(props: { option: RoutineOption }) {
  return (
    <span className="diagram-view-lens-option" data-routine-color={props.option.color}>
      <span
        className="diagram-view-lens-dot"
        data-all={props.option.color === undefined ? "" : undefined}
        aria-hidden="true"
      />
      <span className="diagram-view-lens-name">{props.option.name}</span>
      <Show when={props.option.status}>
        {(status) => (
          <span className="diagram-node-status" data-status={status()}>
            <DiagramStepIcon status={diagramRunStepStatus(status())} />
          </span>
        )}
      </Show>
    </span>
  );
}

/** The lens value that shows every routine at once. A node id never takes this form. */
const ALL = "routine-lens:all";

export function DiagramView(props: DiagramViewProps) {
  const { t } = useText();
  const [ownSelectedNodeId, setSelectedNodeId] = createSignal<string | null>(null);
  const selectedNodeId = () =>
    props.selectedNodeId !== undefined ? props.selectedNodeId : ownSelectedNodeId();
  const [panels, setPanels] = createStore({ inspector: true, chat: false });
  const now = () => (props.now ? new Date(props.now) : new Date());
  const routines = () =>
    props.diagram.nodes.filter(
      (node): node is Extract<DiagramNode, { kind: "routine" }> => node.kind === "routine",
    );
  /** `undefined` follows the newest run; `null` shows every routine at once, with no run. */
  const [picked, setPicked] = createSignal<string | null | undefined>(undefined);
  const focusRoutineId = (): string | null => {
    const choice = picked();
    if (choice === null) return null;
    if (choice && routines().some((node) => node.id === choice)) return choice;
    return diagramLatestRun(props.diagram)?.routineNodeId ?? null;
  };
  const runRoutine = (routineId: string) => {
    setPicked(routineId);
    props.onRunRoutine?.(routineId);
  };
  const runTarget = () => focusRoutineId() ?? routines()[0]?.id;
  /**
   * Before its first routine, while it holds at most the owner's own card, the canvas shows how a
   * routine works, and nothing in it to inspect. Agents placed before a routine stay on the board.
   */
  const empty = () =>
    props.diagram.nodes.every((node) => node.kind === "agent" && node.agentId === props.owner?.id);
  /** The routines to highlight, after the choice to show them all. */
  const routineOptions = (): RoutineOption[] => [
    {
      id: ALL,
      name: props.routineAllLabel ?? t("diagram.routine.all"),
      color: undefined,
      status: undefined,
    },
    ...routines().map((routine) => ({
      id: routine.id,
      name: routine.name,
      color: diagramRoutineColor(props.diagram.nodes, routine.id),
      status: diagramRunOf(props.diagram, routine.id)?.status,
    })),
  ];
  const inspectorShown = () => props.inspector !== false && !props.canvas;
  /** A routine also takes the focus, as picking it in the routine select does. */
  const select = (nodeId: string | null) => {
    setSelectedNodeId(nodeId);
    props.onSelectNodeChange?.(nodeId);
    if (
      props.focusRoutineOnSelect !== false &&
      nodeId &&
      routines().some((node) => node.id === nodeId)
    )
      setPicked(nodeId);
    if (nodeId)
      setPanels((state) => {
        state.inspector = true;
      });
  };
  return (
    <main
      className={cn("diagram-view")}
      aria-label={t("diagram.view.label", { name: props.diagram.name })}
    >
      <header className={cn("window-drag", "diagram-view-header")}>
        <Show
          when={props.owner}
          fallback={
            <span className="diagram-view-icon" aria-hidden="true">
              <Workflow />
            </span>
          }
        >
          {(owner) => <AgentAvatar agent={owner()} className="diagram-view-avatar" motion="idle" />}
        </Show>
        <Show
          when={props.headerSelect}
          fallback={<h1 className="diagram-view-title">{props.diagram.name}</h1>}
        >
          {(select) => (
            <Select<string>
              className="diagram-view-lens"
              options={[...select().options]}
              optionValue="value"
              optionTextValue="label"
              value={select().options.find((option) => option.value === select().value) ?? null}
              onChange={(option) => option && select().onChange(option.value)}
              placement="bottom"
              sameWidth={false}
              itemComponent={(itemProps) => (
                <SelectItem item={itemProps.item}>{itemProps.item.rawValue.label}</SelectItem>
              )}
            >
              <SelectTrigger
                size="sm"
                className="diagram-view-lens-trigger"
                aria-label={select().ariaLabel}
              >
                <SelectValue<string>>
                  {(state) => (
                    <span className="diagram-view-lens-name">{state.selectedOption()?.label}</span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent />
            </Select>
          )}
        </Show>
        <span className={cn("diagram-view-actions")}>
          <Show when={props.canvas || (props.onEditRoutine && runTarget())}>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() =>
                props.canvas ? props.onCloseEditor?.() : props.onEditRoutine?.(runTarget()!)
              }
            >
              {props.canvas ? t("common.back") : "Editar etapas"}
            </Button>
          </Show>
          <Show when={!props.canvas && props.onRunRoutine && runTarget()}>
            {(routineId) => (
              <Button type="button" size="xs" onClick={() => runRoutine(routineId())}>
                <Play aria-hidden="true" />
                {t("diagram.node.runNow")}
              </Button>
            )}
          </Show>
          <Show when={!empty() && inspectorShown()}>
            <Button
              type="button"
              variant="ghost"
              className="header-panel-toggle"
              aria-label={t(
                panels.inspector ? "diagram.inspector.close" : "diagram.inspector.label",
              )}
              aria-expanded={panels.inspector ? "true" : "false"}
              title={t(panels.inspector ? "diagram.inspector.close" : "diagram.inspector.label")}
              onClick={() =>
                setPanels((state) => {
                  state.inspector = !state.inspector;
                })
              }
            >
              <Show
                when={panels.inspector}
                fallback={<PanelRight aria-hidden="true" className="size-[14px]" />}
              >
                <ChevronRight aria-hidden="true" className="size-[14px]" />
              </Show>
            </Button>
          </Show>
        </span>
      </header>

      <div
        className={cn("diagram-view-body")}
        data-inspector={inspectorShown() && panels.inspector && !empty() ? "open" : undefined}
      >
        <div className="diagram-view-canvas">
          <Show when={!props.canvas} fallback={props.canvas}>
            <Show
              when={!empty()}
              fallback={<DiagramBoardEmpty onCreateRoutine={props.onCreateRoutine} />}
            >
              <DiagramBoard
                diagram={props.diagram}
                agents={props.agents}
                selectedNodeId={selectedNodeId()}
                focusRoutineId={focusRoutineId()}
                editable={props.editable}
                showIdlePreview={props.showIdlePreview}
                showUnreachable={props.showUnreachable}
                onSelectNode={select}
                onFocusRoutine={setPicked}
                onMoveNode={props.onMoveNode}
                onConnect={(from, to) => props.onConnect(from, to, focusRoutineId())}
                onRemoveEdge={props.onRemoveEdge}
                onRemoveNode={(nodeId) => {
                  if (selectedNodeId() === nodeId) {
                    setSelectedNodeId(null);
                    props.onSelectNodeChange?.(null);
                  }
                  props.onRemoveNode(nodeId, focusRoutineId());
                }}
                connectable={!props.connectsWithinRoutine || focusRoutineId() !== null}
                canRemoveNode={props.canRemoveNode}
                canRemoveEdge={props.canRemoveEdge}
                onRunRoutine={props.onRunRoutine ? runRoutine : undefined}
                addableAgents={props.addableAgents}
                onPlaceAgent={props.onPlaceAgent}
                onCreateAgent={props.onCreateAgent}
                newAgentModels={props.newAgentModels}
              >
                <Show when={routines().length > 1}>
                  <div className="diagram-view-lens-bar" data-diagram-overlay="">
                    <Select<RoutineOption>
                      className="diagram-view-lens"
                      options={routineOptions()}
                      optionValue="id"
                      optionTextValue="name"
                      value={
                        routineOptions().find(
                          (option) => option.id === (focusRoutineId() ?? ALL),
                        ) ?? null
                      }
                      onChange={(option) =>
                        option && setPicked(option.id === ALL ? null : option.id)
                      }
                      placement="bottom"
                      sameWidth={false}
                      itemComponent={(itemProps) => (
                        <SelectItem item={itemProps.item}>
                          <RoutineOptionLabel option={itemProps.item.rawValue} />
                        </SelectItem>
                      )}
                    >
                      <SelectTrigger
                        size="sm"
                        className="diagram-view-lens-trigger"
                        aria-label={props.routineLensLabel ?? t("diagram.routine.lens")}
                      >
                        <SelectValue<RoutineOption>>
                          {(state) => <RoutineOptionLabel option={state.selectedOption()} />}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent />
                    </Select>
                  </div>
                </Show>
              </DiagramBoard>
            </Show>
          </Show>
          {/* Outside the switch, so the first routine keeps the draft and the place of the panel. */}
          <Show when={props.assistant}>
            {(assistant) => (
              <div className="diagram-view-chat">
                <DiagramChatPanel
                  agent={assistant().agent}
                  messages={assistant().messages}
                  working={assistant().working}
                  open={panels.chat}
                  onOpenChange={(open) =>
                    setPanels((state) => {
                      state.chat = open;
                    })
                  }
                  onSend={(text) => assistant().onSend(text)}
                  onOpenLink={(url) => assistant().onOpenLink?.(url)}
                />
              </div>
            )}
          </Show>
        </div>

        <Show when={inspectorShown() && panels.inspector && !empty()}>
          <DiagramInspector
            diagram={props.diagram}
            agents={props.agents}
            selectedNodeId={selectedNodeId()}
            focusRoutineId={focusRoutineId()}
            now={now()}
            onSelectNode={select}
            onFocusRoutine={setPicked}
            onEditTask={props.onEditTask}
            webhooks={props.webhooks}
          />
        </Show>
      </div>
    </main>
  );
}
