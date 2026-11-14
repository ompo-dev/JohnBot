import { isRemoteNetworkRoute, type RemoteNetworkRoute } from "@johnbot/contracts/ipc";
import { Badge, RadioGroup } from "@johnbot/ui";
import { Show } from "solid-js";
import { useText } from "../../components/text";

interface RemoteNetworkRouteChoiceProps {
  value: RemoteNetworkRoute;
  tailscaleConnected: boolean;
  disabled: boolean;
  onChange: (route: RemoteNetworkRoute) => void;
}

/** The two routes as cards with a radio dot. johnBot is the default and has the recommended badge. */
export function RemoteNetworkRouteChoice(props: RemoteNetworkRouteChoiceProps) {
  const { t } = useText();
  return (
    <RadioGroup.Root
      className="settings-mobile-route-choice"
      aria-label={t("settings.mobileConnect.route.title")}
      value={props.value}
      disabled={props.disabled}
      onChange={(value) => {
        if (isRemoteNetworkRoute(value)) props.onChange(value);
      }}
    >
      <RadioGroup.Item className="settings-mobile-route-option" value="johnbot">
        <RadioGroup.ItemInput />
        <RadioGroup.ItemControl className="settings-mobile-route-card">
          <span className="settings-mobile-route-dot" aria-hidden="true" />
          <span className="settings-mobile-route-text">
            <RadioGroup.ItemLabel className="settings-mobile-route-name">
              {t("settings.mobileConnect.route.johnbot.title")}
              <Badge variant="info-light">{t("settings.mobileConnect.route.johnbot.badge")}</Badge>
            </RadioGroup.ItemLabel>
            <RadioGroup.ItemDescription className="settings-mobile-route-hint">
              {t("settings.mobileConnect.route.johnbot.description")}
            </RadioGroup.ItemDescription>
          </span>
        </RadioGroup.ItemControl>
      </RadioGroup.Item>
      <RadioGroup.Item className="settings-mobile-route-option" value="private">
        <RadioGroup.ItemInput />
        <RadioGroup.ItemControl className="settings-mobile-route-card">
          <span className="settings-mobile-route-dot" aria-hidden="true" />
          <span className="settings-mobile-route-text">
            <RadioGroup.ItemLabel className="settings-mobile-route-name">
              {t("settings.mobileConnect.route.private.title")}
              <Show when={props.tailscaleConnected}>
                <Badge variant="success-light">{t("settings.mobileConnect.route.private.tailscale")}</Badge>
              </Show>
            </RadioGroup.ItemLabel>
            <RadioGroup.ItemDescription className="settings-mobile-route-hint">
              {t("settings.mobileConnect.route.private.description")}
            </RadioGroup.ItemDescription>
          </span>
        </RadioGroup.ItemControl>
      </RadioGroup.Item>
    </RadioGroup.Root>
  );
}
