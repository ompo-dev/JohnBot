import { AppLogo } from "@johnbot/brand";
import { Button, ErrorReference } from "@johnbot/ui";
import { useText } from "@johnbot/ui/text";
import { usePlatform } from "../../platform";
import { useSetup } from "./onboarding-context";

const PRODUCT_NAME = "johnBot";

/**
 * Shown in place of first-run setup when the saved setup could not be read. A configured user
 * retries; "Set up again" opens first-run setup with no saved state. The screen uses the layout of
 * the sign-in screen when the account service is unreachable.
 */
export function SetupReadError() {
  const { t } = useText();
  const platform = usePlatform();
  const setup = useSetup();
  return (
    <main className="account-login-screen">
      <div className="account-login-shell">
        <header className="account-login-brand-lockup">
          <AppLogo
            variant={platform.appInfo()?.variant ?? "production"}
            animation="blink"
            interactive
            className="account-login-logo"
          />
          <span className="account-login-wordmark">{PRODUCT_NAME}</span>
        </header>
        <section
          className="account-login"
          aria-labelledby="setup-read-error-title"
          aria-describedby="setup-read-error-description"
        >
          <h1 id="setup-read-error-title" className="account-login-title">
            {t("onboarding.readFailed.title")}
          </h1>
          <p id="setup-read-error-description" className="account-login-description">
            {t("onboarding.readFailed.description")}
          </p>
          <ErrorReference reference={setup.setupReadReference()} />
          <Button
            variant="default"
            type="button"
            className="account-login-primary"
            loading={setup.setupReadRetrying()}
            loadingLabel={t("common.loading")}
            onClick={() => void setup.retrySetupRead()}
          >
            {t("common.retry")}
          </Button>
          <div className="account-login-code-actions setup-read-error-actions">
            <Button
              variant="ghost"
              size="sm"
              type="button"
              className="account-login-code-action"
              disabled={setup.setupReadRetrying()}
              onClick={setup.setUpAgain}
            >
              {t("onboarding.readFailed.setUpAgain")}
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
