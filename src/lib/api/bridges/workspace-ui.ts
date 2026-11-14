import type { MockjohnBotControls } from "../../../preview/mock-johnbot";
import { sidebarSchema, memoriesSchema } from "../../../contracts/workspace-ui";
import { applySidebarLayoutAction } from "../../../contracts/sidebar-layout-reducer";
import { dataStore, putQuery } from "../../../stores/data-store";
import { getData, runCommand } from "../client";
const sidebarPath = "/api/workspace?resource=sidebar";
const memoryPath = (agentId: string) => `/api/workspace?resource=memories&agentId=${encodeURIComponent(agentId)}`;
export function installWorkspaceUi(runtime: MockjohnBotControls) {
  const api = runtime.api.agent;
  const local = (serverId?: string) => { if (serverId && serverId !== "local") throw new Error("A remote backend is not connected."); };
  const unsubscribe = dataStore.subscribe((state, previous) => {
    for (const [key, entry] of Object.entries(state.entries)) {
      if (entry.data === previous.entries[key]?.data) continue;
      if (key === sidebarPath) {
        const parsed = sidebarSchema.safeParse(entry.data);
        if (parsed.success) {
          runtime.emitAgentEvent({ type: "sidebar-layout-changed", layout: parsed.data.layout });
          runtime.emitAgentEvent({ type: "sidebar-pins-changed", ...parsed.data.pins });
        }
      } else if (key.startsWith("/api/workspace?resource=memories")) {
        runtime.emitAgentEvent({ type: "memories-changed", agentId: new URL(key, "http://local").searchParams.get("agentId")! });
      }
    }
  });
  const dispose = runtime.dispose;
  runtime.dispose = () => { unsubscribe(); dispose(); };
  const sidebar = () => getData(sidebarPath, sidebarSchema);
  api.getSidebarLayout = async (serverId) => { local(serverId); return (await sidebar()).layout; };
  api.getSidebarPins = async (serverId) => { local(serverId); return (await sidebar()).pins; };
  const pins = async (input: Parameters<typeof api.setSidebarPins>[0], seed: boolean, serverId?: string) => {
    local(serverId);
    const previous = await sidebar();
    const value = (await runCommand("workspace.sidebar", { kind: seed ? "seed-pins" : "pins", expectedRevision: previous.layout.revision, pins: { items: input.items, updatedAt: null } }, sidebarSchema)).data;
    putQuery(sidebarPath, value);
    return value.pins;
  };
  api.setSidebarPins = (input, serverId) => pins(input, false, serverId);
  api.seedSidebarPins = (input, serverId) => pins(input, true, serverId);
  api.mutateSidebarLayout = async (action, serverId) => {
    local(serverId);
    const previous = await sidebar();
    const value = (await runCommand("workspace.sidebar", { kind: "layout", expectedRevision: previous.layout.revision, layout: applySidebarLayoutAction(previous.layout, action) }, sidebarSchema)).data;
    putQuery(sidebarPath, value);
    return value.layout;
  };
  api.listMemories = (agentId, serverId) => { local(serverId); return getData(memoryPath(agentId), memoriesSchema); };
  const change = async (agentId: string, action: string, input: Record<string, unknown>, serverId?: string) => {
    local(serverId);
    await getData(memoryPath(agentId), memoriesSchema);
    const value = (await runCommand("workspace.memory", { agentId, action, ...input }, memoriesSchema)).data;
    putQuery(memoryPath(agentId), value);
    return value;
  };
  api.createMemory = async (input, serverId) => {
    const memoryId = crypto.randomUUID();
    return (await change(input.agentId, "create", { memoryId, text: input.text }, serverId)).find((item) => item.id === memoryId)!;
  };
  api.updateMemory = async (input, serverId) => (await change(input.agentId, "update", { memoryId: input.memoryId, text: input.text }, serverId)).find((item) => item.id === input.memoryId)!;
  api.deleteMemory = async (input, serverId) => { await change(input.agentId, "delete", { memoryId: input.memoryId }, serverId); };
  api.clearMemories = async (agentId, serverId) => { await change(agentId, "clear", {}, serverId); };
}
