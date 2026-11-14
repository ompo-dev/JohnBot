import {
  accountSessionsResponseSchema,
  accountUsageSchema,
  appInfoSchema,
  centralAuthStateSchema,
  DATA_COMMANDS,
  settingsSnapshotSchema,
} from "../../../contracts/data-api";
import { bytesToBase64 } from "../../../team-client/base64";
import { createMockjohnBot, type MockjohnBotControls } from "../../../preview/mock-johnbot";
import { DEMO_OPTIONS } from "../../../preview/demo-seed";
import { getData, runCommand } from "../client";
import { installMarketplaceData } from "./marketplace";
import { installDatabaseAgentsData } from "./database-agents";
import { installWorkflowsData } from "./workflows";
import { installPreferencesData } from "./preferences";
import { bindRuntimeSettings } from "./runtime-settings";
import { installWorkspaceUi } from "./workspace-ui";
import { productFeatures } from "../../product-features";
import { installUnifiedRoutines } from "./routines";
import { installRoutineFlowsData } from "./routine-flows";

function settings() {
  return getData("/api/settings", settingsSnapshotSchema);
}

/**
 * Keeps the full mock surface and replaces only the allowlisted network-backed
 * methods. Local events still come from the mock: after a remote settings write
 * succeeds, the original setter runs so every subscriber in this window sees it.
 */
/** Reaproveita os seeds da demonstração sob outro agente: troca os ids no próprio JSON. */
function remapAgent<T>(value: T, from: string, to: string): T {
  if (value === undefined) return value;
  return JSON.parse(JSON.stringify(value).replaceAll(`"${from}"`, `"${to}"`)) as T;
}

/** Rotinas, tarefas e agenda da fábrica no mesmo conjunto que a conversa e a barra lateral usam. */
function factoryWork(seed: typeof DEMO_OPTIONS) {
  const factoryAgentIds = Object.entries(seed.routines ?? {})
    .filter(([, routines]) => routines.some((routine) => routine.id.startsWith("routine-factory-")))
    .map(([agentId]) => agentId);
  const routines: Record<string, unknown> = {};
  const routineRuns: Record<string, unknown> = {};
  const tasks: Record<string, unknown> = {};
  const taskConversations: Record<string, unknown> = {};
  const taskUnread: Record<string, unknown> = {};
  for (const agentId of factoryAgentIds) {
    if (seed.routines?.[agentId]) routines[agentId] = remapAgent(seed.routines[agentId], agentId, agentId);
    for (const [key, value] of Object.entries(seed.routineRuns ?? {})) {
      const run = value as Array<{ agentId?: string }>;
      if (run.some((entry) => entry?.agentId === agentId)) routineRuns[key] = remapAgent(value, agentId, agentId);
    }
    if (seed.tasks?.[agentId]) tasks[agentId] = remapAgent(seed.tasks[agentId], agentId, agentId);
    for (const [key, value] of Object.entries(seed.taskConversations ?? {})) {
      if (key.startsWith(agentId)) taskConversations[key] = remapAgent(value, agentId, agentId);
    }
    for (const [key, value] of Object.entries(seed.taskUnread ?? {})) {
      if (String(value).includes(agentId)) taskUnread[key] = remapAgent(value, agentId, agentId);
    }
  }
  return { routines, routineRuns, tasks, taskConversations, taskUnread };
}

