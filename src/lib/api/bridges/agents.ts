import type { AgentEvent } from "../../../contracts/ipc";
import { z } from "zod";
import type { MockjohnBotControls } from "../../../preview/mock-johnbot";
import {
  conversationDomainSchema,
  readStateSchema,
  rosterPayloadSchema,
} from "../../../contracts/agents-data";
import { getData, runCommand } from "../client";

/** Native demo execution stays local. Validated snapshots, including its replies, persist remotely. */
export function installAgentsData(mock: MockjohnBotControls): void {
  const api = mock.api.agent;
  const original = { ...api };
  const versions = new Map<string, number>();
  const boot = new Map<string, Promise<void>>();
  const chains = new Map<string, Promise<void>>();
  const failures = new Map<string, unknown>();
  const generations = new Map<string, number>();
  const applying = new Set<string>();
  let disposed = false;
  const remote = (serverId?: string) => Boolean(serverId && serverId !== "local");
  const syncRoster = async () => {
    const roster = await original.listAgents();
    await runCommand("agents.sync-roster", roster, rosterPayloadSchema);
  };
  const flush = async (agentId: string) => {
    let pending: Promise<void> | undefined;
    do {
      pending = chains.get(agentId);
      await pending;
    } while (pending !== chains.get(agentId));
    if (failures.has(agentId)) throw failures.get(agentId);
  };
  const persist = (agentId: string): Promise<void> => {
    const next = (chains.get(agentId) ?? Promise.resolve())
      .catch(() => undefined)
      .then(async () => {
        if (disposed || !versions.has(agentId)) return;
        const snapshot = mock.readConversationSnapshot(agentId);
        const [queue, reads] = await Promise.all([
          original.listQueue(agentId),
          original.listConversationReads(),
        ]);
        const readState = reads[agentId] ?? {
          unreadCount: 0,
          firstUnreadMessageId: null,
          throughMessageId: null,
        };
        try {
          const result = await runCommand(
            "agents.persist-conversation",
            { agentId, snapshot, queue, readState, expectedVersion: versions.get(agentId) },
            conversationDomainSchema,
          );
          versions.set(agentId, result.data.version);
          failures.delete(agentId);
        } catch (error) {
          failures.set(agentId, error);
          throw error;
        }
      });
    chains.set(agentId, next);
    return next;
  };
  const unsubscribe = mock.onAgentEvent((event: AgentEvent) => {
    const agentId =
      event.type === "conversation" || event.type === "queue-changed"
        ? event.snapshot.agentId
        : event.type === "conversation-delta" || event.type === "conversation-invalidated"
          ? event.agentId
          : undefined;
    if (!agentId || applying.has(agentId)) return;
    generations.set(agentId, (generations.get(agentId) ?? 0) + 1);
    if (versions.has(agentId)) void persist(agentId).catch(() => undefined);
  });
  const hydrate = async (agentId: string) => {
    const active = boot.get(agentId);
    if (active) {
      await active;
      await flush(agentId);
      return;
    }
    const pending = (async () => {
      await syncRoster();
      const generation = generations.get(agentId) ?? 0;
      const value = await getData(
        `/api/agents?domain=conversation&agentId=${encodeURIComponent(agentId)}`,
        conversationDomainSchema,
      );
      if ((generations.get(agentId) ?? 0) !== generation)
        throw new Error("The conversation changed while loading. Please retry.");
      versions.set(agentId, value.version);
      applying.add(agentId);
      try {
        mock.restoreConversationReadState(agentId, value.readState);
        mock.restoreConversationSnapshot(value.snapshot);
        mock.setQueueSnapshot(agentId, value.queue.deliveries);
      } finally {
        applying.delete(agentId);
      }
    })();
    boot.set(agentId, pending);
    try {
      await pending;
    } catch (error) {
      boot.delete(agentId);
      throw error;
    }
  };
  api.readConversation = async (agentId, serverId) => {
    if (!remote(serverId)) await hydrate(agentId);
    return original.readConversation(agentId, serverId);
  };
  api.readConversationPage = async (input, serverId) => {
    if (!remote(serverId)) await hydrate(input.agentId);
    return original.readConversationPage(input, serverId);
  };
  api.listQueue = async (agentId, serverId) => {
    if (!remote(serverId)) await hydrate(agentId);
    return original.listQueue(agentId, serverId);
  };
  api.listConversationReads = async (serverId) => {
    if (remote(serverId)) return original.listConversationReads(serverId);
    await Promise.all([...chains.keys()].map(flush));
    return getData("/api/agents?domain=reads", z.record(z.string(), readStateSchema));
  };
  const hydrateAll = async () => {
    const agents = await original.listAgents();
    await Promise.all(agents.map((agent) => hydrate(agent.id)));
  };
  api.searchConversationMessages = async (input, serverId) => {
    if (!remote(serverId)) await hydrateAll();
    return original.searchConversationMessages(input, serverId);
  };
  api.searchConversationFiles = async (input, serverId) => {
    if (!remote(serverId)) await hydrateAll();
    return original.searchConversationFiles(input, serverId);
  };
  api.sendMessage = async (input, serverId) => {
    if (remote(serverId) || input.taskId) return original.sendMessage(input, serverId);
    await hydrate(input.agentId);
    const receipt = await original.sendMessage(input, serverId);
    await persist(input.agentId);
    await flush(input.agentId);
    return receipt;
  };
  api.markConversationRead = async (input, serverId) => {
    if (remote(serverId)) return original.markConversationRead(input, serverId);
    await hydrate(input.agentId);
    const result = await original.markConversationRead(input, serverId);
    await persist(input.agentId);
    return result;
  };
  api.markConversationUnread = async (input, serverId) => {
    if (remote(serverId)) return original.markConversationUnread(input, serverId);
    await hydrate(input.agentId);
    const result = await original.markConversationUnread(input, serverId);
    await persist(input.agentId);
    return result;
  };
  api.setMessageReaction = async (input, serverId) => {
    if (remote(serverId)) return original.setMessageReaction(input, serverId);
    await hydrate(input.agentId);
    const result = await original.setMessageReaction(input, serverId);
    await persist(input.agentId);
    return result;
  };
  const originalDispose = mock.dispose;
  mock.dispose = () => {
    disposed = true;
    unsubscribe();
    originalDispose();
  };
}
