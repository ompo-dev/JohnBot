import type { ParentProps } from "solid-js";
import { cn } from "../../components/utils";
import { useText } from "../../components/text";

/** The navigation surface shared by the desktop and browser composition roots. */
export function SidebarFrame(props: ParentProps<{ compact?: boolean }>) {
  const { t } = useText();
  return (
    <aside
      id="agent-sidebar"
      aria-label={t("sidebar.frame.label")}
      className={cn("sidebar panel-edge bg-sidebar", props.compact && "sidebar-compact")}
    >
      {props.children}
    </aside>
  );
}
