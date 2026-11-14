import { z } from "zod";
import {
  agentDefaultsSchema,
  analyticsPreferenceSchema,
  busyMessageModePreferenceSchema,
  PREFERENCE_COMMANDS,
  preferencesDataSchema,
  remoteSessionReusePreferenceSchema,
  type PreferencesData,
} from "../../../contracts/preferences-data";
import type { MockjohnBotControls } from "../../../preview/mock-johnbot";
import { getData, runCommand } from "../client";
import { dataStore, readEntry, seedQuery } from "../../../stores/data-store";

export function installPreferencesData(mock: MockjohnBotControls): void {
  const api = mock.api;
  const getters = [
    api.getAnalyticsPreference,
    api.getBusyMessageModePreference,
    api.getAgentDefaults,
    api.getRemoteSessionReusePreference,
  ] as const;
  const setters = {
    analytics: api.setAnalyticsPreference,
    busyMessageMode: api.setBusyMessageModePreference,
    agentDefaults: api.setAgentDefaults,
    remoteSessionReuse: api.setRemoteSessionReusePreference,
  };
  const applied: Partial<PreferencesData> = {};
  let synchronization = Promise.resolve();
  const unsubscribe = dataStore.subscribe((state, previous) => {
    if (state.entries["/api/preferences"] === previous.entries["/api/preferences"]) return;
    const parsed = preferencesDataSchema.safeParse(state.entries["/api/preferences"]?.data);
    if (!parsed.success) return;
    const value = parsed.data;
    synchronization = synchronization
      .catch(() => undefined)
      .then(async () => {
        for (const field of Object.keys(setters) as (keyof PreferencesData)[]) {
          if (JSON.stringify(applied[field]) === JSON.stringify(value[field])) continue;
          // The field and setter share the same PreferencesData mapping.
          await (setters[field] as (input: PreferencesData[typeof field]) => Promise<unknown>)(
            value[field],
          );
          applied[field] = structuredClone(value[field]) as never;
        }
      });
    void synchronization.catch(() => undefined);
  });
  let bootstrap: Promise<PreferencesData> | undefined;
  const load = () => {
    if (!bootstrap) {
      const pending = getData("/api/preferences", preferencesDataSchema).then(async (value) => {
        await synchronization;
        return value;
      });
      bootstrap = pending;
      void pending
        .finally(() => {
          if (bootstrap === pending) bootstrap = undefined;
        })
        .catch(() => undefined);
    }
    return bootstrap;
  };
  const mutate = async <T>(command: string, input: unknown, schema: z.ZodType<T>) => {
    if (readEntry("/api/preferences")?.data === undefined) {
      const [analytics, busyMessageMode, agentDefaults, remoteSessionReuse] = await Promise.all(
        getters.map((get) => get()),
      );
      const initial = preferencesDataSchema.parse({
        analytics,
        busyMessageMode,
        agentDefaults,
        remoteSessionReuse,
      });
      if (readEntry("/api/preferences")?.data === undefined) {
        Object.assign(applied, structuredClone(initial));
        seedQuery("/api/preferences", initial);
      }
    }
    try {
      const result = await runCommand(
        command,
        input,
        z.object({ preferences: preferencesDataSchema, value: schema }).strict(),
      );
      await synchronization;
      return result.data.value;
    } catch (error) {
      await synchronization;
      throw error;
    }
  };
  api.getAnalyticsPreference = () => load().then((value) => value.analytics);
  api.setAnalyticsPreference = (input) =>
    mutate(PREFERENCE_COMMANDS.setAnalytics, input, analyticsPreferenceSchema);
  api.getBusyMessageModePreference = () => load().then((value) => value.busyMessageMode);
  api.setBusyMessageModePreference = (input) =>
    mutate(PREFERENCE_COMMANDS.setBusyMessageMode, input, busyMessageModePreferenceSchema);
  api.getAgentDefaults = () => load().then((value) => value.agentDefaults);
  api.setAgentDefaults = (input) =>
    mutate(PREFERENCE_COMMANDS.setAgentDefaults, input, agentDefaultsSchema);
  api.getRemoteSessionReusePreference = () => load().then((value) => value.remoteSessionReuse);
  api.setRemoteSessionReusePreference = (input) =>
    mutate(PREFERENCE_COMMANDS.setRemoteSessionReuse, input, remoteSessionReusePreferenceSchema);
  const dispose = mock.dispose;
  mock.dispose = () => {
    unsubscribe();
    dispose?.();
  };
}
