/** The search field, and the compact-mode button in its place. Both open the global search. */

import { Button } from "@johnbot/ui";
import { cn } from "../../components/utils";
import { useText } from "../../components/text";
import { SearchIcon } from "./SidebarIcons";
import { useSidebarScope } from "./sidebar-scope";

export function SidebarSearch() {
  const { props } = useSidebarScope();
  const { t } = useText();
  return (
    <div className={cn("sidebar-search-wrap")}>
      <Button
        variant="ghost"
        type="button"
        className="search-field sidebar-search-trigger"
        aria-label={t("conversation.globalSearch.title")}
        aria-haspopup="dialog"
        aria-hidden={props.compact ? "true" : undefined}
        tabIndex={props.compact ? -1 : 0}
        onClick={props.onOpenSearch}
      >
        <SearchIcon />
        <span className="sidebar-search-placeholder">{t("common.search")}</span>
      </Button>
      <Button
        variant="ghost"
        type="button"
        className="sidebar-compact-search"
        aria-label={t("conversation.globalSearch.title")}
        aria-haspopup="dialog"
        aria-hidden={props.compact ? undefined : "true"}
        tabIndex={props.compact ? 0 : -1}
        onClick={props.onOpenSearch}
      >
        <SearchIcon />
      </Button>
    </div>
  );
}
