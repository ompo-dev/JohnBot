import { z } from "zod";
import {
  agentDefaultsSchema,
  analyticsPreferenceSchema,
  busyMessageModePreferenceSchema,
  PREFERENCE_COMMANDS,
  preferencesDataSchema,
  remoteSessionReusePreferenceSchema,
  setAnalyticsPreferencePayloadSchema,
} from "../../contracts/preferences-data";
import { cancelled } from "../errors";
import { type readPreferencesData, updatePreferencesData } from "../services/preferences";
import type { RegisteredCommand } from "./types";

const command = (
  payloadSchema: z.ZodType,
  resultSchema: z.ZodType,
  run: RegisteredCommand["run"],
): RegisteredCommand => ({
  payloadSchema,
  resultSchema,
  idempotent: true,
  run,
});
const resultFor = (key: keyof Awaited<ReturnType<typeof readPreferencesData>>) =>
  z
    .object({
      preferences: preferencesDataSchema,
      value:
        key === "agentDefaults"
          ? agentDefaultsSchema
          : key === "analytics"
            ? analyticsPreferenceSchema
            : key === "busyMessageMode"
              ? busyMessageModePreferenceSchema
              : remoteSessionReusePreferenceSchema,
    })
    .strict();

function assertActive(signal: AbortSignal): void {
  if (signal.aborted) throw cancelled();
}

export const PREFERENCES_DATA_COMMANDS: Readonly<Record<string, RegisteredCommand>> = {
  [PREFERENCE_COMMANDS.setAnalytics]: command(
    setAnalyticsPreferencePayloadSchema,
    resultFor("analytics"),
    async (ctx, raw) => {
      assertActive(ctx.signal);
      const input = setAnalyticsPreferencePayloadSchema.parse(raw);
      const preferences = await updatePreferencesData(ctx.sessionId, (current) => ({
        ...current,
        analytics: { enabled: input.enabled },
      }));
      return { preferences, value: preferences.analytics };
    },
  ),
  [PREFERENCE_COMMANDS.setBusyMessageMode]: command(
    busyMessageModePreferenceSchema,
    resultFor("busyMessageMode"),
    async (ctx, raw) => {
      assertActive(ctx.signal);
      const value = busyMessageModePreferenceSchema.parse(raw);
      const preferences = await updatePreferencesData(ctx.sessionId, (current) => ({
        ...current,
        busyMessageMode: value,
      }));
      return { preferences, value: preferences.busyMessageMode };
    },
  ),
  [PREFERENCE_COMMANDS.setAgentDefaults]: command(
    agentDefaultsSchema,
    resultFor("agentDefaults"),
    async (ctx, raw) => {
      assertActive(ctx.signal);
      const value = agentDefaultsSchema.parse(raw);
      const preferences = await updatePreferencesData(ctx.sessionId, (current) => ({
        ...current,
        agentDefaults: value,
      }));
      return { preferences, value: preferences.agentDefaults };
    },
  ),
  [PREFERENCE_COMMANDS.setRemoteSessionReuse]: command(
    remoteSessionReusePreferenceSchema,
    resultFor("remoteSessionReuse"),
    async (ctx, raw) => {
      assertActive(ctx.signal);
      const value = remoteSessionReusePreferenceSchema.parse(raw);
      const preferences = await updatePreferencesData(ctx.sessionId, (current) => ({
        ...current,
        remoteSessionReuse: value,
      }));
      return { preferences, value: preferences.remoteSessionReuse };
    },
  ),
};
