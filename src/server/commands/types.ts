import type { z } from "zod";

export interface CommandContext {
  sessionId: string;
  signal: AbortSignal;
}

export interface CommandDefinition {
  /** The allowlisted shape the route parses before any handler runs. */
  payloadSchema: z.ZodType;
  /** The shape the stored result must satisfy before it can be replayed. */
  resultSchema: z.ZodType;
  run(context: CommandContext, payload: unknown): Promise<unknown>;
}

export interface RegisteredCommand extends CommandDefinition {
  idempotent: boolean;
}
