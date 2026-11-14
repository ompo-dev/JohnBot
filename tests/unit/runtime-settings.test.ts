import assert from "node:assert/strict";
import { bindRuntimeSettings } from "../../src/lib/api/bridges/runtime-settings";
import { http, runCommand } from "../../src/lib/api/client";
import { resetDataStore } from "../../src/stores/data-store";
import { settingsSnapshotSchema } from "../../src/contracts/data-api";
import { seedSnapshot } from "../../src/server/repositories/session-store";
import type { MockjohnBotControls } from "../../src/preview/mock-johnbot";
const local = structuredClone(seedSnapshot().settings);
const original = http.defaults.adapter;
const mock = {
  api: {
    getAppLanguagePreference: async () => local.language,
    getAppLogoColorPreference: async () => local.logoColor,
    getAppAppearancePreference: async () => local.appearance,
    getAppInterfaceSizePreference: async () => local.interfaceSize,
    setAppLanguagePreference: async (input: typeof local.language) => {
      local.language = input;
      return input;
    },
    setAppLogoColorPreference: async (input: typeof local.logoColor) => {
      local.logoColor = input;
      return input;
    },
    setAppAppearancePreference: async (input: typeof local.appearance) => {
      local.appearance = input;
      return input;
    },
    setAppInterfaceSizePreference: async (input: typeof local.interfaceSize) => {
      local.interfaceSize = input;
      return input;
    },
  },
  emitAuthState: () => undefined,
  dispose: () => undefined,
} as unknown as MockjohnBotControls;
resetDataStore();
const ensure = bindRuntimeSettings(mock);
try {
  await ensure();
  const before = structuredClone(local.language);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  http.defaults.adapter = async () => {
    await gate;
    throw new Error("offline");
  };
  const pending = runCommand("settings.set-language", { language: "pt" }, settingsSnapshotSchema);
  await ensure.flush();
  assert.equal(
    local.language.language,
    "pt",
    "runtime subscribers see the optimistic setting before HTTP completes",
  );
  release();
  await assert.rejects(pending);
  await ensure.flush();
  assert.deepEqual(
    local.language,
    before,
    "rollback also reaches existing components through native events",
  );
  console.log("PASS: original runtime receives optimistic settings and rollback from Zustand");
} finally {
  mock.dispose();
  http.defaults.adapter = original;
  resetDataStore();
}
