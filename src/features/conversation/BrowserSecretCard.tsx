import { cn } from "../../components/utils";
import type { BrowserPreview, BrowserTakeoverRequest, LocalBrowserSecretResponse } from "@johnbot/contracts/ipc";
import { Button, Checkbox, ErrorReference, Input, Lock, Maximize2, Monitor, ShieldCheck, X } from "@johnbot/ui";
import { OtpInput } from "@johnbot/features/account/OtpInput";
import { BrowserTakeoverPreview } from "@johnbot/features/conversation/BrowserTakeoverPreview";
import { useText } from "@johnbot/ui/text";
import { errorReference } from "@johnbot/user-errors";
import { createEffect, createMemo, createSignal, createUniqueId, onCleanup, Show } from "solid-js";

/**
 * The Vault that a typed password can go to. `server` is null for this computer, or the name of the
 * joined server. `blocked` is why that server cannot save it: the account is a member, or the host is
 * older than `browser-secret-vault-v1`.
 */
export interface BrowserSecretVault {
  server: string | null;
  blocked?: "role" | "version" | undefined;
}

/**
 * The code or the password that the agent asks for: the site at the top, the value in the middle and Submit
 * at the end. Cancel is the X. The `card` variant is the timeline card and shows the sign-in page under the
 * value; the `island` variant is the glass card over the browser page. The value goes only to the agent, and
 * the card clears it after each answer. With `vault`, a password can also go to the Vault of the server
 * that runs the agent. The box starts checked for this computer and unchecked for a joined server; a
 * server that cannot save shows the box off, with the reason.
 */
