import { AppLogo } from "@johnbot/brand";
import { Button, buttonVariants, Download, ErrorReference, Heading, Link2, RefreshCw, Server, Text } from "@johnbot/ui";
import { useText } from "@johnbot/ui/text";
import { Show } from "solid-js";

/** The first screen of the web client when the account has no computer to connect to. */
export function WebConnectComputer(props: {
  loading: boolean;
  failed: boolean;
  /** The code of the failed host list read. */
  reference?: string | null;
  onJoin: () => void;
  /**
   * Opens the hosted server plans. Leave it out when the account cannot create a hosted server. With
   * it, the hosted server is the first action, because it needs no install.
   */
  onCreateServer?: (() => void) | undefined;
  onRefresh: () => void;
}) {
  const { t } = useText();
  return (
    <section className="conversation-panel web-connect" aria-labelledby="web-connect-title">
      <div className="web-connect-card">
        <header className="web-connect-header">
          <AppLogo variant="production" className="web-connect-logo" />
          <Heading as="h2" size="lg" id="web-connect-title">
            {props.failed ? t("webClient.notice.hostsFailed") : t("webClient.notice.connectComputer")}
          </Heading>
          <Text tone="muted">
            {props.onCreateServer ? t("webClient.connect.descriptionHosted") : t("webClient.connect.description")}
          </Text>
          <ErrorReference reference={props.failed ? props.reference : null} />
        </header>

        <Show when={props.onCreateServer}>
          {(createServer) => (
            <Button className="web-connect-hosted" onClick={() => createServer()()}>
              <Server aria-hidden="true" />
              {t("webClient.notice.createServer")}
            </Button>
          )}
        </Show>

        <ol className="web-connect-steps">
          <li>
            <span className="web-connect-step-number" aria-hidden="true">
              1
            </span>
            <Text>{t("webClient.connect.stepInstall")}</Text>
          </li>
          <li>
            <span className="web-connect-step-number" aria-hidden="true">
              2
            </span>
            <Text>{t("webClient.connect.stepSignIn")}</Text>
          </li>
          <li>
            <span className="web-connect-step-number" aria-hidden="true">
              3
            </span>
            <Text>{t("webClient.connect.stepRemote")}</Text>
          </li>
        </ol>

        <footer className="web-connect-actions">
          <div className="web-connect-primary-actions">
            <a
              className={`web-connect-download ${buttonVariants({ variant: props.onCreateServer ? "outline" : "default" })}`}
              href="/download"
              target="_blank"
              rel="noreferrer"
            >
              <Download aria-hidden="true" />
              {t("webClient.notice.download")}
            </a>
            <Button variant="outline" onClick={() => props.onJoin()}>
              <Link2 aria-hidden="true" />
              {t("webClient.notice.join")}
            </Button>
          </div>
          <Button
            className="web-connect-refresh"
            variant="ghost"
            size="sm"
            loading={props.loading}
            loadingLabel={t("webClient.notice.findingHosts")}
            onClick={() => props.onRefresh()}
          >
            <RefreshCw aria-hidden="true" />
            {t("webClient.notice.refreshHosts")}
          </Button>
        </footer>
      </div>
    </section>
  );
}
