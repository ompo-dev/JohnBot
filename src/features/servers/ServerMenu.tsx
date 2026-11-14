import type { ServerSummary } from "@johnbot/contracts/ipc";
import type { AppTextKey } from "@johnbot/i18n";
import {
  AppWindow,
  BellOff,
  buttonVariants,
  Check,
  ChevronRight,
  ChevronsUpDown,
  ContextMenu,
  DropdownMenu,
  Moon,
  PanelLeft,
  Plus,
} from "@johnbot/ui";
import { SwapLabel } from "@johnbot/ui/SwapLabel";
import { createEffect, For, Show, untrack } from "solid-js";
import { useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useUrlOpen } from "../../lib/url-state";
import { productFeatures } from "../../lib/product-features";
import { useText } from "../../components/text";
import { type ServerActionCallbacks, ServerActionItems } from "./ServerActionItems";
import { ServerMark, ServerSleepDot, serverHostedSleep, serverStatusLabels } from "./ServerRail";

/** Where the desktop app lists servers: the rail beside the sidebar, or the menu on the server name. */
export type ServerView = "rail" | "menu";

const SERVER_VIEWS: readonly ServerView[] = ["rail", "menu"];

const SERVER_VIEW_LABELS = {
  rail: "server.menu.layoutRail",
  menu: "server.menu.layoutMenu",
} as const satisfies Record<ServerView, AppTextKey>;

// The rail is a strip at the left edge. The menu opens from the server name, as a switcher does.
const SERVER_VIEW_ICONS = { rail: PanelLeft, menu: ChevronsUpDown } as const satisfies Record<
  ServerView,
  typeof PanelLeft
>;

export interface ServerMenuProps extends ServerActionCallbacks {
  servers: ServerSummary[];
  serverName: string;
  view: ServerView;
  onViewChange: (view: ServerView) => void;
  onSelect: (serverId: string) => void;
  onAdd?: () => void;
  /** True when `onAdd` opens the hosted server plans, where the user can also join with an invite. */
  addCreatesServer?: boolean | undefined;
  /** The compact sidebar hides the server name. The rail stays visible then. */
  compact?: boolean;
}

function isContextMenuKey(event: KeyboardEvent): boolean {
  return event.key === "ContextMenu" || (event.shiftKey && event.key === "F10");
}

function CheckCircle(props: { checked: boolean }) {
  return (
    <span className="ui-menu-check" data-checked={props.checked ? "" : undefined} aria-hidden="true">
      <Show when={props.checked}>
        <Check />
      </Show>
    </span>
  );
}

// The app mounts a new sidebar title when the active server changes. The last shown server lets
// the new title animate from the old name and logo.
let lastShown: { id: string | undefined; name: string } | undefined;

/**
 * The server name on the sidebar title. Its menu sets the server view. In the menu view, it also
 * lists the servers and the actions of the active server. A click or Enter on a server
 * row selects that server. Hover or the arrow key on a row opens all actions of that server.
 */
export function ServerMenu(props: ServerMenuProps) {
  return productFeatures.serverManagement ? <EnabledServerMenu {...props} /> : (
    <span className="sidebar-server-name no-drag" title="JohnBot">
      <span className="sidebar-server-name-label">JohnBot</span>
    </span>
  );
}

