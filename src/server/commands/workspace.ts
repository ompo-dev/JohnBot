import { z } from "zod";
import { agentSchema, createAgentSchema, entityIdSchema, messageChangeSchema, sendMessageSchema, sentMessageSchema, updateAgentSchema } from "../../contracts/workspace-data";
import { conversationDomainSchema } from "../../contracts/agents-data";
import { createAgent, saveAgent, deleteAgent, sendMessage, changeMessage } from "../services/workspace";
import type { RegisteredCommand } from "./types";
import { sidebarChangeSchema, sidebarSchema, memoryChangeSchema, memoriesSchema } from "../../contracts/workspace-ui";
import { changeSidebar, changeMemory } from "../services/workspace-ui";

export const WORKSPACE_COMMANDS: Readonly<Record<string, RegisteredCommand>> = {
  "workspace.sidebar": { payloadSchema: sidebarChangeSchema, resultSchema: sidebarSchema, idempotent: true,
    run: (ctx, raw) => changeSidebar(ctx.sessionId, sidebarChangeSchema.parse(raw)) },
  "workspace.memory": { payloadSchema: memoryChangeSchema, resultSchema: memoriesSchema, idempotent: true,
    run: (ctx, raw) => changeMemory(ctx.sessionId, memoryChangeSchema.parse(raw)) },
  "agents.create": { payloadSchema: createAgentSchema, resultSchema: agentSchema, idempotent: true,
    run: (ctx, raw) => createAgent(ctx.sessionId, createAgentSchema.parse(raw)) },
  "agents.update": { payloadSchema: updateAgentSchema, resultSchema: agentSchema, idempotent: true,
    run: (ctx, raw) => { const input = updateAgentSchema.parse(raw); return saveAgent(ctx.sessionId, input.agent, input.expectedUpdatedAt); } },
  "agents.delete": { payloadSchema: entityIdSchema, resultSchema: z.null(), idempotent: true,
    run: (ctx, raw) => deleteAgent(ctx.sessionId, entityIdSchema.parse(raw)) },
  "agents.send-message": { payloadSchema: sendMessageSchema, resultSchema: sentMessageSchema, idempotent: true,
    run: (ctx, raw) => sendMessage(ctx.sessionId, sendMessageSchema.parse(raw)) },
  "agents.change-message": { payloadSchema: messageChangeSchema, resultSchema: conversationDomainSchema, idempotent: true,
    run: (ctx, raw) => changeMessage(ctx.sessionId, messageChangeSchema.parse(raw)) },
};
