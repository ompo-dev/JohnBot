import {
  conversationDomainSchema,
  persistConversationPayloadSchema,
  rosterPayloadSchema,
} from "../../contracts/agents-data";
import { syncRoster, persistConversation } from "../services/agents";
import type { RegisteredCommand } from "./types";
import { serverEnv } from "../config/env";
import { ApiError } from "../errors";

export const AGENTS_DATA_COMMANDS: Readonly<Record<string, RegisteredCommand>> = {
  "agents.sync-roster": {
    payloadSchema: rosterPayloadSchema,
    resultSchema: rosterPayloadSchema,
    idempotent: true,
    run: (context, raw) => {
      if (serverEnv().dataMode !== "demo") throw new ApiError(400, "invalid_input", "The database owns the roster. Use agent commands.");
      return syncRoster(context.sessionId, rosterPayloadSchema.parse(raw));
    },
  },
  "agents.persist-conversation": {
    payloadSchema: persistConversationPayloadSchema,
    resultSchema: conversationDomainSchema,
    idempotent: true,
    run: (context, raw) => {
      if (serverEnv().dataMode !== "demo") throw new ApiError(400, "invalid_input", "Use server-owned conversation commands.");
      const input = persistConversationPayloadSchema.parse(raw);
      return persistConversation(
        context.sessionId,
        { snapshot: input.snapshot, queue: input.queue, readState: input.readState },
        input.expectedVersion,
      );
    },
  },
};
