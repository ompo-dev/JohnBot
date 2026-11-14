import { defaultProviderModel, type ClientAgentSummary, type QueueDelivery } from "../../contracts/ipc";
import { agentSchema, createAgentSchema, messageChangeSchema, sendMessageSchema } from "../../contracts/workspace-data";
import { agentsSchema } from "../../contracts/agents-data";
import { z } from "zod";
import { readAgents, updateConversation, AGENTS_DOMAIN, seedAgents } from "./agents";
import { updateDomain } from "../repositories/domain-store";
import { ApiError } from "../errors";

export async function requireAgent(sessionId: string, agentId: string) {
  const agent = (await readAgents(sessionId)).find((entry) => entry.id === agentId);
  if (!agent) throw new ApiError(404, "not_found", "Agent not found.");
  return agent;
}
export async function createAgent(sessionId: string, input: z.infer<typeof createAgentSchema>) {
  const agent = agentSchema.parse({
    id: input.id, name: input.name, title: "", description: input.description,
    provider: input.provider, model: input.model === "default" ? defaultProviderModel(input.provider) : input.model,
    reasoningEffort: input.reasoningEffort, notifications: true, threadId: crypto.randomUUID(),
    workspacePath: "", preview: "", updatedAt: null, avatarSeed: input.avatarSeed,
    avatarHue: input.avatarHue, avatarUrl: null,
    ...(input.providerAccountId ? { providerAccountId: input.providerAccountId } : {}),
  });
  const agents = await updateDomain(sessionId, AGENTS_DOMAIN, agentsSchema, seedAgents, (current) => {
    const existing = current.find((item) => item.id === agent.id);
    if (existing) throw new ApiError(409, "conflict", "Agent already exists.");
    return [...current, agent];
  });
  return agents.find((item) => item.id === agent.id)!;
}
export async function saveAgent(sessionId: string, agent: ClientAgentSummary, expectedUpdatedAt: string | null) {
  await requireAgent(sessionId, agent.id);
  await updateDomain(sessionId, AGENTS_DOMAIN, agentsSchema, seedAgents, (current) => {
    if (!current.some((item) => item.id === agent.id)) throw new ApiError(404, "not_found", "Agent not found.");
    const existing = current.find((item) => item.id === agent.id)!;
    if (existing.updatedAt !== expectedUpdatedAt) throw new ApiError(409, "conflict", "Agent changed in another client. Reload before saving.");
    return current.map((item) => item.id === agent.id ? { ...agent, updatedAt: new Date().toISOString() } : item);
  });
  return requireAgent(sessionId, agent.id);
}
export async function deleteAgent(sessionId: string, agentId: string) {
  await updateDomain(sessionId, AGENTS_DOMAIN, agentsSchema, seedAgents, (current) => current.filter((item) => item.id !== agentId));
  return null;
}
export async function sendMessage(sessionId: string, input: z.infer<typeof sendMessageSchema>) {
  const agent = await requireAgent(sessionId, input.agentId);
  if (agent.hiddenAt) throw new ApiError(409, "conflict", "Restore this agent before sending a message.");
  const createdAt = new Date().toISOString();
  const id = input.clientMessageId;
  const conversation = await updateConversation(sessionId, input.agentId, (current) => {
    const existing = current.snapshot.messages.find((item) => item.id === id);
    if (existing) {
      if (existing.text !== input.text || existing.replyToMessageId !== (input.replyToMessageId ?? null))
        throw new ApiError(409, "conflict", "Message identifier already used with different content.");
      return current;
    }
    const delivery: QueueDelivery = {
      id, messageId: id, recipientAgentId: input.agentId, sender: { kind: "user" },
      text: input.text, attachments: [], replyToMessageId: input.replyToMessageId ?? null,
      status: "queued", position: current.queue.deliveries.filter((item) => item.status === "queued").length + 1,
      turnId: null, error: null, createdAt,
    };
    return {
      ...current, version: current.version + 1,
      snapshot: { ...current.snapshot, threadId: current.snapshot.threadId ?? agent.threadId,
        revision: current.snapshot.revision + 1, messages: [...current.snapshot.messages, {
          id, author: "user", source: "user", text: input.text, status: "completed", createdAt,
          replyToMessageId: input.replyToMessageId ?? null,
        }] },
      queue: { ...current.queue, deliveries: [...current.queue.deliveries, delivery] },
    };
  });
  const delivery = conversation.queue.deliveries.find((item) => item.id === id)!;
  return { conversation, receipt: { messageId: id, deliveries: [{ id, recipientAgentId: input.agentId, status: delivery.status, position: delivery.position }] } };
}
export async function changeMessage(sessionId: string, input: z.infer<typeof messageChangeSchema>) {
  await requireAgent(sessionId, input.agentId);
  return updateConversation(sessionId, input.agentId, (current) => {
    const messages = current.snapshot.messages;
    if (input.messageId && !messages.some((item) => item.id === input.messageId))
      throw new ApiError(404, "not_found", "Message not found.");
    let next = current;
    if (input.action === "read") next = { ...current, readState: { unreadCount: 0, firstUnreadMessageId: null, throughMessageId: input.messageId ?? messages.at(-1)?.id ?? null } };
    if (input.action === "unread") {
      const message = input.messageId ? messages.find((item) => item.id === input.messageId) : messages.find((item) => item.author === "agent");
      next = { ...current, readState: { unreadCount: message ? 1 : 0, firstUnreadMessageId: message?.id ?? null, throughMessageId: null } };
    }
    if (input.action === "delete") next = { ...current, snapshot: { ...current.snapshot, messages: messages.filter((item) => item.id !== input.messageId) }, queue: { ...current.queue, deliveries: current.queue.deliveries.filter((item) => item.id !== input.messageId) } };
    if (input.action === "reaction") next = {
      ...current,
      snapshot: {
        ...current.snapshot,
        messages: messages.map((item) =>
          item.id === input.messageId
            ? {
                ...item,
                reaction: input.emoji ?? null,
                reactions: [
                  ...(item.reactions ?? []).filter((reaction) => reaction.actor.kind !== "user"),
                  ...(input.emoji ? [{ emoji: input.emoji, actor: { kind: "user" as const } }] : []),
                ],
              }
            : item,
        ),
      },
    };
    if (input.action === "cancel") next = { ...current, queue: { ...current.queue, deliveries: current.queue.deliveries.map((item) => item.status === "queued" ? { ...item, status: "cancelled", position: null } : item) } };
    return { ...next, version: current.version + 1, snapshot: { ...next.snapshot, revision: current.snapshot.revision + 1 } };
  });
}
