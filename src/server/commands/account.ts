import { z } from "zod";
import {
  accountSessionSchema,
  centralAuthStateSchema,
  requestEmailCodePayloadSchema,
  revokeSessionPayloadSchema,
  updateAvatarPayloadSchema,
  updateNamePayloadSchema,
  verifyEmailCodePayloadSchema,
} from "../../contracts/data-api";
import { revalidateUsage } from "../cache/app";
import { cancelled, invalidInput } from "../errors";
import { executeIdempotent } from "./idempotency";
import { updateSnapshot } from "../repositories/session-store";
import type { CommandDefinition, RegisteredCommand } from "./types";
import { serverEnv } from "../config/env";

const sessionsSchema = z.object({ sessions: z.array(accountSessionSchema).max(100) });

function assertActive(signal: AbortSignal): void {
  if (signal.aborted) throw cancelled();
}

const requestEmailCode: CommandDefinition = {
  payloadSchema: requestEmailCodePayloadSchema,
  resultSchema: centralAuthStateSchema,
  run: async (ctx, payload) => {
    if (serverEnv().dataMode !== "demo") throw invalidInput("Email sign-in requires a configured authentication provider.");
    const input = requestEmailCodePayloadSchema.parse(payload);
    assertActive(ctx.signal);
    const now = Date.now();
    const snapshot = await updateSnapshot(ctx.sessionId, (current) => ({
      ...current,
      auth: {
        status: "code_sent",
        challengeId: crypto.randomUUID(),
        email: input.email,
        expiresAt: now + 600_000,
        resendAvailableAt: now + 60_000,
        developmentCode: "2345-6789",
      },
    }));
    return snapshot.auth;
  },
};

const verifyEmailCode: CommandDefinition = {
  payloadSchema: verifyEmailCodePayloadSchema,
  resultSchema: centralAuthStateSchema,
  run: async (ctx, payload) => {
    if (serverEnv().dataMode !== "demo") throw invalidInput("Email sign-in requires a configured authentication provider.");
    verifyEmailCodePayloadSchema.parse(payload);
    assertActive(ctx.signal);
    const snapshot = await updateSnapshot(ctx.sessionId, (current) => ({
      ...current,
      auth: {
        status: "signed_in",
        user: {
          id: "user-1",
          email: current.auth.status === "code_sent" ? current.auth.email : "person@example.com",
          name: "Norbert",
          avatarUrl: null,
        },
      },
    }));
    await revalidateUsage(ctx.sessionId);
    return snapshot.auth;
  },
};

const updateName: CommandDefinition = {
  payloadSchema: updateNamePayloadSchema,
  resultSchema: centralAuthStateSchema,
  run: async (ctx, payload) => {
    const input = updateNamePayloadSchema.parse(payload);
    assertActive(ctx.signal);
    const snapshot = await updateSnapshot(ctx.sessionId, (current) => {
      if (current.auth.status !== "signed_in") return current;
      return {
        ...current,
        auth: { ...current.auth, user: { ...current.auth.user, name: input.name } },
      };
    });
    return snapshot.auth;
  },
};

const updateAvatar: CommandDefinition = {
  payloadSchema: updateAvatarPayloadSchema,
  resultSchema: centralAuthStateSchema,
  run: async (ctx, payload) => {
    const input = updateAvatarPayloadSchema.parse(payload);
    assertActive(ctx.signal);
    if (input.image && Buffer.from(input.image.bytesBase64, "base64").byteLength > 256 * 1024) {
      throw invalidInput("The avatar image is larger than 256 KiB.");
    }
    const snapshot = await updateSnapshot(ctx.sessionId, (current) => {
      if (current.auth.status !== "signed_in") return current;
      const avatarUrl = input.image
        ? `data:${input.image.mimeType};base64,${input.image.bytesBase64}`
        : null;
      return {
        ...current,
        auth: { ...current.auth, user: { ...current.auth.user, avatarUrl } },
      };
    });
    return snapshot.auth;
  },
};

const logout: CommandDefinition = {
  payloadSchema: z.object({}).strict(),
  resultSchema: centralAuthStateSchema,
  run: async (ctx) => {
    assertActive(ctx.signal);
    const snapshot = await updateSnapshot(ctx.sessionId, (current) => ({
      ...current,
      auth: { status: "signed_out" },
    }));
    await revalidateUsage(ctx.sessionId);
    return snapshot.auth;
  },
};

const revokeSession: CommandDefinition = {
  payloadSchema: revokeSessionPayloadSchema,
  resultSchema: sessionsSchema,
  run: async (ctx, payload) => {
    const input = revokeSessionPayloadSchema.parse(payload);
    assertActive(ctx.signal);
    const snapshot = await updateSnapshot(ctx.sessionId, (current) => ({
      ...current,
      sessions: current.sessions.filter((session) => session.sessionId !== input.sessionId),
    }));
    return { sessions: snapshot.sessions };
  },
};

export const ACCOUNT_COMMANDS: Readonly<Record<string, RegisteredCommand>> = {
  "account.request-email-code": { ...requestEmailCode, idempotent: true },
  "account.verify-email-code": { ...verifyEmailCode, idempotent: true },
  "account.update-name": { ...updateName, idempotent: true },
  "account.update-avatar": { ...updateAvatar, idempotent: true },
  "account.logout": { ...logout, idempotent: true },
  "account.revoke-session": { ...revokeSession, idempotent: true },
};

/** The route's single execution path: parse, claim, run, validate, store. */
export async function runRegisteredCommand<T>(
  definition: RegisteredCommand,
  options: {
    sessionId: string;
    command: string;
    idempotencyKey: string;
    payload: unknown;
    signal: AbortSignal;
  },
): Promise<{ data: T; replayed: boolean }> {
  const parsed = definition.payloadSchema.safeParse(options.payload);
  if (!parsed.success) {
    throw invalidInput("The command payload is invalid.", parsed.error.issues);
  }
  return executeIdempotent({
    sessionId: options.sessionId,
    command: options.command,
    idempotencyKey: options.idempotencyKey,
    payload: parsed.data,
    resultSchema: definition.resultSchema as z.ZodType<T>,
    run: async () => definition.run({ sessionId: options.sessionId, signal: options.signal }, parsed.data) as Promise<T>,
  });
}
