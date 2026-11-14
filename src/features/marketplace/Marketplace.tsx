import { cn } from "../../components/utils";
import { Button, ChevronRight, ErrorReference, IconButton, X } from "@johnbot/ui";
import { createScrollFades } from "@johnbot/ui/createScrollFades";
import { useText } from "@johnbot/ui/text";
import { useEffect, useEffectEvent, useRef } from "react";
import { createEffect, For, Match, Show, Switch } from "solid-js";
import { MarketplaceAgentPage } from "./MarketplaceAgentPage";
import { MarketplaceAppPage } from "./MarketplaceAppPage";
import { createBrowseLists, MarketplaceBrowse } from "./MarketplaceBrowse";
import { MarketplaceNav } from "./MarketplaceNav";
import { MarketplaceSkillPage } from "./MarketplaceSkillPage";
import { createMarketplaceListing } from "./marketplace-listing";
import type { MarketplaceModel } from "./marketplace-model";
import { useWorkspaceMarketplaceModel } from "./use-workspace-marketplace";
import {
  MARKETPLACE_TAB_LABEL,
  type MarketplaceNavigation,
  type MarketplaceScope,
  type MarketplaceView,
} from "./marketplace-view";

export interface MarketplaceProps {
  model: MarketplaceModel;
  /** Where the user is. The caller owns it, so a link can open the window on an app page. */
  nav: MarketplaceNavigation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function viewTitle(scope: MarketplaceScope, view: MarketplaceView, fallback: string): string {
  switch (view.kind) {
    case "browse":
      return fallback;
    case "agent":
    case "skill":
      return view.listing.name;
    case "app":
      return scope.model.apps().find((app) => app.id === view.id)?.name ?? fallback;
  }
}

/**
 * The path to the open page: Apps › GitHub. Each part of the path goes back to its view. The top row already has the
 * Back and Forward arrows of the chats, so the path is the way back here. A list has no path: the side panel names it.
 */
function MarketplaceHeader(props: { scope: MarketplaceScope }) {
  const { t } = useText();
  const stack = () => props.scope.nav.state.stack;
  const title = (view: MarketplaceView) =>
    viewTitle(props.scope, view, t(MARKETPLACE_TAB_LABEL[props.scope.nav.state.tab]));
  return (
    <nav className="marketplace-heading" aria-label={t("marketplace.crumbs.label")} hidden={stack().length < 2}>
      <For each={stack().slice(0, -1)}>
        {(view, index) => (
          <>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="marketplace-crumb-parent"
              data-cuelume-tap="navigate"
              onClick={() => props.scope.nav.backTo(index())}
            >
              {title(view)}
            </Button>
            <ChevronRight className="marketplace-crumb-separator" aria-hidden="true" />
          </>
        )}
      </For>
      <Show when={stack().length > 1}>
        <h2 className="marketplace-title" tabIndex={-1}>
          {title(stack().at(-1) ?? { kind: "browse" })}
        </h2>
      </Show>
    </nav>
  );
}

/**
 * The inside of the open window. The listings live here, so the catalog loads only while the window
 * is open.
 */
function MarketplaceWindow(props: MarketplaceProps) {
  const { t } = useText();
  const model = useWorkspaceMarketplaceModel(props.model);
  const nav = props.nav;
  const scope: MarketplaceScope = {
    get model() {
      return model;
    },
    nav,
    agents: createMarketplaceListing({
      list: (query) => props.model.listAgents(query),
      homeCache: props.model.agentHomeCache,
      query: () => nav.state.query,
      category: () => nav.state.agentCategory,
      verified: () => nav.state.agentSource === null ? undefined : nav.state.agentSource === 'verified',
    }),
    skills: createMarketplaceListing({
      list: (query) => props.model.listSkills(query),
      homeCache: props.model.skillHomeCache,
      query: () => nav.state.query,
      category: () => nav.state.skillCategory,
      sort: () => nav.state.skillSort,
      verified: () => nav.state.skillSource === null ? undefined : nav.state.skillSource === 'verified',
    }),
  };
  const lists = createBrowseLists(scope);
  const bodyRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  // A tab, a search or a new view changes the content height but not the body size, so the frame
  // is observed too.
  const fades = createScrollFades();
  // For each open view: its scroll offset, and the name of the control the user last clicked, which
  // opened the next view. Back returns to that place and that control.
  const places = useRef<{ top: number; opener: string | null }[]>([]).current;
  const remember = (place: Partial<(typeof places)[number]>) => {
    const depth = nav.state.stack.length - 1;
    places[depth] = { top: 0, opener: null, ...places[depth], ...place };
  };
  const rememberScroll = useEffectEvent((top: number) => remember({ top }));
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    fades.bind(body);
    fades.watch(frameRef.current);
    const onScroll = () => {
      fades.measure();
      rememberScroll(body.scrollTop);
    };
    body.addEventListener("scroll", onScroll);
    return () => {
      body.removeEventListener("scroll", onScroll);
      fades.stop();
    };
  }, []);
  // A new view moves the focus to its name, as a route change does. The first view keeps the focus.
  // The side panel can replace the open view with another at the same depth, which is a new view too.
  createEffect(
    () => [nav.state.stack.length, nav.state.stack.at(-1)] as const,
    ([length, view], previous) => {
      if (previous === undefined) return;
      const [previousLength, previousView] = previous;
      if (length === previousLength && view === previousView) return;
      const place = length < previousLength ? places[length - 1] : undefined;
      // Back keeps the place it returns to. Another view at a depth starts with no place there.
      places.length = length < previousLength ? length : length - 1;
      const body = bodyRef.current;
      body?.scrollTo({ top: place?.top ?? 0 });
      // A click in the side panel keeps the focus on the panel.
      if (document.activeElement?.closest(".marketplace-nav")) return;
      const opener = place?.opener
        ? body?.querySelector<HTMLElement>(`[aria-label="${CSS.escape(place.opener)}"]`)
        : null;
      const heading = length > 1 ? body?.querySelector<HTMLElement>(".marketplace-view h3") : null;
      if (heading && !heading.hasAttribute("tabindex")) heading.tabIndex = -1;
      (opener ?? heading ?? document.querySelector<HTMLElement>(".skills-marketplace .marketplace-nav-title"))?.focus({
        preventScroll: true,
      });
    },
  );
  // Another kind is a new list, so it starts at the top.
  createEffect(
    () => nav.state.tab,
    (_tab, previous) => {
      if (previous !== undefined) bodyRef.current?.scrollTo({ top: 0 });
    },
  );

  return (
    <>
      {/* The page rail is the way back from the page, so the top bar has no close button. */}
      <header className="skills-marketplace-topbar">
        <MarketplaceHeader scope={scope} />
      </header>
      <MarketplaceNav scope={scope} lists={lists} />
      <div
        className={cn("skills-marketplace-body", fades.classes())}
        ref={bodyRef}
        onClickCapture={(event) => {
          const control = event.target instanceof Element ? event.target.closest("[aria-label]") : null;
          remember({ opener: control && event.currentTarget.contains(control) ? control.getAttribute("aria-label") : null });
        }}
      >
        <div className="marketplace-frame" ref={frameRef}>
          <Show when={nav.state.stack.at(-1)} keyed>
            {(view) => (
              <Switch>
                <Match when={view.kind === "browse"}>
                  <MarketplaceBrowse scope={scope} lists={lists} />
                </Match>
                <Match when={view.kind === "agent" && view.listing} keyed>
                  {(listing) => <MarketplaceAgentPage scope={scope} listing={listing} />}
                </Match>
                <Match when={view.kind === "skill" && view.listing} keyed>
                  {(listing) => <MarketplaceSkillPage scope={scope} listing={listing} />}
                </Match>
                <Match when={view.kind === "app" && view.id} keyed>
                  {(id) => <MarketplaceAppPage scope={scope} id={id} />}
                </Match>
              </Switch>
            )}
          </Show>
        </div>
        <Show when={props.model.error()}>
          {(message) => (
            <div className="skills-marketplace-error">
              <span>
                {message()}
                <ErrorReference reference={props.model.errorReference?.()} />
              </span>
              <IconButton label={t("common.close")} variant="ghost" size="icon-sm" onClick={props.model.clearError}>
                <X />
              </IconButton>
            </div>
          )}
        </Show>
      </div>
      {/*
        The skill install menu stays open while installs run, and an open menu hides the rest of the
        window from screen readers. It keeps an element with `data-live-announcer` visible, so the
        results are said from here.
      */}
      <p className="marketplace-visually-hidden" role="status" data-live-announcer="">
        {props.model.notice()}
      </p>
      <p className="marketplace-visually-hidden" role="alert" data-live-announcer="">
        {props.model.error()}
      </p>
    </>
  );
}