export function BrowserSecretCard(props: {
  request: BrowserTakeoverRequest;
  variant?: "card" | "island";
  onOpen?: (() => void) | undefined;
  loadPreview?: ((tabId: string) => Promise<BrowserPreview>) | undefined;
  /** Offer "Save to Vault" for a password. */
  vault?: BrowserSecretVault | undefined;
  onRespond: (input: LocalBrowserSecretResponse) => Promise<void>;
}) {
  const { t } = useText();
  const saveId = `browser-secret-save-${createUniqueId()}`;
  const [saveChoice, setSaveChoice] = createSignal<boolean | null>(null);
  const saveBlocked = () => Boolean(props.vault?.blocked);
  const saveToVault = () => !saveBlocked() && (saveChoice() ?? props.vault?.server === null);
  const [preview, setPreview] = createSignal<BrowserPreview | null>(null);
  const [previewStatus, setPreviewStatus] = createSignal<"loading" | "ready" | "failed">("loading");
  const [previewHidden, setPreviewHidden] = createSignal(false);
  const [value, setValue] = createSignal("");
  const [pending, setPending] = createSignal(false);
  const [error, setError] = createSignal("");
  /** The code of the failed answer. It shows only while `error` does. */
  const [failureCode, setFailureCode] = createSignal<string | null>(null);
  const shownCode = () => (error() ? failureCode() : null);
  const variant = () => props.variant ?? "card";
  const method = () => props.request.secret?.method;
  const digits = () => props.request.secret?.digits ?? 6;
  const password = () => method() === "password";
  const title = () =>
    password()
      ? t("browser.secret.title.password")
      : method() === "authenticator"
        ? t("browser.secret.title.authenticator")
        : t("browser.secret.title.code");
  // The origin is bold inside the sentence, so the sentence is split where the origin goes.
  const submitOnce = () => {
    const marker = "\u0000";
    const [before = "", after = ""] = t("browser.secret.submitOnce", { origin: marker }).split(marker);
    return { before, after };
  };
  // The server name is bold inside the sentence, as the origin is.
  const remoteSaveLabel = createMemo(() => {
    const server = props.vault?.server;
    if (!server) return null;
    const marker = "\u0000";
    const [before = "", after = ""] = t("browser.secret.saveToVaultOn", { server: marker }).split(marker);
    return { before, server, after };
  });
  const saveHint = (vault: BrowserSecretVault) => {
    if (vault.server === null) return t("browser.secret.saveHintLocal");
    if (vault.blocked === "role") return t("browser.secret.saveBlockedRole", { server: vault.server });
    if (vault.blocked === "version") return t("browser.secret.saveBlockedVersion", { server: vault.server });
    return t("browser.secret.saveHintRemote", { server: vault.server });
  };
  const valid = () => (password() ? value().length > 0 : value().length === digits());
  onCleanup(() => setValue(""));
  createEffect(
    () => ({ requestId: props.request.requestId, showPreview: variant() === "card" }),
    ({ showPreview }) => {
      setValue("");
      setError("");
      setPreview(null);
      setPreviewHidden(false);
      setPreviewStatus("loading");
      if (!showPreview) return;
      if (!props.loadPreview) {
        setPreviewStatus("failed");
        return;
      }
      let active = true;
      void props.loadPreview(props.request.tabId).then(
        (image) => {
          if (!active || previewHidden()) return;
          setPreview(image);
          setPreviewStatus("ready");
        },
        () => {
          if (active && !previewHidden()) setPreviewStatus("failed");
        },
      );
      return () => {
        active = false;
      };
    },
  );
  const respond = async (decision: LocalBrowserSecretResponse["decision"]) => {
    if (pending() || (decision === "submit" && !valid())) return;
    setPreviewHidden(true);
    setPreview(null);
    setPending(true);
    setError("");
    const identity = { requestId: props.request.requestId, agentId: props.request.agentId };
    const save: { saveToVault?: true } = props.vault && password() && saveToVault() ? { saveToVault: true } : {};
    const input: LocalBrowserSecretResponse =
      decision === "submit" ? { ...identity, decision, secret: value(), ...save } : { ...identity, decision };
    setValue("");
    try {
      await props.onRespond(input);
    } catch (cause) {
      setFailureCode(errorReference(cause));
      setError(t("browser.secret.failed"));
    } finally {
      if (input.decision === "submit") input.secret = "";
      setPending(false);
    }
  };
  const previewPage = () => ({ title: t("browser.secret.signInPage"), host: props.request.secret?.origin ?? "" });
  return (
    <form
      className={cn("browser-secret-card", { "conversation-interaction-card": variant() === "card" })}
      data-variant={variant()}
      aria-label={t("browser.secret.label")}
      aria-busy={pending() ? "true" : "false"}
      onSubmit={(event) => {
        event.preventDefault();
        void respond("submit");
      }}
    >
      <header className="browser-secret-header">
        <span className="browser-secret-icon" aria-hidden="true">
          <Lock className="browser-secret-glyph" />
        </span>
        <div className="browser-secret-heading">
          <h2>{title()}</h2>
          <p>
            {submitOnce().before}
            <strong className="browser-secret-origin">{props.request.secret?.origin}</strong>
            {submitOnce().after}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          type="button"
          className="browser-secret-close"
          aria-label={t("common.cancel")}
          disabled={pending()}
          onClick={() => void respond("cancel")}
        >
          <X aria-hidden="true" />
        </Button>
      </header>
      <Show
        when={password()}
        fallback={
          <div className="browser-secret-code">
            <OtpInput
              value={value()}
              length={digits()}
              numeric
              masked
              size="compact"
              label={t("browser.secret.codeLength", { digits: digits() })}
              status={error() ? "error" : pending() ? "verifying" : "idle"}
              errorMessage={error()}
              onChange={(next) => {
                setValue(next);
                setError("");
              }}
            />
            <ErrorReference reference={shownCode()} />
          </div>
        }
      >
        <div className="browser-secret-password">
          <Input
            aria-label={t("browser.secret.password")}
            placeholder={t("browser.secret.password")}
            type="password"
            autocomplete="off"
            maxLength={4096}
            value={value()}
            disabled={pending()}
            invalid={Boolean(error())}
            onInput={(event) => {
              setValue(event.currentTarget.value);
              setError("");
            }}
          />
          <Show when={error()}>
            <p className="browser-secret-error" role="alert">
              {error()}
              <ErrorReference reference={shownCode()} />
            </p>
          </Show>
          <Show when={props.vault}>
            {(vault) => (
              <div className="browser-secret-save-option">
                <label className="browser-secret-save" htmlFor={saveId}>
                  <Checkbox
                    id={saveId}
                    checked={saveToVault()}
                    disabled={pending() || saveBlocked()}
                    aria-describedby={`${saveId}-hint`}
                    onChange={(event) => setSaveChoice(event.currentTarget.checked)}
                  />
                  <Show when={remoteSaveLabel()} fallback={<span>{t("browser.secret.saveToVaultLocal")}</span>}>
                    {(label) => (
                      <span>
                        {label().before}
                        <strong className="browser-secret-save-server">{label().server}</strong>
                        {label().after}
                      </span>
                    )}
                  </Show>
                </label>
                <p className="browser-secret-save-hint" id={`${saveId}-hint`}>
                  {saveHint(vault())}
                </p>
              </div>
            )}
          </Show>
        </div>
      </Show>
      <Show when={variant() === "card" && !previewHidden()}>
        <figure className="browser-takeover-preview">
          <figcaption className="browser-takeover-preview-bar">
            <Monitor aria-hidden="true" />
            <span>{t("browser.secret.signInPage")}</span>
            <small>{props.request.secret?.origin}</small>
          </figcaption>
          <Show
            when={props.onOpen}
            fallback={
              <div className="browser-takeover-preview-viewport">
                <BrowserTakeoverPreview preview={preview()} previewStatus={previewStatus()} page={previewPage()} />
              </div>
            }
          >
            <Button
              variant="ghost"
              type="button"
              className="browser-takeover-preview-viewport browser-takeover-preview-open"
              aria-label={t("browser.secret.openSignInPage")}
              onClick={() => props.onOpen?.()}
            >
              <BrowserTakeoverPreview preview={preview()} previewStatus={previewStatus()} page={previewPage()} />
              <span className="browser-takeover-preview-open-label" aria-hidden="true">
                <Maximize2 />
                {t("browser.secret.openInBrowser")}
              </span>
            </Button>
          </Show>
        </figure>
      </Show>
      <footer className="browser-secret-footer">
        <span className="browser-secret-private">
          <ShieldCheck className="browser-secret-glyph-sm" aria-hidden="true" />
          {t("browser.secret.notAddedToChat")}
        </span>
        <Button variant="ghost" size="sm" type="button" disabled={pending()} onClick={() => void respond("takeover")}>
          {t("browser.secret.takeOver")}
        </Button>
        <Button
          size="sm"
          type="submit"
          disabled={!valid()}
          loading={pending()}
          loadingLabel={t("browser.secret.submitting")}
        >
          {t("browser.secret.submit")}
        </Button>
      </footer>
    </form>
  );
}
