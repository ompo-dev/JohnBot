import {
  type MarketplaceAgentDetail,
  type MarketplaceAgentSummary,
  type MarketplaceSkillSort,
  type MarketplaceSkillSummary,
  type McpServerConfig,
  SKILL_CATEGORIES,
  type SkillCategory,
} from "@johnbot/contracts/ipc";
import type { MarketplaceListingKind, MarketplaceListingLink } from "@johnbot/contracts/marketplace-links";
import { errorReference } from "@johnbot/user-errors";
import { useRef } from "react";
import { createEffect, createStore, onCleanup, onSettled, untrack } from "solid-js";
import type { MarketplaceListing } from "./marketplace-listing";
import type { MarketplaceApp, MarketplaceModel } from "./marketplace-model";
import {
  marketplaceListingFromQuery,
  marketplaceQueryView,
  marketplaceViewFromQuery,
  marketplaceViewKey,
  useMarketplaceQuery,
} from "./marketplace-query";

export type MarketplaceView =
  | { kind: "browse" }
  /**
   * `detail`: the listing a Marketplace link loaded. The page shows it and does not read the catalog
   * again, because the catalog has no agent that waits for its first review.
   */
  | { kind: "agent"; listing: MarketplaceAgentSummary; detail?: MarketplaceAgentDetail | undefined }
  /** The catalog agents of one category, on their own page. */
  | { kind: "agentGroup"; category: SkillCategory }
  | { kind: "skill"; listing: MarketplaceSkillSummary }
  | { kind: "app"; id: string }
  /** The apps of one category, on their own page. */
  | { kind: "appGroup"; category: SkillCategory }
  /** "Your skills" or one catalog category, on its own page. */
  | { kind: "skillGroup"; group: SkillGroup }
  /** A skill made on this computer. It has no catalog listing. */
  | { kind: "localSkill"; skillId: string };

/** "Your skills", or a catalog category. */
export type SkillGroup = "yours" | SkillCategory;

/** Which catalog skills the Skills tab shows. No source shows all of them. */
export type SkillSource = "verified" | "public";

export type MarketplaceTab = "apps" | "agents" | "skills";

/** The kinds, in the order of the side panel. */
export const MARKETPLACE_TABS: readonly MarketplaceTab[] = ["apps", "agents", "skills"];

/** The name of each tab. The header names the browse view after its tab. */
export const MARKETPLACE_TAB_LABEL = {
  agents: "marketplace.tab.agents",
  apps: "marketplace.tab.apps",
  skills: "marketplace.tab.skills",
} as const satisfies Record<MarketplaceTab, string>;

export interface MarketplaceNavigationState {
  /** The views the user went through. The first is always the browse view. */
  stack: MarketplaceView[];
  tab: MarketplaceTab;
  query: string;
  /** Verified or Public on the Agents tab. No source shows all agents. */
  agentSource: SkillSource | null;
  /** The order of a skill group page. */
  skillSort: MarketplaceSkillSort;
  skillSource: SkillSource | null;
  /** The slug of a link that names no app of this catalog. */
  missingApp: string | null;
  /** A link named an agent or a skill that the Marketplace does not have. */
  missingListing: MarketplaceListingKind | null;
  /**
   * The category whose page the user opened last. Its title and first rows move between the Apps tab
   * and the category page (`moveView`).
   */
  appGroup: SkillCategory | null;
  /** The category of the open Agents category page. */
  agentCategory: SkillCategory | null;
  /** The catalog category of the open Skills group page; "Your skills" has none. */
  skillCategory: SkillCategory | null;
}

/** The listing a Messenger link names, as the Marketplace controller reads it. */
export type MarketplaceListingSource =
  | { kind: "agent"; detail: MarketplaceAgentDetail }
  | { kind: "skill"; skill: MarketplaceSkillSummary };

export type MarketplaceListingLoader = (
  link: MarketplaceListingLink,
) => Promise<MarketplaceListingSource | undefined>;

/** The `verified` value of a catalog query for a source. */
export function sourceVerified(source: SkillSource | null): boolean | undefined {
  if (source === null) return undefined;
  return source === "verified";
}

