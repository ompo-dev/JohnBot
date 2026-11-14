import assert from "node:assert/strict";
import { installAgentsData } from "../../src/lib/api/bridges/agents";
import { http } from "../../src/lib/api/client";
import { seedConversation } from "../../src/server/services/agents";
import { STORY_AGENT_SUMMARIES } from "../../src/preview/fixtures";
import type { MockjohnBotControls } from "../../src/preview/mock-johnbot";
import type { AgentEvent, SendMessageInput } from "../../src/contracts/ipc";

let saved = structuredClone(seedConversation("research"));
let writes = 0;
const adapter = http.defaults.adapter;
http.defaults.adapter = async (config) => {
  const payload = config.data ? JSON.parse(config.data).payload : undefined;
  let data: unknown;
  if (config.url?.endsWith("agents.sync-roster")) data = payload;
  else if (config.url?.endsWith("agents.persist-conversation")) {
    assert.equal(payload.expectedVersion, saved.version);
    saved = {
      snapshot: payload.snapshot,
      readState: payload.readState,
      queue: payload.queue,
      version: saved.version + 1,
    };
    writes++;
    data = saved;
  } else data = saved;
  return {
    config,
    status: 200,
    statusText: "OK",
    headers: {},
    data: { ok: true, data: structuredClone(data) },
  };
};
function localMock() {
  let snapshot = structuredClone(seedConversation("research").snapshot);
  let queue = structuredClone(saved.queue);
  let reads = { research: structuredClone(saved.readState) };
  let lastInput: SendMessageInput | undefined;
  let calls = 0;
  const listeners = new Set<(event: AgentEvent) => void>();
  const emit = (event: AgentEvent) => {
    for (const listener of listeners) listener(event);
  };
  const agent: Partial<MockjohnBotControls["api"]["agent"]> = {
    listAgents: async () => structuredClone(STORY_AGENT_SUMMARIES),
    listQueue: async () => structuredClone(queue),
    listConversationReads: async () => structuredClone(reads),
    readConversation: async () => ({ ...structuredClone(snapshot), readState: reads.research }),
    sendMessage: async (input, serverId) => {
      calls++;
      lastInput = input;
      if (!serverId && !input.taskId) {
        snapshot = {
          ...snapshot,
          revision: snapshot.revision + 1,
          messages: [
            ...snapshot.messages,
            {
              id: crypto.randomUUID(),
              author: "assistant",
              source: "assistant",
              text: "Native reply",
              status: "completed",
              createdAt: new Date().toISOString(),
            },
          ],
        };
        emit({ type: "conversation", snapshot });
      }
      return { messageId: "native-receipt", deliveries: [] };
    },
  };
  const controls = {
    api: { agent },
    onAgentEvent: (listener: (event: AgentEvent) => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    restoreConversationReadState: (_id: string, state: typeof saved.readState) => {
      reads = { research: structuredClone(state) };
    },
    restoreConversationSnapshot: (value: typeof snapshot) => {
      snapshot = structuredClone(value);
      emit({ type: "conversation", snapshot });
    },
    setQueueSnapshot: (_id: string, deliveries: typeof queue.deliveries) => {
      queue = { ...queue, deliveries };
      emit({ type: "queue-changed", snapshot: queue });
      return queue;
    },
    readConversationSnapshot: () => structuredClone(snapshot),
    dispose: () => undefined,
  } as unknown as MockjohnBotControls;
  return { controls, calls: () => calls, lastInput: () => lastInput };
}
try {
  const first = localMock();
  installAgentsData(first.controls);
  const input: SendMessageInput = {
    agentId: "research",
    text: "Hello",
    clientMessageId: crypto.randomUUID(),
    attachmentDraftIds: ["native-file"],
  };
  await first.controls.api.agent.sendMessage(input);
  assert.equal(first.lastInput(), input, "native arguments must be preserved");
  assert.ok(saved.snapshot.messages.some((message) => message.text === "Native reply"));
  const count = writes;
  await first.controls.api.agent.sendMessage(input, "team");
  await first.controls.api.agent.sendMessage({ ...input, taskId: "native-task" });
  assert.equal(first.calls(), 3);
  assert.equal(writes, count, "remote and task execution must bypass the main-conversation mirror");
  first.controls.dispose();
  const reloaded = localMock();
  installAgentsData(reloaded.controls);
  const result = await reloaded.controls.api.agent.readConversation("research");
  assert.ok(result.messages.some((message) => message.text === "Native reply"));
  reloaded.controls.dispose();
  console.log(
    "PASS: native reply persistence, argument preservation, remote/task passthrough and reload hydration",
  );
} finally {
  http.defaults.adapter = adapter;
}
