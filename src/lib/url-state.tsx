"use client";

import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from "react";
import { createParser, parseAsArrayOf, parseAsBoolean, parseAsString, parseAsStringLiteral, useQueryStates, type inferParserType } from "nuqs";
import { NuqsAdapter as ReactNuqsAdapter } from "nuqs/adapters/react";
import { createSignal, IS_ACCESSOR, type Accessor, type Setter } from "./solid-react-compat";
import { urlStateCleanup } from "./url-state-policy";

const identifier = createParser({
  parse: (value) => /^[\w:./-]{1,200}$/u.test(value) ? value : null,
  serialize: String,
});
const calendarDate = createParser({
  parse(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return null;
    const date = new Date(`${value}T12:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
  },
  serialize: String,
});

export const urlParsers = {
  page: parseAsStringLiteral(["agents", "dashboard", "notebooks", "connections", "access", "routines", "schedule", "workflows", "twin", "usage", "marketplace", "settings", "server-settings"]).withDefault("agents"),
  settingsTab: parseAsStringLiteral(["general", "agents", "notifications", "voice", "dynamic-island", "computer-use", "profile", "billing", "mobile-connect", "updates", "hosted-servers"]).withDefault("general"),
  serverTab: parseAsStringLiteral(["general", "vault", "members", "roles", "desktop", "mcp", "storage", "sites", "providers", "updates", "import", "transfer", "routines", "browser-profiles"]).withDefault("general"),
  settingsServer: identifier,
  server: identifier,
  agent: identifier,
  person: identifier,
  channel: identifier,
  thread: identifier,
  usageAgent: identifier,
  usageBreakdown: parseAsStringLiteral(["agent", "model", "day"]).withDefault("agent"),
  sidebar: parseAsStringLiteral(["agents", "routines"]).withDefault("agents"),
  sidebarCollapsed: parseAsBoolean,
  serverView: parseAsStringLiteral(["menu", "rail"]),
  panel: parseAsStringLiteral(["none", "side-panel", "settings", "files", "browser", "browser-expanded", "browser-pip", "question", "subagent", "file-preview"]).withDefault("none"),
  panelTab: parseAsStringLiteral(["settings", "files", "browser", "question", "subagent"]),
  panelPanes: parseAsArrayOf(parseAsStringLiteral(["settings", "files", "browser", "question", "subagent"])).withDefault([]),
  panelMax: parseAsBoolean.withDefault(false),
  chatSearch: parseAsBoolean.withDefault(false),
  chatQ: parseAsString.withDefault(""),
  threadSearch: parseAsBoolean.withDefault(false),
  threadQ: parseAsString.withDefault(""),
  globalSearch: parseAsBoolean.withDefault(false),
  globalQ: parseAsString.withDefault(""),
  globalTab: parseAsStringLiteral(["all", "messages", "agents", "channels", "files", "routines"]).withDefault("all"),
  calendarDate,
  calendarView: parseAsStringLiteral(["month", "week", "day"]),
  menu: identifier,
  submenu: identifier,
  select: identifier,
  dialog: identifier,
  workflow: identifier,
  dashboard: identifier,
  dashboardChat: parseAsBoolean.withDefault(false),
  notebook: identifier,
  mpTab: parseAsStringLiteral(["apps", "agents", "skills"]).withDefault("apps"),
  mpInstalled: parseAsBoolean.withDefault(false),
  mpQ: parseAsString.withDefault(""),
  mpSort: parseAsStringLiteral(["installs", "updated", "name"]).withDefault("installs"),
  mpAgentSource: parseAsStringLiteral(["verified", "public"]),
  mpSkillSource: parseAsStringLiteral(["verified", "public"]),
  mpView: parseAsStringLiteral(["browse", "app", "agent", "skill", "appGroup", "agentGroup", "skillGroup", "localSkill"]).withDefault("browse"),
  mpItem: parseAsString.withDefault(""),
  usageRange: parseAsStringLiteral(["7d", "30d", "90d", "1y"]).withDefault("30d"),
  usageMetric: parseAsStringLiteral(["cost", "tokens"]).withDefault("cost"),
};

export type UrlState = inferParserType<typeof urlParsers>;
type UrlPatch = { [K in keyof UrlState]?: UrlState[K] | null };
type UrlContextValue = {
  get: <K extends keyof UrlState>(key: K) => UrlState[K];
  set: (patch: UrlPatch, options?: { history?: "push" | "replace"; canonical?: boolean }) => void;
};
const UrlContext = createContext<UrlContextValue | null>(null);
const pushedKeys = new Set<keyof UrlState>(["page", "settingsTab", "serverTab", "server", "agent", "person", "channel", "thread", "calendarDate", "calendarView", "usageBreakdown"]);

/** Story previews and the standalone renderer share the same state contract as the Next entry. */
export function UrlStateBoundary({ children }: { children: ReactNode }) {
  const context = useContext(UrlContext);
  return context ? children : <ReactNuqsAdapter><UrlStateProvider>{children}</UrlStateProvider></ReactNuqsAdapter>;
}

/** One synchronous snapshot lets existing domain commands batch their URL writes without stale reads. */
export function UrlStateProvider({ children }: { children: ReactNode }) {
  const [state, setQuery] = useQueryStates(urlParsers, { shallow: true, scroll: false, history: "replace" });
  const current = useRef(state);
  current.current = state;
  const get = useCallback(<K extends keyof UrlState>(key: K) => current.current[key], []);
  const set = useCallback((patch: UrlPatch, options?: { history?: "push" | "replace"; canonical?: boolean }) => {
    const changed = Object.keys(patch).filter((key) => !Object.is(current.current[key as keyof UrlState], patch[key as keyof UrlState])) as (keyof UrlState)[];
    if (!changed.length) return;
    const navigation = options?.canonical ? changed.filter((key) => key !== "agent" && key !== "thread") : changed;
    const next = { ...patch, ...urlStateCleanup({ ...current.current, ...patch }, navigation) };
    const normalized = Object.fromEntries(Object.entries(next).map(([key, value]) => {
      const parser = urlParsers[key as keyof UrlState];
      return [key, value ?? ("defaultValue" in parser ? parser.defaultValue : null)];
    }));
    const effectiveChange = Object.entries(normalized).some(([key, value]) => JSON.stringify(current.current[key as keyof UrlState]) !== JSON.stringify(value));
    const search = new URLSearchParams(window.location.search);
    if (!effectiveChange && !Object.entries(next).some(([key, value]) => value === null && search.has(key))) return;
    current.current = { ...current.current, ...normalized } as UrlState;
    void setQuery(next, { history: options?.history ?? (changed.some((key) => pushedKeys.has(key)) ? "push" : "replace") });
  }, [setQuery]);
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    // Parse this exact address: another hook's optimistic state can precede a Back/Forward update.
    const decoded = Object.fromEntries(Object.entries(urlParsers).map(([key, parser]) => {
      const raw = search.get(key);
      return [key, (raw === null ? null : parser.parse(raw)) ?? ("defaultValue" in parser ? parser.defaultValue : null)];
    }));
    const cleanup = urlStateCleanup(decoded);
    for (const key of Object.keys(urlParsers) as (keyof UrlState)[]) {
      const parser = urlParsers[key];
      if (search.has(key) && "defaultValue" in parser && JSON.stringify(decoded[key]) === JSON.stringify(parser.defaultValue)) cleanup[key] = null;
    }
    const patch = Object.fromEntries(Object.entries(cleanup).filter(([key]) => search.has(key)));
    if (Object.keys(patch).length) void setQuery(patch, { history: "replace" });
  }, [state, setQuery]);
  return <UrlContext value={{ get, set }}>{children}</UrlContext>;
}

export function useUrlActions() {
  const context = useContext(UrlContext);
  return context?.set;
}

/** Keep the accessor/setter API of the migrated domains; isolated previews retain their local state. */
export function useUrlSignal<K extends keyof UrlState>(key: K, fallback?: UrlState[K]): [Accessor<UrlState[K]>, Setter<UrlState[K]>] {
  const context = useContext(UrlContext);
  const parser = urlParsers[key];
  const initial = fallback ?? ("defaultValue" in parser ? parser.defaultValue : null);
  const [local, setLocal] = createSignal(initial);
  const get = useCallback(() => (context ? context.get(key) ?? fallback ?? null : local()) as UrlState[K], [context, key, fallback, local]);
  (get as any)[IS_ACCESSOR] = true;
  const set = useCallback((value: UrlState[K] | ((previous: UrlState[K]) => UrlState[K])) => {
    const next = typeof value === "function" ? value(get()) : value;
    if (context) context.set({ [key]: next });
    else setLocal(next as any);
  }, [context, key, get, setLocal]);
  return [get, set];
}

export function useUrlOpen(key: "menu" | "submenu" | "select" | "dialog", id: string): [Accessor<boolean>, Setter<boolean>] {
  const [value, setValue] = useUrlSignal(key);
  const get = () => value() === id;
  (get as any)[IS_ACCESSOR] = true;
  return [get, (next) => {
    const open = typeof next === "function" ? next(get()) : next;
    if (open) setValue(id);
    else if (get()) setValue(null);
  }];
}

/** Page flags share one enum, so opening a surface cannot leave another page active. */
export function useUrlPageOpen(page: UrlState["page"]): [Accessor<boolean>, Setter<boolean>] {
  const [value, setValue] = useUrlSignal("page");
  const get = () => value() === page;
  (get as any)[IS_ACCESSOR] = true;
  return [get, (next) => {
    const open = typeof next === "function" ? next(get()) : next;
    if (open) setValue(page);
    else if (get()) setValue("agents");
  }];
}
