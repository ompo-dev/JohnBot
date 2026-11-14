import { settingsSnapshotSchema, centralAuthStateSchema } from "../../../contracts/data-api";
import type { MockjohnBotControls } from "../../../preview/mock-johnbot";
import { dataStore, readEntry, seedQuery } from "../../../stores/data-store";
export function bindRuntimeSettings(
  mock: MockjohnBotControls,
): (() => Promise<void>) & { flush: () => Promise<void> } {
  const api = mock.api;
  const getters = [
    api.getAppLanguagePreference,
    api.getAppLogoColorPreference,
    api.getAppAppearancePreference,
    api.getAppInterfaceSizePreference,
  ] as const;
  const setters = {
    language: api.setAppLanguagePreference,
    logoColor: api.setAppLogoColorPreference,
    appearance: api.setAppAppearancePreference,
    interfaceSize: api.setAppInterfaceSizePreference,
  };
  const applied = new Map<string, string>();
  let synchronization = Promise.resolve();
  const unsubscribe = dataStore.subscribe((state, previous) => {
    const entry = state.entries["/api/settings"];
    if (entry !== previous.entries["/api/settings"]) {
      const parsed = settingsSnapshotSchema.safeParse(entry?.data);
      if (parsed.success)
        synchronization = synchronization
          .catch(() => undefined)
          .then(async () => {
            for (const key of Object.keys(setters) as (keyof typeof setters)[]) {
              const value = parsed.data[key];
              const fingerprint = JSON.stringify(value);
              if (applied.get(key) === fingerprint) continue;
              await (setters[key] as (input: typeof value) => Promise<unknown>)(value);
              applied.set(key, fingerprint);
            }
          });
      void synchronization.catch(() => undefined);
    }
    const auth = state.entries["/api/account/state"];
    if (auth !== previous.entries["/api/account/state"]) {
      const parsed = centralAuthStateSchema.safeParse(auth?.data);
      if (parsed.success && JSON.stringify(parsed.data) !== applied.get("auth")) {
        applied.set("auth", JSON.stringify(parsed.data));
        // The wire schema already validates the hex color represented by the native template type.
        mock.emitAuthState(parsed.data as Parameters<typeof mock.emitAuthState>[0]);
      }
    }
  });
  const dispose = mock.dispose;
  mock.dispose = () => {
    unsubscribe();
    dispose();
  };
  const ensure = async () => {
    if (readEntry("/api/settings")?.data !== undefined) return;
    const [language, logoColor, appearance, interfaceSize] = await Promise.all(
      getters.map((get) => get()),
    );
    const initial = settingsSnapshotSchema.parse({
      language,
      logoColor,
      appearance,
      interfaceSize,
    });
    if (readEntry("/api/settings")?.data !== undefined) return;
    for (const [key, value] of Object.entries(initial)) applied.set(key, JSON.stringify(value));
    seedQuery("/api/settings", initial);
  };
  return Object.assign(ensure, { flush: () => synchronization });
}
