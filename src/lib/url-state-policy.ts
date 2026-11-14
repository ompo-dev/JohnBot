import { productFeatures } from "./product-features";

/** Query keys describe the visible surface, rather than a history of previously visited screens. */
const pageKeys = {
  agents: ["agent", "person", "channel", "thread", "sidebar", "workflow", "panel", "panelTab", "panelPanes", "panelMax", "chatSearch", "chatQ", "threadSearch", "threadQ"],
  marketplace: ["mpTab", "mpQ", "mpSort", "mpAgentSource", "mpSkillSource", "mpView", "mpItem", "mpInstalled"],
  settings: ["settingsTab"],
  "server-settings": ["settingsServer", "serverTab"],
  workflows: ["workflow"],
  routines: ["workflow", "agent", "sidebar", "thread"],
  dashboard: ["dashboard", "dashboardChat"],
  notebooks: ["notebook"],
  connections: [],
  access: [],
  usage: ["usageRange", "usageMetric", "usageAgent", "usageBreakdown"],
  schedule: ["calendarDate", "calendarView"],
  twin: [],
} as const;

export const scopedUrlKeys = Object.values(pageKeys).flat();

export function urlStateCleanup(state: Record<string, unknown>, changed: readonly string[] = []): Record<string, null> {
  const page = typeof state.page === "string" && Object.hasOwn(pageKeys, state.page) ? state.page as keyof typeof pageKeys : "agents";
  const allowed = new Set<string>(pageKeys[page]);
  const clear: Record<string, null> = {};
  const remove = (...keys: readonly string[]) => { for (const key of keys) clear[key] = null; };
  for (const key of scopedUrlKeys) if (!allowed.has(key)) remove(key);
  if (page === "agents" && state.sidebar !== "routines") remove("workflow");
  if (changed.includes("page")) remove("menu", "submenu", "select", "dialog", "globalSearch", "globalQ", "globalTab");
  if ((changed.includes("agent") && state.agent !== null) || changed.includes("person") || changed.includes("channel") || changed.includes("server")) {
    remove("panel", "panelTab", "panelPanes", "panelMax", "chatSearch", "chatQ", "threadSearch", "threadQ");
    if (!changed.includes("thread")) remove("thread");
  }
  if (changed.includes("thread")) remove("chatSearch", "chatQ", "threadSearch", "threadQ");
  if (state.panel === "none" || !state.panel || "panel" in clear) remove("panelTab", "panelPanes", "panelMax");
  if (!state.chatSearch || "chatSearch" in clear) remove("chatQ");
  if (!state.threadSearch || "threadSearch" in clear) remove("threadQ");
  if (!state.globalSearch) remove("globalQ", "globalTab");
  if (changed.includes("menu")) remove("submenu", "select");
  if (changed.includes("select")) remove("menu", "submenu");
  if (!state.menu || "menu" in clear) remove("submenu");
  if (!productFeatures.serverManagement) {
    remove("server", "settingsServer", "serverTab", "serverView");
    if (state.page === "server-settings") remove("page");
    if (state.menu === "server-menu" || state.submenu === "server-layout") remove("menu", "submenu");
    if (state.dialog === "add-server" || state.dialog === "join-server") remove("dialog");
  }
  return clear;
}
