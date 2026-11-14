import { z } from "zod";
import {
  isAgentStatus,
  isClientAgentSummary,
  isClientAgentModelOption,
  isConversationMessage,
  isConversationSnapshot,
  isConversationReadState,
  isQueueSnapshot,
  isQueuedMessageReceipt,
  type AgentStatus,
  type ClientAgentModelOption,
  type ClientAgentSummary,
  type ConversationSnapshot,
  type ConversationReadState,
  type QueueSnapshot,
  type ConversationPage,
  type QueuedMessageReceipt,
} from "@johnbot/contracts/ipc";

export const agentStatusSchema = z.custom<AgentStatus>(isAgentStatus);
export const agentsSchema = z.array(z.custom<ClientAgentSummary>(isClientAgentSummary)).max(500);
export const rosterPayloadSchema = agentsSchema;
export const persistConversationPayloadSchema = z
  .object({
    agentId: z.string().min(1).max(160),
    expectedVersion: z.number().int().nonnegative(),
    snapshot: z.custom<ConversationSnapshot>(isConversationSnapshot),
    readState: z.custom<ConversationReadState>(isConversationReadState),
    queue: z.custom<QueueSnapshot>(isQueueSnapshot),
  })
  .strict()
  .refine(
    (value) => value.agentId === value.snapshot.agentId && value.agentId === value.queue.agentId,
  );
export const modelsSchema = z
  .array(z.custom<ClientAgentModelOption>(isClientAgentModelOption))
  .max(1000);
export const readStateSchema = z.custom<ConversationReadState>(isConversationReadState);
export const conversationSchema = z.custom<ConversationSnapshot>(isConversationSnapshot);
export const queueSchema = z.custom<QueueSnapshot>(isQueueSnapshot);
export const conversationDomainSchema = z
  .object({
    snapshot: conversationSchema,
    readState: readStateSchema,
    queue: queueSchema,
    version: z.number().int().nonnegative().default(0),
  })
  .strict();
export const conversationPageSchema = z.custom<ConversationPage>(
  (value): value is ConversationPage => {
    if (!value || typeof value !== "object") return false;
    const page = value as Record<string, unknown>;
    return (
      typeof page.agentId === "string" &&
      (page.threadId === null || typeof page.threadId === "string") &&
      (page.activeTurnId === null || typeof page.activeTurnId === "string") &&
      typeof page.revision === "number" &&
      Array.isArray(page.messages) &&
      page.messages.every(isConversationMessage) &&
      typeof page.references === "object" &&
      page.references !== null &&
      Object.values(page.references).every(isConversationMessage) &&
      typeof page.pageInfo === "object" &&
      page.pageInfo !== null &&
      typeof (page.pageInfo as Record<string, unknown>).hasOlder === "boolean" &&
      ((page.pageInfo as Record<string, unknown>).olderCursor === null ||
        typeof (page.pageInfo as Record<string, unknown>).olderCursor === "string") &&
      (page.readState === undefined || isConversationReadState(page.readState))
    );
  },
);
export const receiptSchema = z.custom<QueuedMessageReceipt>(isQueuedMessageReceipt);
export const emptyReadState = (): ConversationReadState => ({
  unreadCount: 0,
  firstUnreadMessageId: null,
  throughMessageId: null,
});