export function createHybridjohnBot(): MockjohnBotControls {
  const work = factoryWork(DEMO_OPTIONS);
  const mock = createMockjohnBot({ agents: [], models: [], snapshots: {}, queues: {}, tasks: work.tasks,
    taskConversations: work.taskConversations, taskUnread: work.taskUnread, memories: {}, tables: [], routines: work.routines, routineRuns: work.routineRuns,
    routineFlowLinks: (DEMO_OPTIONS.routineFlowLinks ?? []).filter((link) => link.routineId.startsWith("routine-factory-")),
    routineFlowSteps: (DEMO_OPTIONS.routineFlowSteps ?? []).filter((step) => step.runId.startsWith("run-routine-factory-")),
    workflows: [], channels: [], storyForeignAgent: false,
    agentStatus: { phase: "idle", cliVersion: null, auth: { kind: "unknown" }, providers: [],
      capabilities: { chat: "unavailable", browser: "unavailable", computerUse: "unavailable" },
      message: "No execution provider connected.", fullAccess: true },
  });
  const api = mock.api;
  const ensureSettings = bindRuntimeSettings(mock);
  const changeSettings = async (command: string, input: unknown) => {
    await ensureSettings();
    try {
      const value = await runCommand(command, input, settingsSnapshotSchema);
      await ensureSettings.flush();
      return value.data;
    } catch (error) {
      await ensureSettings.flush().catch(() => undefined);
      throw error;
    }
  };

  api.getAppInfo = () => getData("/api/app-info", appInfoSchema);

  api.getAppLanguagePreference = () => settings().then((value) => value.language);
  api.setAppLanguagePreference = async (input) => {
    return (await changeSettings(DATA_COMMANDS.setLanguage, input)).language;
  };

  api.getAppLogoColorPreference = () => settings().then((value) => value.logoColor);
  api.setAppLogoColorPreference = async (input) => {
    return (await changeSettings(DATA_COMMANDS.setLogoColor, input)).logoColor;
  };

  api.getAppAppearancePreference = () => settings().then((value) => value.appearance);
  api.setAppAppearancePreference = async (input) => {
    return (await changeSettings(DATA_COMMANDS.setAppearance, input)).appearance;
  };

  api.getAppInterfaceSizePreference = () => settings().then((value) => value.interfaceSize);
  api.setAppInterfaceSizePreference = async (input) => {
    return (await changeSettings(DATA_COMMANDS.setInterfaceSize, input)).interfaceSize;
  };

  api.auth.getState = () => getData("/api/account/state", centralAuthStateSchema);
  api.auth.retry = () => getData("/api/account/state", centralAuthStateSchema);
  api.auth.requestEmailCode = async (email) => {
    const state = (
      await runCommand(DATA_COMMANDS.requestEmailCode, { email }, centralAuthStateSchema)
    ).data;
    mock.emitAuthState(state);
    return state;
  };
  api.auth.verifyEmailCode = async (input) => {
    const state = (await runCommand(DATA_COMMANDS.verifyEmailCode, input, centralAuthStateSchema))
      .data;
    mock.emitAuthState(state);
    return state;
  };
  api.auth.updateName = async (name) => {
    const state = (await runCommand(DATA_COMMANDS.updateName, { name }, centralAuthStateSchema))
      .data;
    mock.emitAuthState(state);
    return state;
  };
  api.auth.updateAvatar = async (image) => {
    const state = (
      await runCommand(
        DATA_COMMANDS.updateAvatar,
        {
          image: image
            ? { mimeType: image.mimeType, bytesBase64: bytesToBase64(image.bytes) }
            : null,
        },
        centralAuthStateSchema,
      )
    ).data;
    mock.emitAuthState(state);
    return state;
  };
  api.auth.logout = async () => {
    const state = (await runCommand(DATA_COMMANDS.logout, {}, centralAuthStateSchema)).data;
    mock.emitAuthState(state);
    return state;
  };
  api.auth.listAccountSessions = async () =>
    (await getData("/api/account/sessions", accountSessionsResponseSchema)).sessions;
  api.auth.revokeAccountSession = async (sessionId) => {
    await runCommand(DATA_COMMANDS.revokeSession, { sessionId }, accountSessionsResponseSchema);
  };

  api.agent.getUsage = (agentId) =>
    getData(
      agentId ? `/api/usage?agentId=${encodeURIComponent(agentId)}` : "/api/usage",
      accountUsageSchema,
    );

  installDatabaseAgentsData(mock);
  installWorkspaceUi(mock);
  installWorkflowsData(mock, { simulate: productFeatures.workflowSimulation });
  if (productFeatures.unifiedRoutines) { installUnifiedRoutines(mock); installRoutineFlowsData(mock); }
  installMarketplaceData(mock);
  installPreferencesData(mock);
  return mock;
}