export interface MarketplaceNavigation {
  state: MarketplaceNavigationState;
  set: (change: (draft: MarketplaceNavigationState) => void) => void;
  go: (view: MarketplaceView) => void;
  back: () => void;
  /** Goes back to the view at `index` of the stack. */
  backTo: (index: number) => void;
  /** The list of a kind, or a page on top of it. The search stays. */
  show: (tab: MarketplaceTab, view?: MarketplaceView) => void;
  /** The browse view on its first tab, with no search and no filter. */
  reset: () => void;
}

type MarketplaceQueryState = ReturnType<typeof useMarketplaceQuery>[0];

function initialState(query?: MarketplaceQueryState): MarketplaceNavigationState {
  const restored: MarketplaceView = query ? marketplaceViewFromQuery(query.view, query.item) : { kind: "browse" };
  return {
    stack: restored.kind === "browse" ? [{ kind: "browse" }] : [{ kind: "browse" }, restored],
    tab: query?.tab ?? "apps",
    query: query?.query ?? "",
    agentSource: query?.agentSource ?? null,
    skillSort: query?.skillSort ?? "installs",
    skillSource: query?.skillSource ?? null,
    missingApp: null,
    missingListing: null,
    appGroup: restored.kind === "appGroup" ? restored.category : null,
    agentCategory: restored.kind === "agentGroup" ? restored.category : null,
    skillCategory: restored.kind === "skillGroup" && restored.group !== "yours" ? restored.group : null,
  };
}

/** What each part of the window reads: the data and actions, where the user is, and the two listings. */
export interface MarketplaceScope {
  model: MarketplaceModel;
  nav: MarketplaceNavigation;
  agents: MarketplaceListing<MarketplaceAgentSummary>;
  skills: MarketplaceListing<MarketplaceSkillSummary>;
}

