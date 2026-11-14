import assert from "node:assert/strict";
import type { AxiosResponse } from "axios";
import { DEFAULT_AGENT_DEFAULTS } from "../../src/contracts/ipc-agents";
import type { PreferencesData } from "../../src/contracts/preferences-data";
import type { johnBotDesktopApi } from "../../src/contracts/ipc";
import type { MockjohnBotControls } from "../../src/preview/mock-johnbot";
import { installPreferencesData } from "../../src/lib/api/bridges/preferences";
import { http } from "../../src/lib/api/client";
import { invalidateQueries } from "../../src/stores/data-store";

const remote: PreferencesData = {
  analytics: { enabled: true },
  busyMessageMode: { mode: "steer" },
  agentDefaults: { ...DEFAULT_AGENT_DEFAULTS, allowAutomation: true, allowNewChat: true },
  remoteSessionReuse: { keepBetweenRuns: false },
};
const counts = {
  get: 0,
  analytics: 0,
  busyMessageMode: 0,
  agentDefaults: 0,
  remoteSessionReuse: 0,
};
const local: PreferencesData = {
  analytics: { enabled: false },
  busyMessageMode: { mode: "queue" },
  agentDefaults: { ...DEFAULT_AGENT_DEFAULTS },
  remoteSessionReuse: { keepBetweenRuns: true },
};
let releaseStaleRead: (() => void) | undefined;
let staleReadStarted: (() => void) | undefined;
const staleReadReady = new Promise<void>((resolve) => {
  staleReadStarted = resolve;
});
let delayNextRead = false;

const previousAdapter = http.defaults.adapter;
http.defaults.adapter = async (config): Promise<AxiosResponse> => {
  if (config.method === "get") {
    counts.get++;
    const snapshot = structuredClone(remote);
    if (delayNextRead) {
      delayNextRead = false;
      staleReadStarted?.();
      await new Promise<void>((resolve) => {
        releaseStaleRead = resolve;
      });
    }
    return {
      data: { ok: true, data: snapshot },
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    };
  }
  if (config.method === "post") {
    const body =
      typeof config.data === "string"
        ? (JSON.parse(config.data) as { payload: Record<string, unknown> })
        : (config.data as { payload: Record<string, unknown> });
    const command = decodeURIComponent(config.url?.split("/").at(-1) ?? "");
    const field =
      command === "preferences.set-agent-defaults"
        ? "agentDefaults"
        : command === "preferences.set-analytics"
          ? "analytics"
          : command === "preferences.set-busy-message-mode"
            ? "busyMessageMode"
            : "remoteSessionReuse";
    remote[field] = body.payload as never;
    const result = { preferences: structuredClone(remote), value: structuredClone(remote[field]) };
    return { data: { ok: true, data: result }, status: 200, statusText: "OK", headers: {}, config };
  }
  throw new Error(`Unexpected preferences bridge request: ${config.method} ${config.url}`);
};

async function main() {
  const api = {
    getAnalyticsPreference: async () => local.analytics,
    setAnalyticsPreference: async (input: { enabled: boolean; chosen?: boolean }) => {
      counts.analytics++;
      local.analytics = { enabled: input.enabled };
      return local.analytics;
    },
    getBusyMessageModePreference: async () => local.busyMessageMode,
    setBusyMessageModePreference: async (input: PreferencesData["busyMessageMode"]) => {
      counts.busyMessageMode++;
      local.busyMessageMode = structuredClone(input);
      return local.busyMessageMode;
    },
    getAgentDefaults: async () => local.agentDefaults,
    setAgentDefaults: async (input: PreferencesData["agentDefaults"]) => {
      counts.agentDefaults++;
      local.agentDefaults = structuredClone(input);
      return local.agentDefaults;
    },
    getRemoteSessionReusePreference: async () => local.remoteSessionReuse,
    setRemoteSessionReusePreference: async (input: PreferencesData["remoteSessionReuse"]) => {
      counts.remoteSessionReuse++;
      local.remoteSessionReuse = structuredClone(input);
      return local.remoteSessionReuse;
    },
    agent: {
      getAgentHostSettings: async (_agentId: string) => ({
        computerUse: true,
        allowAutomation: local.agentDefaults.allowAutomation,
        busyMessageMode: null,
        defaultBusyMessageMode: local.busyMessageMode.mode,
      }),
      getAgentNewChat: async (_agentId: string) => ({
        allowNewChat: local.agentDefaults.allowNewChat,
      }),
    },
  } satisfies Pick<
    johnBotDesktopApi,
    | "getAnalyticsPreference"
    | "setAnalyticsPreference"
    | "getBusyMessageModePreference"
    | "setBusyMessageModePreference"
    | "getAgentDefaults"
    | "setAgentDefaults"
    | "getRemoteSessionReusePreference"
    | "setRemoteSessionReusePreference"
  > & {
    agent: Pick<johnBotDesktopApi["agent"], "getAgentHostSettings" | "getAgentNewChat">;
  };
  const mock = { api } as unknown as MockjohnBotControls;
  installPreferencesData(mock);

  try {
    const initial = await Promise.all([
      mock.api.getAnalyticsPreference(),
      mock.api.getBusyMessageModePreference(),
      mock.api.getAgentDefaults(),
      mock.api.getRemoteSessionReusePreference(),
    ]);
    assert.deepEqual(initial, [
      remote.analytics,
      remote.busyMessageMode,
      remote.agentDefaults,
      remote.remoteSessionReuse,
    ]);
    assert.equal(counts.get, 1, "simultaneous startup getters share one bootstrap request");
    assert.deepEqual(counts, {
      get: 1,
      analytics: 1,
      busyMessageMode: 1,
      agentDefaults: 1,
      remoteSessionReuse: 1,
    });
    const hostSettings = await api.agent.getAgentHostSettings("chief");
    assert.equal(hostSettings.defaultBusyMessageMode, "steer");
    assert.equal(hostSettings.allowAutomation, true);
    assert.equal((await api.agent.getAgentNewChat("chief")).allowNewChat, true);

    await mock.api.getAgentDefaults();
    assert.equal(
      counts.agentDefaults,
      1,
      "unchanged remote defaults do not emit another local update",
    );

    delayNextRead = true;
    invalidateQueries("/api/preferences");
    const staleRead = mock.api.getBusyMessageModePreference();
    await staleReadReady;
    const changedDefaults = { ...remote.agentDefaults, allowAutomation: false };
    remote.agentDefaults = changedDefaults;
    await mock.api.setAgentDefaults(changedDefaults);
    releaseStaleRead?.();
    await staleRead;
    assert.equal((await api.agent.getAgentHostSettings("chief")).allowAutomation, false);
    assert.equal(
      counts.agentDefaults,
      2,
      "stale read cannot overwrite a completed local preference mutation",
    );

    remote.busyMessageMode = { mode: "queue" };
    invalidateQueries("/api/preferences");
    await mock.api.getBusyMessageModePreference();
    assert.equal((await api.agent.getAgentHostSettings("chief")).defaultBusyMessageMode, "queue");
    assert.equal(counts.busyMessageMode, 2, "later remote change updates the local runtime");
    await mock.api.getBusyMessageModePreference();
    assert.equal(
      counts.busyMessageMode,
      2,
      "repeated remote reads do not emit duplicate local updates",
    );
    console.log("preferences bridge startup and refresh coherence passed");
  } finally {
    http.defaults.adapter = previousAdapter;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
