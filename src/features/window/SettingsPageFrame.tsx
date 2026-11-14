import type { ServerSummary } from "@johnbot/contracts/ipc";
import { ServerMark } from "@johnbot/features/servers/ServerRail";
import type { SettingsPagePlacement } from "@johnbot/features/settings/SettingsDialogShell";
import type { JSX } from "@solidjs/web";
import { useEffect, useEffectEvent, useRef } from "react";

/**
 * The frame of a settings page, on desktop and on the web: the heading and the section list at the
 * width of the sidebar, and the panel. The settings panel shows its nav and content in the mounts
 * that `onMounts` gets.
 */
export function SettingsPageFrame(props: {
  heading: JSX.Element;
  /** Content between the heading and the section list, such as a search. */
  children?: JSX.Element;
  sectionsHidden?: boolean;
  onMounts: (mounts: SettingsPagePlacement | undefined) => void;
  /** Escape outside a popup or a text field of the window. */
  onEscape: () => void;
}) {
  const navRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const onMounts = useEffectEvent(props.onMounts);
  const onEscape = useEffectEvent(props.onEscape);

  useEffect(() => {
    const nav = navRef.current;
    const content = contentRef.current;
    const root = rootRef.current;
    if (!root || !nav || !content) return;
    onMounts({ nav, content });
    // As on the usage and schedule pages, the heading takes the focus, so a screen reader reads the
    // page that opened. The settings shell puts the focus back on the opener when the page closes.
    root.querySelector<HTMLElement>(".settings-page-title")?.focus({ preventScroll: true });
    // Escape closes the page, as it closed the settings dialog. On the document and after the
    // delegated handlers, so a control that handles Escape keeps it. A click can put the focus back on
    // the rail or the server menu, so a target outside the page also counts, except an open popup or a
    // text field.
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("[role=dialog], [role=alertdialog], [role=menu], [role=listbox]")) return;
      if (target && !root.contains(target) && target.closest("input, textarea, select, [contenteditable]")) return;
      event.preventDefault();
      onEscape();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      onMounts(undefined);
    };
  }, []);

  return (
    <div className="settings-page" ref={rootRef}>
      <div className="settings-page-nav">
        {props.heading}
        {props.children}
        <div className="settings-page-sections" ref={navRef} hidden={props.sectionsHidden} />
      </div>
      <div className="settings-page-content" ref={contentRef} />
    </div>
  );
}

/** The heading of a server settings page: the server mark and name, as the server menu shows them. */
export function ServerSettingsPageTitle(props: { server: ServerSummary }) {
  return (
    <h1 className="settings-page-title settings-page-server" tabIndex={-1}>
      <span className="server-menu-mark" aria-hidden="true">
        <ServerMark server={props.server} />
      </span>
      <span className="server-menu-name">{props.server.name}</span>
    </h1>
  );
}
