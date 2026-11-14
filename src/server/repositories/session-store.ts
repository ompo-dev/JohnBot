import { z } from "zod";
import {
  accountSessionSchema,
  accountUsageSchema,
  centralAuthStateSchema,
  settingsSnapshotSchema,
} from "../../contracts/data-api";
import { DEFAULT_APP_APPEARANCE, DEFAULT_TRANSPARENT_WINDOW } from "../../contracts/app-appearance";
import { DEFAULT_APP_INTERFACE_SIZE } from "../../contracts/app-interface-size";
import { DEFAULT_APP_LANGUAGE } from "../../contracts/app-language";
import { DEFAULT_APP_LOGO_COLOR } from "../../contracts/app-logo-color";
import { STORY_USAGE } from "../../preview/fixtures";
import { readDomain, updateDomain } from "./domain-store";
import { serverEnv } from "../config/env";

/**
 * `version` drives compare-and-set writes. Entries written before it existed
 * read as version 0, so an upgrade does not lose them.
 */
const snapshotSchema = z.object({
  auth: centralAuthStateSchema,
  sessions: z.array(accountSessionSchema).max(100),
  settings: settingsSnapshotSchema,
  version: z.number().int().nonnegative().default(0),
  updatedAt: z.number(),
});

export type SessionSnapshot = z.infer<typeof snapshotSchema>;

export function seedSnapshot(workspaceId = crypto.randomUUID()): SessionSnapshot {
  const now = Date.now();
  if (serverEnv().dataMode !== "demo") return {
    auth: { status: "signed_in", user: { id: workspaceId, email: "local@localhost.invalid", name: "Workspace local", avatarUrl: null } },
    sessions: [{ sessionId: crypto.randomUUID(), name: "This browser", kind: "desktop", current: true, connectedAt: now, lastActiveAt: now }],
    settings: { language: { language: DEFAULT_APP_LANGUAGE }, logoColor: { color: DEFAULT_APP_LOGO_COLOR },
      appearance: { appearance: DEFAULT_APP_APPEARANCE, palette: null, palettes: [], transparentWindow: DEFAULT_TRANSPARENT_WINDOW,
        chatBackgroundLight: null, chatBackgroundDark: null, interfaceFont: null, codeFont: null },
      interfaceSize: { percent: DEFAULT_APP_INTERFACE_SIZE } },
    version: 0, updatedAt: now,
  };
  return {
    auth: {
      status: "signed_in",
      user: { id: "user-1", email: "person@example.com", name: "Norbert", avatarUrl: null },
    },
    sessions: [
      {
        sessionId: "22222222-2222-4222-8222-222222222222",
        name: "This desktop",
        kind: "desktop",
        current: true,
        connectedAt: now - 86_400_000,
        lastActiveAt: now,
      },
      {
        sessionId: "33333333-3333-4333-8333-333333333333",
        name: "Desktop",
        kind: "desktop",
        current: false,
        connectedAt: now - 172_800_000,
        lastActiveAt: now - 3_600_000,
      },
      {
        sessionId: "44444444-4444-4444-8444-444444444444",
        name: "Research server",
        kind: "desktop",
        current: false,
        connectedAt: now - 259_200_000,
        lastActiveAt: now - 300_000,
        hostedServer: true,
      },
      {
        sessionId: "11111111-1111-4111-8111-111111111111",
        name: "Norbert’s iPhone",
        kind: "mobile",
        current: false,
        connectedAt: now - 86_400_000,
        lastActiveAt: now - 60_000,
      },
    ],
    settings: {
      language: { language: DEFAULT_APP_LANGUAGE },
      logoColor: { color: DEFAULT_APP_LOGO_COLOR },
      appearance: {
        appearance: DEFAULT_APP_APPEARANCE,
        palette: null,
        palettes: [],
        transparentWindow: DEFAULT_TRANSPARENT_WINDOW,
        chatBackgroundLight: null,
        chatBackgroundDark: null,
        interfaceFont: null,
        codeFont: null,
      },
      interfaceSize: { percent: DEFAULT_APP_INTERFACE_SIZE },
    },
    version: 0,
    updatedAt: now,
  };
}

export async function loadSnapshot(sessionId: string): Promise<SessionSnapshot> {
  return readDomain(sessionId, "session", snapshotSchema, () => seedSnapshot(sessionId));
}

export async function updateSnapshot(
  sessionId: string,
  change: (snapshot: SessionSnapshot) => SessionSnapshot | undefined,
): Promise<SessionSnapshot> {
  return updateDomain(sessionId, "session", snapshotSchema, () => seedSnapshot(sessionId), (current) => ({
    ...(change(current) ?? current),
    version: current.version + 1,
    updatedAt: Date.now(),
  }));
}
export function usageFor(auth: SessionSnapshot["auth"]) {
  if (serverEnv().dataMode !== "demo") return accountUsageSchema.parse({ limits: [] });
  if (auth.status !== "signed_in") return accountUsageSchema.parse({ limits: [] });
  return accountUsageSchema.parse(structuredClone(STORY_USAGE));
}