function EnabledServerMenu(props: ServerMenuProps) {
  const { t } = useText();
  const [menuOpen, setMenuOpen] = useUrlOpen("menu", "server-menu");
  const [layoutOpen, setLayoutOpen] = useUrlOpen("submenu", "server-layout");
  // The context menu of the server name opens from this hidden anchor.
  const anchor = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const activeServer = () => props.servers.find((server) => server.active);
  const activeServers = () => props.servers.filter((server) => server.active);
  const activeSleep = () => {
    const server = activeServer();
    return server ? serverHostedSleep(server) : null;
  };
  /** The name, or why the server does not answer while it sleeps or wakes. */
  const triggerTitle = () => {
    const sleep = activeSleep();
    if (sleep === "sleeping") return t("server.sleep.tooltipSleeping", { name: props.serverName });
    if (sleep === "waking") return t("server.sleep.tooltipWaking", { name: props.serverName });
    return props.serverName;
  };
  const shownBefore = lastShown;
  let markId = shownBefore?.id;
  createEffect(
    () => ({ id: activeServer()?.id, name: props.serverName }),
    (shown) => {
      lastShown = shown;
    },
  );

  function openActions(clientX: number, clientY: number): void {
    anchor.current?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX, clientY }));
  }

  function selectServer(server: ServerSummary): void {
    setMenuOpen(false);
    if (!server.active) props.onSelect(server.id);
  }

  // A row is a submenu trigger. Handle these keys before Radix opens the submenu,
  // so Enter and Space select the server as a click does.
  function selectOnKey(event: ReactKeyboardEvent<HTMLElement>, server: () => ServerSummary): void {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    event.stopPropagation();
    selectServer(server());
  }

  return (
    <>
      <DropdownMenu.Root open={menuOpen()} onOpenChange={setMenuOpen} placement="bottom-start" gutter={6}>
        <DropdownMenu.Trigger
          ref={trigger}
          className={buttonVariants({
            variant: "ghost",
            size: "sm",
            class: "sidebar-server-name no-drag",
          })}
          aria-label={[
            t("server.menu.open", { name: props.serverName }),
            ...(activeSleep() === "sleeping" ? [t("server.state.sleeping")] : []),
            ...(activeSleep() === "waking" ? [t("server.state.waking")] : []),
          ].join(", ")}
          aria-hidden={props.compact ? "true" : undefined}
          aria-keyshortcuts="Shift+F10"
          tabIndex={props.compact ? -1 : 0}
          title={triggerTitle()}
          onContextMenu={(event) => {
            event.preventDefault();
            openActions(event.clientX, event.clientY);
          }}
          onKeyDown={(event) => {
            if (!isContextMenuKey(event)) return;
            event.preventDefault();
            const bounds = event.currentTarget.getBoundingClientRect();
            openActions(bounds.left, bounds.bottom);
          }}
        >
          {/* Keyed by server, so the logo of a newly selected server springs in. */}
          <For each={activeServers()} keyed={(server) => server.id}>
            {(server) => {
              const id = untrack(() => server().id);
              const entering = markId !== undefined && markId !== id;
              markId = id;
              return (
                <span
                  className="server-menu-mark sidebar-server-name-mark"
                  data-entering={entering ? "" : undefined}
                  aria-hidden="true"
                >
                  <ServerMark server={server()} />
                </span>
              );
            }}
          </For>
          <SwapLabel className="sidebar-server-name-label" text={props.serverName} from={shownBefore?.name} />
          <Show when={activeSleep()}>
            {(sleep) => <Moon className="sidebar-server-name-sleep" data-state={sleep()} aria-hidden="true" />}
          </Show>
          <ChevronsUpDown className="sidebar-server-name-chevron" aria-hidden="true" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className="agent-context-menu server-menu" aria-label={t("server.menu.label")}>
            <Show
              when={props.view === "menu"}
              fallback={
                <Show when={props.onOpenSettings ? activeServer() : undefined}>
                  {(server) => (
                    <ServerActionItems
                      menu={DropdownMenu}
                      server={server()}
                      trigger={() => trigger.current}
                      onOpenSettings={props.onOpenSettings}
                      onLeave={props.onLeave}
                      onDelete={props.onDelete}
                      canDelete={props.canDelete}
                      onRestart={props.onRestart}
                      canRestart={props.canRestart}
                      onRemove={props.onRemove}
                      canRemove={props.canRemove}
                    />
                  )}
                </Show>
              }
            >
              {/* A heading only: each row names its server. A menu cannot hold a fieldset. */}
              <div className="ui-menu-label" aria-hidden="true">
                {t("server.rail.label")}
              </div>
              <For each={props.servers} keyed={(server) => server.id}>
                {(server) => (
                  <DropdownMenu.Sub>
                    <DropdownMenu.SubTrigger
                      className="server-menu-row"
                      aria-label={[server().name, ...serverStatusLabels(server(), t)].join(", ")}
                      aria-current={server().active ? "true" : undefined}
                      data-cuelume-navigate=""
                      onClick={() => selectServer(server())}
                      onKeyDown={(event) => selectOnKey(event, server)}
                    >
                      <CheckCircle checked={server().active} />
                      <span className="server-menu-mark" aria-hidden="true">
                        <ServerMark server={server()} />
                      </span>
                      <span className="server-menu-name">{server().name}</span>
                      <ServerSleepDot server={server()} className="server-menu-sleep" />
                      <Show when={server().notificationsMuted}>
                        <BellOff className="server-menu-muted size-3" aria-hidden="true" />
                      </Show>
                      <ChevronRight className="agent-context-submenu-chevron size-4" aria-hidden="true" />
                    </DropdownMenu.SubTrigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.SubContent
                        className="ui-action-menu agent-context-menu"
                        aria-label={t("server.rail.actions")}
                      >
                        <div className="ui-menu-label" aria-hidden="true">
                          {server().name}
                        </div>
                        <ServerActionItems
                          menu={DropdownMenu}
                          server={server()}
                          trigger={() => trigger.current}
                          onSetMuted={props.onSetMuted}
                          onSetNotificationLevel={props.onSetNotificationLevel}
                          onOpenSettings={props.onOpenSettings}
                          onLeave={props.onLeave}
                          onDelete={props.onDelete}
                          canDelete={props.canDelete}
                          onRestart={props.onRestart}
                          canRestart={props.canRestart}
                          onRemove={props.onRemove}
                          canRemove={props.canRemove}
                        />
                      </DropdownMenu.SubContent>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Sub>
                )}
              </For>
              <Show when={props.onAdd}>
                <DropdownMenu.Item className="server-menu-add" onSelect={() => props.onAdd?.()}>
                  <span className="server-menu-add-circle" aria-hidden="true">
                    <Plus />
                  </span>
                  <span>{t(props.addCreatesServer ? "server.rail.add" : "server.rail.addRemote")}</span>
                </DropdownMenu.Item>
              </Show>
              <Show when={activeServer()}>
                {(server) => (
                  <>
                    <DropdownMenu.Separator />
                    {/* Mute and notifications are in the submenu of each server row. The page rail opens
                        Usage and Routines of the active server. */}
                    <ServerActionItems
                      menu={DropdownMenu}
                      server={server()}
                      trigger={() => trigger.current}
                      onOpenSettings={props.onOpenSettings}
                      onLeave={props.onLeave}
                      onDelete={props.onDelete}
                      canDelete={props.canDelete}
                      onRestart={props.onRestart}
                      canRestart={props.canRestart}
                      onRemove={props.onRemove}
                      canRemove={props.canRemove}
                    />
                  </>
                )}
              </Show>
            </Show>
            <DropdownMenu.Separator />
            <DropdownMenu.Sub open={layoutOpen()} onOpenChange={setLayoutOpen}>
              <DropdownMenu.SubTrigger>
                <AppWindow className="agent-context-icon size-4" aria-hidden="true" />
                <span>{t("server.menu.layout")}</span>
                <span className="ui-menu-trailing">{t(SERVER_VIEW_LABELS[props.view])}</span>
                <ChevronRight
                  className="agent-context-submenu-chevron server-menu-layout-chevron size-4"
                  aria-hidden="true"
                />
              </DropdownMenu.SubTrigger>
              <DropdownMenu.Portal>
                <DropdownMenu.SubContent className="ui-action-menu agent-context-menu">
                  <DropdownMenu.RadioGroup
                    aria-label={t("server.menu.layout")}
                    value={props.view}
                    onChange={(value) => {
                      const view = SERVER_VIEWS.find((candidate) => candidate === value);
                      if (view) props.onViewChange(view);
                    }}
                  >
                    <For each={SERVER_VIEWS}>
                      {(view) => {
                        const Icon = SERVER_VIEW_ICONS[view];
                        return (
                          <DropdownMenu.RadioItem value={view}>
                            <CheckCircle checked={props.view === view} />
                            <Icon className="agent-context-icon size-4" aria-hidden="true" />
                            <span>{t(SERVER_VIEW_LABELS[view])}</span>
                          </DropdownMenu.RadioItem>
                        );
                      }}
                    </For>
                  </DropdownMenu.RadioGroup>
                </DropdownMenu.SubContent>
              </DropdownMenu.Portal>
            </DropdownMenu.Sub>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      {/* A sibling, not a parent: inside a menu root, Kobalte makes the dropdown a submenu without a focus trap. */}
      <ContextMenu.Root modal={false}>
        <ContextMenu.Trigger
          hidden
          ref={anchor}
          onContextMenu={(event) => {
            if (!activeServer()) event.preventDefault();
          }}
        />
        <ContextMenu.Portal>
          <ContextMenu.Content className="agent-context-menu" aria-label={t("server.rail.actions")}>
            <Show when={activeServer()}>
              {(server) => (
                <ServerActionItems
                  menu={ContextMenu}
                  server={server()}
                  trigger={() => trigger.current}
                  onSetMuted={props.onSetMuted}
                  onSetNotificationLevel={props.onSetNotificationLevel}
                  onOpenSettings={props.onOpenSettings}
                  onLeave={props.onLeave}
                  onDelete={props.onDelete}
                  canDelete={props.canDelete}
                  onRestart={props.onRestart}
                  canRestart={props.canRestart}
                  onRemove={props.onRemove}
                  canRemove={props.canRemove}
                />
              )}
            </Show>
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu.Root>
    </>
  );
}
