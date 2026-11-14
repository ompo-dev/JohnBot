import { z } from "zod";
import type { ConversationSnapshot, QueueSnapshot } from "@johnbot/contracts/ipc";
import {
  STORY_AGENT_STATUS,
  STORY_AGENT_SUMMARIES,
  STORY_MODELS,
  STORY_SNAPSHOTS,
} from "../../preview/fixtures";
import { DEMO_OPTIONS } from "../../preview/demo-seed";
import {
  conversationDomainSchema,
  conversationPageSchema,
  emptyReadState,
  agentsSchema,
  agentStatusSchema,
  modelsSchema,
  queueSchema,
} from "../../contracts/agents-data";
import { readDomain, updateDomain } from "../repositories/domain-store";
import { ApiError, invalidInput } from "../errors";
import { serverEnv } from "../config/env";
import { JOHN_DEERE_AGENTS, JOHN_DEERE_PEOPLE, johnDeereConversation } from "../demo/john-deere";

export const AGENTS_DOMAIN = "agents";
export const AGENT_STATUS_DOMAIN = "agent-status";
export const AGENT_MODELS_DOMAIN = "agent-models";
const emptyQueue = (agentId: string): QueueSnapshot => ({ agentId, deliveries: [] });
export const seedAgents = () =>
  serverEnv().dataMode === "demo" ? STORY_AGENT_SUMMARIES : JOHN_DEERE_AGENTS;
export const seedStatus = () => serverEnv().dataMode === "demo" ? STORY_AGENT_STATUS : {
  phase: "idle" as const, cliVersion: null, auth: { kind: "unknown" }, providers: [],
  capabilities: { chat: "unavailable" as const, browser: "unavailable" as const, computerUse: "unavailable" as const },
  message: "No execution provider connected.", fullAccess: true as const,
};
export const seedModels = () => serverEnv().dataMode === "demo" ? STORY_MODELS : [];
export async function readAgents(sessionId: string) {
  const agents = await readDomain(sessionId, AGENTS_DOMAIN, agentsSchema, seedAgents);
  if (serverEnv().dataMode === "demo" || !isLegacyFactoryRoster(agents)) return agents;
  return updateDomain(sessionId, AGENTS_DOMAIN, agentsSchema, seedAgents, (current) =>
    isLegacyFactoryRoster(current) ? JOHN_DEERE_AGENTS : current,
  );
}

/** Replace only the former all-human factory seed; user-created agents remain untouched. */
function isLegacyFactoryRoster(agents: import("@johnbot/contracts/ipc").ClientAgentSummary[]) {
  return (
    agents.length === JOHN_DEERE_AGENTS.length &&
    JOHN_DEERE_PEOPLE.every((person) => agents.some((agent) => agent.id === person.id && agent.name === person.name))
  );
}
export async function readStatus(sessionId: string) {
  if (serverEnv().dataMode !== "demo") return agentStatusSchema.parse(seedStatus());
  return readDomain(sessionId, AGENT_STATUS_DOMAIN, agentStatusSchema, seedStatus);
}
export async function readModels(sessionId: string) {
  if (serverEnv().dataMode !== "demo") return modelsSchema.parse(seedModels());
  return readDomain(sessionId, AGENT_MODELS_DOMAIN, modelsSchema, seedModels);
}
export async function syncRoster(
  sessionId: string,
  agents: import("@johnbot/contracts/ipc").ClientAgentSummary[],
) {
  return updateDomain(sessionId, AGENTS_DOMAIN, agentsSchema, seedAgents, (current) => {
    void current;
    return agents;
  });
}
export function seedConversation(agentId: string) {
  const snapshot: ConversationSnapshot = (serverEnv().dataMode === "demo"
    ? DEMO_OPTIONS.snapshots?.[agentId] ?? STORY_SNAPSHOTS[agentId] : undefined) ?? {
      agentId,
      threadId: `thread-${agentId}`,
      activeTurnId: null,
      revision: 0,
      messages: [],
    };
  if (serverEnv().dataMode === "demo" || snapshot.messages.length > 0) {
    return { snapshot, readState: emptyReadState(), queue: emptyQueue(agentId), version: 0 };
  }
  // A new session starts with a complete work thread: context, decision and follow-through.
  const startedAt = new Date(Date.now() - 42 * 60 * 1000).toISOString();
  const messages = johnDeereConversation(agentId).map((message, index) => ({
    id: `seed-${agentId}-${index + 1}`,
    turnId: `seed-turn-${agentId}-${Math.floor(index / 2) + 1}`,
    author: message.author === "agent" ? "assistant" : message.author,
    source: message.author === "agent" ? "agent" : message.author,
    senderAgentId: message.author === "agent" ? agentId : undefined,
    senderMember: message.author === "user" ? { id: "john-operator", name: "Operação John Deere" } : undefined,
    text: message.text,
    ...(message.itemType ? { itemType: message.itemType } : {}),
    ...(message.attachments ? { attachments: message.attachments } : {}),
    ...(message.plan ? { plan: message.plan } : {}),
    ...(message.subagents ? { subagents: message.subagents } : {}),
    ...(message.memoryChanges ? { memoryChanges: message.memoryChanges } : {}),
    ...(message.routine ? { routine: message.routine } : {}),
    status: "completed" as const,
    createdAt: new Date(Date.parse(startedAt) + index * 90_000).toISOString(),
    replyToMessageId: index % 2 === 0 ? null : `seed-${agentId}-${index}`,
    reactions: index === 5 ? [{ emoji: "✅", actor: { kind: "user" as const } }] : undefined,
  }));
  return {
    snapshot: { ...snapshot, revision: messages.length, messages },
    readState: emptyReadState(),
    queue: emptyQueue(agentId),
    version: 0,
  };
}

