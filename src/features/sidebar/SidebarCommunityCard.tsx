import { Button, IconButton, X } from "@johnbot/ui";
import { useText } from "../../components/text";
import { DiscordMark, XMark } from "../settings/brand-marks";

/**
 * The invitation to the johnBot community at the bottom of the sidebar. It uses the quiet card of
 * the mobile app announcement. Discord is the main action; X is an icon button beside it.
 */
export function SidebarCommunityCard(props: {
  onJoinDiscord: () => void;
  onFollowX: () => void;
  onDismiss: () => void;
}) {
  const { t } = useText();
  return (
    <section className="sidebar-mobile-app" aria-labelledby="sidebar-community-title">
      <div className="sidebar-mobile-app-header">
        <DiscordMark className="sidebar-mobile-app-icon" />
        <strong id="sidebar-community-title">{t("sidebar.community.title")}</strong>
        <IconButton
          className="sidebar-mobile-app-dismiss"
          size="icon-xs"
          variant="ghost"
          label={t("sidebar.community.dismiss")}
          data-cuelume-tap="close"
          onClick={() => props.onDismiss()}
        >
          <X aria-hidden="true" />
        </IconButton>
      </div>
      <p className="sidebar-mobile-app-body">{t("sidebar.community.body")}</p>
      <div className="sidebar-community-actions">
        <Button type="button" variant="secondary" size="sm" onClick={() => props.onJoinDiscord()}>
          <DiscordMark className="sidebar-community-mark" />
          {t("sidebar.community.joinDiscord")}
        </Button>
        <IconButton
          variant="secondary"
          size="icon-sm"
          label={t("sidebar.community.followX")}
          onClick={() => props.onFollowX()}
        >
          <XMark className="sidebar-community-mark" />
        </IconButton>
      </div>
    </section>
  );
}
