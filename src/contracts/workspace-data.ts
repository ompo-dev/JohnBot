import { z } from "zod";
import { isClientAgentSummary, type ClientAgentSummary, isMessageReaction, type MessageReaction } from "./ipc";
import { conversationDomainSchema, receiptSchema } from "./agents-data";
import { isAgentProvider, type AgentProviderId } from "./agent-providers";
import { isAvatarHue, type AvatarHue } from "./ipc-agent-identity";

export const entityIdSchema = z.string().min(1).max(160).regex(/^[\w:-]+$/u);
export const agentSchema = z.custom<ClientAgentSummary>(isClientAgentSummary);
export const createAgentSchema = z.object({
  id: z.uuid(), name: z.string().trim().min(1).max(160), description: z.string().max(10_000).default(""),
  avatarSeed: z.string().min(1).max(160), avatarHue: z.custom<AvatarHue>(isAvatarHue).nullable(),
  avatarColor: z.string().max(32).nullable().optional(), initialMessage: z.string().max(100_000).default(""),
  provider: z.custom<AgentProviderId>(isAgentProvider).default("codex"), model: z.string().min(1).max(200).default("default"),
  reasoningEffort: z.string().max(32).default("low"), providerAccountId: z.string().max(160).optional(),
}).strict();
export const updateAgentSchema = z.object({ agentId: entityIdSchema, agent: agentSchema, expectedUpdatedAt: z.string().nullable() }).strict()
  .refine((value) => value.agentId === value.agent.id);
export const sendMessageSchema = z.object({
  agentId: entityIdSchema, clientMessageId: z.uuid(), text: z.string().min(1).max(100_000),
  replyToMessageId: entityIdSchema.nullable().optional(),
  attachmentDraftIds: z.array(z.string()).max(0).optional(),
}).strict();
export const messageChangeSchema = z.object({
  agentId: entityIdSchema, action: z.enum(["read", "unread", "delete", "reaction", "cancel"]),
  messageId: entityIdSchema.optional(),
  emoji: z.custom<MessageReaction | null>((value) => value === null || isMessageReaction(value)).optional(),
}).strict().refine((value) => !["delete", "reaction"].includes(value.action) || Boolean(value.messageId));
export const sentMessageSchema = z.object({ conversation: conversationDomainSchema, receipt: receiptSchema }).strict();