function isLegacyFactoryConversation(value: ReturnType<typeof seedConversation>, agentId: string): boolean {
  const messages = value.snapshot.messages;
  return (
    JOHN_DEERE_AGENTS.some((agent) => agent.id === agentId) &&
    messages.every((message, index) => message.id === `seed-${agentId}-${index + 1}`) &&
    (messages.length === 2 ||
      messages.length === 6 ||
      messages.some((message) => message.text === "Dados de operação, qualidade e manutenção reconciliados no turno.") ||
      !messages.some((message) => message.text.startsWith("### Caderno de análise")))
  );
}

export async function readConversation(sessionId: string, agentId: string) {
  if (serverEnv().dataMode !== "demo" && !(await readAgents(sessionId)).some((agent) => agent.id === agentId))
    throw new ApiError(404, "not_found", "Agent not found.");
  const domain = `conversation:${agentId}`;
  const current = await readDomain(sessionId, domain, conversationDomainSchema, () =>
    seedConversation(agentId),
  );
  if (serverEnv().dataMode === "demo" || !isLegacyFactoryConversation(current, agentId)) return current;
  return updateDomain(sessionId, domain, conversationDomainSchema, seedConversation.bind(null, agentId), (latest) =>
    isLegacyFactoryConversation(latest, agentId)
      ? {
          ...seedConversation(agentId), version: latest.version + 1,
          snapshot: { ...seedConversation(agentId).snapshot,
            revision: latest.snapshot.revision + 1,
            messages: seedConversation(agentId).snapshot.messages.map((message) => {
              const previous = latest.snapshot.messages.find((item) => item.id === message.id);
              return previous ? { ...message, reaction: previous.reaction, reactions: previous.reactions } : message;
            }),
          },
        }
      : latest,
  );
}
export async function updateConversation(
  sessionId: string,
  agentId: string,
  change: (current: ReturnType<typeof seedConversation>) => ReturnType<typeof seedConversation>,
) {
  const domain = `conversation:${agentId}`;
  return updateDomain(
    sessionId,
    domain,
    conversationDomainSchema,
    seedConversation.bind(null, agentId),
    change,
  );
}
export async function persistConversation(
  sessionId: string,
  value: Omit<ReturnType<typeof seedConversation>, "version">,
  expectedVersion: number,
) {
  return updateConversation(sessionId, value.snapshot.agentId, (current) => {
    if (current.version !== expectedVersion)
      throw new ApiError(
        409,
        "conflict",
        "The conversation changed in another client. Reload before retrying.",
      );
    return { ...value, version: current.version + 1 };
  });
}

export async function listConversationReads(sessionId: string) {
  const agents = await readAgents(sessionId);
  return Object.fromEntries(
    await Promise.all(
      agents.map(async (agent) => [
        agent.id,
        (await readConversation(sessionId, agent.id)).readState,
      ]),
    ),
  );
}
export async function readConversationPage(
  sessionId: string,
  agentId: string,
  before: string | undefined,
  around: string | undefined,
  limit: number,
) {
  const { snapshot, readState } = await readConversation(sessionId, agentId);
  const anchorIndex =
    around === undefined ? -1 : snapshot.messages.findIndex((message) => message.id === around);
  const cursorIndex =
    before === undefined
      ? snapshot.messages.length
      : snapshot.messages.findIndex((message) => message.id === before);
  const end =
    anchorIndex >= 0
      ? Math.min(snapshot.messages.length, anchorIndex + Math.ceil(limit / 2))
      : cursorIndex < 0
        ? snapshot.messages.length
        : cursorIndex;
  const start =
    anchorIndex >= 0 ? Math.max(0, anchorIndex - Math.floor(limit / 2)) : Math.max(0, end - limit);
  const messages = snapshot.messages.slice(start, end);
  return {
    agentId,
    threadId: snapshot.threadId,
    activeTurnId: snapshot.activeTurnId,
    revision: snapshot.revision,
    messages,
    references: {},
    pageInfo: { hasOlder: start > 0, olderCursor: start > 0 ? (messages[0]?.id ?? null) : null },
    readState,
  };
}
export async function readQueue(sessionId: string, agentId: string) {
  return (await readConversation(sessionId, agentId)).queue;
}
export async function updateQueue(
  sessionId: string,
  agentId: string,
  change: (current: QueueSnapshot) => QueueSnapshot,
) {
  return updateDomain(
    sessionId,
    `queue:${agentId}`,
    queueSchema,
    () => emptyQueue(agentId),
    change,
  );
}

export async function readAgentDomain(sessionId: string, domain: string, agentId?: string) {
  if (domain === "agents") return readAgents(sessionId);
  if (domain === "models") return readModels(sessionId);
  if (domain === "status") return readStatus(sessionId);
  if (domain === "reads") return listConversationReads(sessionId);
  if (domain === "conversation" && agentId) return readConversation(sessionId, agentId);
  if (domain === "queue" && agentId) return readQueue(sessionId, agentId);
  throw invalidInput("Unknown agent data resource.");
}

const pageSchema = z
  .object({
    agentId: z.string().min(1).max(160),
    before: z.string().min(1).max(160).optional(),
    around: z.string().min(1).max(160).optional(),
    limit: z.number().int().min(1).max(100).default(50),
  })
  .strict();

export async function readAgentPage(sessionId: string, raw: unknown) {
  const input = pageSchema.parse(raw);
  return conversationPageSchema.parse(
    await readConversationPage(sessionId, input.agentId, input.before, input.around, input.limit),
  );
}
