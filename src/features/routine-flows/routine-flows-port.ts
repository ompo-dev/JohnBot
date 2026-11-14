import type {
  AgentEvent,
  ConversationPage,
  johnBotDesktopApi,
  TeamRealtimeEvent,
  TestRoutineInput,
  UpdateRoutineInput,
} from "@johnbot/contracts/ipc";
import {
  desktopEventRoutinesApi,
  type EventRoutinesApi,
} from "../conversation/routine-webhooks-api";

/**
 * What the routine canvas reaches on one host: the flows, the routines it runs and edits, the
 * events that make it stale, the open agent's conversation for the assistant, and the links in its
 * answers. The desktop app reaches this computer or a joined server through main; the web client
 * reaches its connected host over the Team API.
 */
export interface RoutineFlowsHost {
  workflows?: Pick<johnBotDesktopApi["workflows"], "get" | "saveGraph" | "startRun">;
  /** Called without a server: the host already names one. */
  flows: johnBotDesktopApi["routineFlows"];
  routines: {
    update(input: UpdateRoutineInput): Promise<unknown>;
    test(input: TestRoutineInput): Promise<unknown>;
  };
  /**
   * Webhook routines: their config, signing secret, relay status and a test run. Absent for an
   * account that may not manage them; the canvas then hides the config and refuses their edits.
   */
  readonly webhooks:
    | Pick<EventRoutinesApi, "getStatus" | "saveRoutine" | "rotateSecret" | "testRoutine">
    | undefined;
  conversation: {
    /** Sends a request to the agent. Resolves to the delivery that names it, or null without one. */
    send(input: { agentId: string; text: string; clientMessageId: string }): Promise<string | null>;
    /** The newest page, or the page around one message. */
    page(agentId: string, aroundMessageId?: string): Promise<ConversationPage>;
  };
  /** The events of this host only. */
  onEvent(listener: (event: AgentEvent | TeamRealtimeEvent) => void): () => void;
  openUrl(url: string): Promise<void>;
}

/**
 * The desktop adapter for one server. `window.johnbot` is read on each call: tests and stories
 * replace it per case. `webhooks` is read when the canvas asks, so a role change reaches it.
 */
export function desktopRoutineFlowsHost(
  serverId: string,
  webhooks: () => boolean,
): RoutineFlowsHost {
  const flows = () => window.johnbot.routineFlows;
  const agent = () => window.johnbot.agent;
  return {
    workflows: {
      get: (id) => window.johnbot.workflows.get(id, serverId),
      saveGraph: (input) => window.johnbot.workflows.saveGraph(input, serverId),
      startRun: (input) => window.johnbot.workflows.startRun(input, serverId),
    },
    flows: {
      canvas: (agentId) => flows().canvas(agentId, serverId),
      savePosition: (input) => flows().savePosition(input, serverId),
      removePosition: (input) => flows().removePosition(input, serverId),
      connect: (input) => flows().connect(input, serverId),
      disconnect: (input) => flows().disconnect(input, serverId),
      updateLink: (input) => flows().updateLink(input, serverId),
    },
    routines: {
      update: (input) => agent().updateRoutine(input, serverId),
      test: (input) => agent().testRoutine(input, serverId),
    },
    get webhooks() {
      return webhooks() ? desktopEventRoutinesApi(serverId) : undefined;
    },
    conversation: {
      send: async ({ agentId, text, clientMessageId }) => {
        const receipt = await agent().sendMessage({ agentId, text, clientMessageId }, serverId);
        return (
          receipt.deliveries.find((delivery) => delivery.recipientAgentId === agentId)?.id ?? null
        );
      },
      page: (agentId, aroundMessageId) =>
        agent().readConversationPage(
          {
            agentId,
            ...(aroundMessageId ? { anchor: { type: "around", messageId: aroundMessageId } } : {}),
          },
          serverId,
        ),
    },
    onEvent: (listener) =>
      agent().onScopedEvent((scoped) => {
        if (scoped.serverId === serverId) listener(scoped.event);
      }),
    openUrl: (url) => window.johnbot.openUrl(url),
  };
}
