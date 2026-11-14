import { z } from "zod";
import { DEFAULT_AGENT_DEFAULTS } from "./ipc-agents";
import { DEFAULT_BUSY_MESSAGE_MODE } from "./ipc-queue";
import { DEFAULT_REMOTE_SESSION_REUSE_PREFERENCE } from "./ipc-remote-sessions";

export const analyticsPreferenceSchema = z.object({ enabled: z.boolean() }).strict();
export const setAnalyticsPreferencePayloadSchema = z
  .object({ enabled: z.boolean(), chosen: z.boolean().optional() })
  .strict();
export const busyMessageModePreferenceSchema = z
  .object({ mode: z.enum(["queue", "steer"]) })
  .strict();
export const agentDefaultsSchema = z
  .object({
    allowAutomation: z.boolean(),
    allowNewChat: z.boolean(),
    quickAcknowledgement: z.boolean(),
    planStartAfterMs: z.number().int().min(5_000).max(2_147_483_647).multipleOf(1_000).nullable(),
    automationRunsPerHour: z.number().int().min(1).max(10_000),
    commitCoAuthor: z.boolean(),
  })
  .strict();
export const remoteSessionReusePreferenceSchema = z
  .object({ keepBetweenRuns: z.boolean() })
  .strict();

export const preferencesDataSchema = z
  .object({
    analytics: analyticsPreferenceSchema,
    busyMessageMode: busyMessageModePreferenceSchema,
    agentDefaults: agentDefaultsSchema,
    remoteSessionReuse: remoteSessionReusePreferenceSchema,
  })
  .strict();

export const PREFERENCE_COMMANDS = {
  setAnalytics: "preferences.set-analytics",
  setBusyMessageMode: "preferences.set-busy-message-mode",
  setAgentDefaults: "preferences.set-agent-defaults",
  setRemoteSessionReuse: "preferences.set-remote-session-reuse",
} as const;

export type PreferencesData = z.infer<typeof preferencesDataSchema>;
export const seedPreferencesData = (): PreferencesData => ({
  analytics: { enabled: false },
  busyMessageMode: { mode: DEFAULT_BUSY_MESSAGE_MODE },
  agentDefaults: { ...DEFAULT_AGENT_DEFAULTS },
  remoteSessionReuse: { ...DEFAULT_REMOTE_SESSION_REUSE_PREFERENCE },
});
