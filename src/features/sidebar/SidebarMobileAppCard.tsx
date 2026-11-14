import { Button, IconButton, Smartphone, X } from "@johnbot/ui";
import { useText } from "../../components/text";

/**
 * The announcement of the mobile app at the bottom of the sidebar. "How to install" opens Mobile
 * Connect, which shows the install steps for iPhone and Android and then the sign-in code.
 */
export function SidebarMobileAppCard(props: { onOpenInstall: () => void; onDismiss: () => void }) {
  const { t } = useText();
  return (
    <section className="sidebar-mobile-app" aria-labelledby="sidebar-mobile-app-title">
      <div className="sidebar-mobile-app-header">
        <Smartphone className="sidebar-mobile-app-icon" aria-hidden="true" />
        <strong id="sidebar-mobile-app-title">{t("sidebar.mobileApp.title")}</strong>
        <IconButton
          className="sidebar-mobile-app-dismiss"
          size="icon-xs"
          variant="ghost"
          label={t("sidebar.mobileApp.dismiss")}
          data-cuelume-tap="close"
          onClick={() => props.onDismiss()}
        >
          <X aria-hidden="true" />
        </IconButton>
      </div>
      <p className="sidebar-mobile-app-body">{t("sidebar.mobileApp.body")}</p>
      <Button type="button" variant="secondary" size="sm" fullWidth onClick={() => props.onOpenInstall()}>
        {t("sidebar.mobileApp.howToInstall")}
      </Button>
    </section>
  );
}
