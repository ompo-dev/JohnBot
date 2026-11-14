import { z } from "zod";
import type { MockjohnBotControls } from "../../../preview/mock-johnbot";
import { agentsSchema, agentStatusSchema, modelsSchema, conversationDomainSchema, conversationPageSchema, readStateSchema } from "../../../contracts/agents-data";
import { agentSchema, sentMessageSchema } from "../../../contracts/workspace-data";
import { dataStore, putQuery } from "../../../stores/data-store";
import { getData, runCommand } from "../client";

const rosterPath = "/api/agents?domain=agents";
const conversationPath = (id: string) => `/api/agents?domain=conversation&agentId=${encodeURIComponent(id)}`;
/** PostgreSQL owns roster/transcripts. The legacy renderer receives only validated store projections. */
export function installDatabaseAgentsData(runtime: MockjohnBotControls) {
  const api = runtime.api.agent;
  const assertLocal = (serverId?: string) => {
    if (serverId && serverId !== "local") throw new Error("Connect a real remote server before using this workspace.");
  };
  const unsubscribe = dataStore.subscribe((state, previous) => {
    for (const [key, entry] of Object.entries(state.entries)) {
      if (entry.data === previous.entries[key]?.data) continue;
      if (key === rosterPath) {
        const parsed = agentsSchema.safeParse(entry.data);
        if (parsed.success) runtime.restoreAgents(parsed.data);
      }
      if (key.startsWith("/api/agents?") && key.includes("domain=conversation")) {
        const parsed = conversationDomainSchema.safeParse(entry.data);
        if (!parsed.success) continue;
        runtime.restoreConversationReadState(parsed.data.snapshot.agentId, parsed.data.readState);
        runtime.restoreConversationSnapshot(parsed.data.snapshot);
        runtime.setQueueSnapshot(parsed.data.queue.agentId, parsed.data.queue.deliveries);
      }
    }
  });
  const dispose = runtime.dispose;
  runtime.dispose = () => { unsubscribe(); dispose(); };
  const roster = (serverId?: string) => { assertLocal(serverId); return getData(rosterPath, agentsSchema); };
  const currentAgent = async (id: string) => {
    const agent = (await roster()).find((item) => item.id === id);
    if (!agent) throw new Error("Agent not found.");
    return agent;
  };
  const refreshRoster = async () => { await getData(rosterPath, agentsSchema, { force: true }); };
  api.listAgents = roster;
  api.listModels = (serverId) => { assertLocal(serverId); return getData("/api/agents?domain=models", modelsSchema); };
  api.getStatus = (serverId) => { assertLocal(serverId); return getData("/api/agents?domain=status", agentStatusSchema); };
  api.getRuntimeSnapshot = async () => null;
  api.createAgent = async (input, serverId) => {
    assertLocal(serverId);
    const agent = (await runCommand("agents.create", { ...input, id: crypto.randomUUID() }, agentSchema)).data;
    await refreshRoster();
    if (input.initialMessage.trim()) await api.sendMessage({ agentId: agent.id, text: input.initialMessage });
    return agent;
  };
  api.updateAgent = async (input, serverId) => {
    assertLocal(serverId);
    const { agentId, ...patch } = input;
    const previous = await currentAgent(agentId);
    const agent: Record<string, unknown> = { ...previous, ...patch };
    for (const [key, value] of Object.entries(agent)) if (value === null && key !== "avatarUrl" && key !== "avatarHue" && key !== "threadId" && key !== "updatedAt") delete agent[key];
    const saved = (await runCommand("agents.update", { agentId, agent, expectedUpdatedAt: previous.updatedAt }, agentSchema)).data;
    await refreshRoster();
    return saved;
  };
  api.deleteAgent = async (id, serverId) => {
    assertLocal(serverId);
    await runCommand("agents.delete", id, z.null());
    await refreshRoster();
  };
  api.readConversation = async (id, serverId) => {
    assertLocal(serverId);
    const value = await getData(conversationPath(id), conversationDomainSchema);
    return { ...value.snapshot, readState: value.readState };
  };
  api.readConversationPage = (input, serverId) => {
    assertLocal(serverId);
    const params = new URLSearchParams({ agentId: input.agentId, page: "1", limit: String(input.limit ?? 50) });
    if (input.anchor?.type === "before") params.set("before", input.anchor.cursor);
    if (input.anchor?.type === "around") params.set("around", input.anchor.messageId);
    return getData(`/api/agents/conversation?${params}`, conversationPageSchema);
  };
  api.listQueue = async (id, serverId) => { assertLocal(serverId); return (await getData(conversationPath(id), conversationDomainSchema)).queue; };
  api.listConversationReads = (serverId) => { assertLocal(serverId); return getData("/api/agents?domain=reads", z.record(z.string(), readStateSchema)); };
  api.sendMessage = async (input, serverId) => {
    assertLocal(serverId);
    if (input.taskId || input.voiceRecordingDraftId) throw new Error("Task and voice execution require a connected provider.");
    await getData(conversationPath(input.agentId), conversationDomainSchema);
    const result = (await runCommand("agents.send-message", { ...input, clientMessageId: input.clientMessageId ?? crypto.randomUUID() }, sentMessageSchema)).data;
    putQuery(conversationPath(input.agentId), result.conversation);
    return result.receipt;
  };
  const change = async (input: Record<string, unknown>, serverId?: string) => {
    assertLocal(serverId);
    const value = (await runCommand("agents.change-message", input, conversationDomainSchema)).data;
    putQuery(conversationPath(String(input.agentId)), value);
    return value;
  };
  api.markConversationRead = async (input, serverId) => (await change({ agentId: input.agentId, action: "read", ...(input.throughMessageId ? { messageId: input.throughMessageId } : {}) }, serverId)).readState;
  api.markConversationUnread = async (input, serverId) => (await change({ agentId: input.agentId, action: "unread", messageId: input.fromMessageId }, serverId)).readState;
  api.deleteConversationMessage = async (input, serverId) => { if (input.taskId) throw new Error("Task conversations are unavailable."); await change({ agentId: input.agentId, messageId: input.messageId, action: "delete" }, serverId); };
  api.setMessageReaction = async (input, serverId) => { await change({ ...input, action: "reaction" }, serverId); };
  api.setAgentHidden = async (input, serverId) => {
    const agent = await currentAgent(input.agentId);
    const next = { ...agent, ...(input.hidden ? { hiddenAt: new Date().toISOString() } : {}) };
    if (!input.hidden) delete next.hiddenAt;
    assertLocal(serverId);
    await runCommand("agents.update", { agentId: agent.id, agent: next, expectedUpdatedAt: agent.updatedAt }, agentSchema);
    await refreshRoster();
    return { agents: (await roster()).filter((item) => item.hiddenAt).map((item) => ({ agentId: item.id, hiddenAt: item.hiddenAt! })) };
  };
}