export function createMarketplaceNavigation(loadListing?: MarketplaceListingLoader): MarketplaceNavigation {
  const [query, setQuery] = useMarketplaceQuery();
  const [memory, setMemory] = createStore<MarketplaceNavigationState>(initialState(query));
  const queryRef = useRef(query);
  queryRef.current = query;
  const memoryRef = useRef(memory);
  memoryRef.current = memory;
  // A write from here already changed the memory stack, so its query echo must not restore a view.
  const committed = useRef(
    query.view === "agent" || query.view === "skill" ? "" : marketplaceViewKey(query.view, query.item),
  );
  const restoreRequest = useRef(0);
  onCleanup(() => {
    restoreRequest.current += 1;
  });

  const commit = (change: (draft: MarketplaceNavigationState) => void, navigating = false) => {
    const current = queryRef.current;
    const draft: MarketplaceNavigationState = {
      ...memoryRef.current,
      tab: current.tab,
      query: current.query,
      agentSource: current.agentSource,
      skillSort: current.skillSort,
      skillSource: current.skillSource,
    };
    change(draft);
    const previousStack = memoryRef.current.stack;
    const stackChanged =
      draft.stack.length !== previousStack.length ||
      draft.stack.some((view, index) => view !== previousStack[index]);
    if (navigating || stackChanged) restoreRequest.current += 1;
    setMemory((state) => {
      state.stack = draft.stack;
      state.missingApp = draft.missingApp;
      state.missingListing = draft.missingListing;
      state.appGroup = draft.appGroup;
    });
    memoryRef.current = draft;
    // A search edit keeps the URL view even when a deferred restore has not reached the stack yet.
    const view = navigating || stackChanged
      ? marketplaceQueryView(draft.stack.at(-1))
      : { view: current.view, item: current.item };
    const next = {
      tab: draft.tab,
      query: draft.query,
      skillSort: draft.skillSort,
      agentSource: draft.agentSource,
      skillSource: draft.skillSource,
      view: view.view,
      item: view.item,
    };
    const locationChanged = current.tab !== next.tab || marketplaceViewKey(current.view, current.item) !== marketplaceViewKey(next.view, next.item);
    committed.current = marketplaceViewKey(next.view, next.item);
    queryRef.current = { ...current, ...next };
    // A view change is a history step, so browser back and forward and a reload find it again.
    void setQuery(() => next, { history: locationChanged && (navigating || stackChanged) ? "push" : "replace" });
  };

  // A browser back, a forward or a reload changes the URL outside `commit`.
  createEffect(
    () => marketplaceViewKey(query.view, query.item),
    (key) => {
      if (key === committed.current) return;
      committed.current = key;
      const request = ++restoreRequest.current;
      const link = marketplaceListingFromQuery(query.view, query.item);
      const first: MarketplaceView = memoryRef.current.stack[0] ?? { kind: "browse" };

      if (link) {
        const top = memoryRef.current.stack.at(-1);
        const shown =
          (link.kind === "agent" && top?.kind === "agent" && top.listing.id === link.id) ||
          (link.kind === "skill" && top?.kind === "skill" && top.listing.slug === link.id);
        if (shown) return;
        const apply = (listing: MarketplaceListingSource | undefined) => {
          if (request !== restoreRequest.current) return;
          const restored: MarketplaceView | null =
            listing?.kind === "agent"
              ? { kind: "agent", listing: listing.detail, detail: listing.detail }
              : listing?.kind === "skill"
                ? { kind: "skill", listing: listing.skill }
                : null;
          const tab: MarketplaceTab = link.kind === "agent" ? "agents" : "skills";
          const state: MarketplaceNavigationState = {
            ...memoryRef.current,
            stack: restored ? [first, restored] : [first],
            tab,
            missingApp: null,
            missingListing: restored ? null : link.kind,
            appGroup: null,
          };
          memoryRef.current = state;
          queryRef.current = { ...queryRef.current, tab };
          void setQuery(() => ({ tab }), { history: "replace" });
          setMemory((draft) => Object.assign(draft, state));
        };
        // The loader owns its error path, but a rejected answer still leaves the missing notice, not a rejection.
        void Promise.resolve()
          .then(() => loadListing?.(link))
          .then(apply, () => apply(undefined));
        return;
      }

      // A malformed agent or skill id is not fetched, and shows the same missing notice as an unknown one.
      const missingListing: MarketplaceListingKind | null =
        query.view === "agent" || query.view === "skill" ? query.view : null;
      const restored = marketplaceViewFromQuery(query.view, query.item);
      const stack = restored.kind === "browse" ? [first] : [first, restored];
      const tab: MarketplaceTab =
        missingListing === "agent" || restored.kind === "agentGroup"
          ? "agents"
          : missingListing === "skill" || restored.kind === "skillGroup" || restored.kind === "localSkill"
            ? "skills"
            : restored.kind === "app" || restored.kind === "appGroup"
              ? "apps"
              : queryRef.current.tab;
      const state: MarketplaceNavigationState = {
        ...memoryRef.current,
        stack,
        tab,
        missingApp: null,
        missingListing,
        appGroup: restored.kind === "appGroup" ? restored.category : null,
      };
      memoryRef.current = state;
      queryRef.current = { ...queryRef.current, tab };
      if (tab !== query.tab) void setQuery(() => ({ tab }), { history: "replace" });
      setMemory((draft) => Object.assign(draft, state));
    },
  );

  const state: MarketplaceNavigationState = {
    get stack() {
      return memory.stack;
    },
    get tab() {
      return query.tab;
    },
    get query() {
      return query.query;
    },
    get agentSource() {
      return query.agentSource;
    },
    get skillSort() {
      return query.skillSort;
    },
    get skillSource() {
      return query.skillSource;
    },
    get missingApp() {
      return memory.missingApp;
    },
    get missingListing() {
      return memory.missingListing;
    },
    get appGroup() {
      if (memory.appGroup !== null) return memory.appGroup;
      const top = memory.stack.at(-1);
      return top?.kind === "appGroup" ? top.category : null;
    },
    get agentCategory() {
      const top = memory.stack.at(-1);
      return top?.kind === "agentGroup" ? top.category : null;
    },
    get skillCategory() {
      const top = memory.stack.at(-1);
      return top?.kind === "skillGroup" && top.group !== "yours" ? top.group : null;
    },
  };

  return {
    state,
    set: commit,
    go: (view) =>
      commit((draft) => {
        draft.stack = [...draft.stack, view];
        draft.missingApp = null;
        draft.missingListing = null;
      }, true),
    back: () =>
      commit((draft) => {
        if (draft.stack.length > 1) draft.stack = draft.stack.slice(0, -1);
      }, true),
    backTo: (index) =>
      commit((draft) => {
        draft.stack = draft.stack.slice(0, Math.max(1, index + 1));
      }, true),
    show: (tab, view) =>
      commit((draft) => {
        draft.tab = tab;
        draft.missingApp = null;
        draft.missingListing = null;
        // The list stays the same element, so it keeps its place.
        if (view) draft.stack = [draft.stack[0] ?? { kind: "browse" }, view];
        else draft.stack = draft.stack.slice(0, 1);
      }, true),
    reset: () => {
      restoreRequest.current += 1;
      const next = initialState();
      memoryRef.current = next;
      setMemory((draft) => Object.assign(draft, next));
      const defaults = {
        tab: "apps",
        query: "",
        skillSort: "installs",
        agentSource: null,
        skillSource: null,
        view: "browse",
        item: "",
      } as const;
      committed.current = marketplaceViewKey(defaults.view, defaults.item);
      queryRef.current = { ...queryRef.current, ...defaults };
      void setQuery(defaults, { history: "replace" });
    },
  };
}