/** The Marketplace: agents, apps and skills, and a page for each. It is a page of the window. */
export function Marketplace(props: MarketplaceProps) {
  // A closed window starts again from the first tab, with no search and no filter.
  createEffect(
    () => props.open,
    (open, previous) => {
      if (previous && !open) props.nav.reset();
    },
  );
  return (
    <Show when={props.open}>
      <MarketplacePage {...props} />
    </Show>
  );
}

/**
 * The open Marketplace page. The title takes the focus, as a new page does, and the control that
 * opened the page gets it back when the page closes with the focus in it. Escape goes back one view,
 * or else clears the search, or else closes the page. A view keeps the search but does not show it,
 * so the view goes back first. The handler is on the document and after the delegated handlers, so a
 * control that handles Escape keeps it. The focus can stay on the control that opened the page, so a
 * target outside the page also counts, except an open popup or a text field.
 */
function MarketplacePage(props: MarketplaceProps) {
  const { t } = useText();
  const rootRef = useRef<HTMLElement>(null);
  const closeOnEscape = useEffectEvent((event: KeyboardEvent) => {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("[role=dialog], [role=alertdialog], [role=menu], [role=listbox]")) return;
    if (target && !rootRef.current?.contains(target) && target.closest("input, textarea, select, [contenteditable]")) return;
    event.preventDefault();
    const nav = props.nav;
    if (nav.state.stack.length > 1) nav.back();
    else if (nav.state.query)
      nav.set((draft) => {
        draft.query = "";
      });
    else props.onOpenChange(false);
  });
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    root.querySelector<HTMLElement>(".marketplace-nav-title")?.focus({ preventScroll: true });
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      // A rail button that closed the page keeps the focus.
      const focus = document.activeElement;
      if (focus && focus !== document.body && !root.contains(focus)) return;
      // After the page leaves the DOM, unless the next page took the focus.
      queueMicrotask(() => {
        if (opener?.isConnected && (!document.activeElement || document.activeElement === document.body)) {
          opener.focus({ preventScroll: true });
        }
      });
    };
  }, []);
  return (
    <section ref={rootRef} className="skills-marketplace skills-marketplace-page" aria-label={t("marketplace.title")}>
      <MarketplaceWindow {...props} />
    </section>
  );
}