export function isMarketplaceTab(value: string): value is MarketplaceTab {
  return value === "apps" || value === "agents" || value === "skills";
}

/**
 * Where the server answers, with no secret: the command without its arguments, or the address
 * without its query. Arguments, headers, query and environment can hold keys.
 */
export function serverAddress(server: McpServerConfig): string {
  if (server.transport === "stdio") return server.command;
  try {
    const url = new URL(server.url);
    return `${url.origin}${url.pathname}`;
  } catch {
    return "";
  }
}

/** Whether an app matches the search. */
export function matchesApp(app: MarketplaceApp, query: string): boolean {
  const text = query.trim().toLowerCase();
  return !text || app.name.toLowerCase().includes(text) || app.tagline.toLowerCase().includes(text);
}

/** The apps of each category, in the catalog order. A server that the user added is in Other. */
export function appCategories(apps: readonly MarketplaceApp[]): { category: SkillCategory; apps: MarketplaceApp[] }[] {
  const categoryOf = (app: MarketplaceApp): SkillCategory => (app.kind === "custom" ? "other" : app.category);
  return SKILL_CATEGORIES.map((category) => ({
    category,
    apps: apps.filter((app) => categoryOf(app) === category),
  })).filter((group) => group.apps.length > 0);
}

/** The apps that the user connected, and the ones that need attention. */
export function ownedApps(apps: readonly MarketplaceApp[]): MarketplaceApp[] {
  return apps.filter((app) => app.status === "connected" || app.status === "attention");
}

/**
 * The full listing of a page. `load` reports its own failure and then gives undefined. A page that
 * closes before the answer drops it.
 */
export function createDetail<T>(load: () => Promise<T | undefined>) {
  const [state, setState] = createStore<{
    value: T | undefined;
    status: "loading" | "loaded" | "failed";
    reference: string | null;
  }>({
    value: undefined,
    status: "loading",
    reference: null,
  });
  let alive = true;
  onCleanup(() => {
    alive = false;
  });
  const run = () => {
    setState((draft) => {
      draft.status = "loading";
      draft.reference = null;
    });
    // A page belongs to one listing, so a later change of the props does not load again.
    void untrack(load).then(
      (value) => {
        if (!alive) return;
        setState((draft) => {
          draft.value = value;
          draft.status = value ? "loaded" : "failed";
        });
      },
      (error) => {
        if (alive)
          setState((draft) => {
            draft.status = "failed";
            draft.reference = errorReference(error);
          });
      },
    );
  };
  // `load` can write the owner's state, such as an error, and a component body refuses writes.
  onSettled(() => run());
  return { value: () => state.value, status: () => state.status, reference: () => state.reference, retry: run };
}
