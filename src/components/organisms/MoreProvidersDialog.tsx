import { ProviderLogo } from "@johnbot/brand";
import type { AgentProviderId } from "@johnbot/contracts/ipc";
import { Button, Dialog, IconButton, Input, SlidersHorizontal, X } from "@johnbot/ui";
import { createSignal, For, Show } from "solid-js";
import { useText } from "../text";

interface MoreProvidersEntry {
  id: AgentProviderId;
  name: string;
  description?: string | null;
}

export interface MoreProvidersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The providers that the list does not show, in the order to list them. */
  providers: readonly MoreProvidersEntry[];
  /** Adds the custom provider entry below a divider. */
  custom?: boolean;
  onChoose: (provider: AgentProviderId) => void;
  onChooseCustom?: (() => void) | undefined;
  /** Kobalte calls it when the dialog closes, before it moves the focus back to the trigger. */
  onCloseAutoFocus?: ((event: Event) => void) | undefined;
}

/** The search field shows only when the list is long enough to need it. */
const SEARCH_FROM = 8;

/**
 * The providers that are not in the list: a title and one plain list. Each row is the full target,
 * so there are no group labels, cards or "Add" buttons. The custom provider is last, below a line.
 */
export function MoreProvidersDialog(props: MoreProvidersDialogProps) {
  const { t } = useText();
  const [query, setQuery] = createSignal("");
  const searchable = () => props.providers.length >= SEARCH_FROM;
  const matches = () => {
    const text = query().trim().toLowerCase();
    if (!text || !searchable()) return props.providers;
    return props.providers.filter((provider) =>
      `${provider.name} ${provider.description ?? ""}`.toLowerCase().includes(text),
    );
  };
  const close = () => {
    props.onOpenChange(false);
    setQuery("");
  };
  const choose = (provider: AgentProviderId) => {
    props.onChoose(provider);
    close();
  };
  const chooseCustom = () => {
    props.onChooseCustom?.();
    close();
  };

  return (
    <Dialog.Root open={props.open} onOpenChange={(open) => (open ? props.onOpenChange(true) : close())}>
      <Dialog.Portal>
        <Dialog.Overlay className="custom-provider-backdrop provider-more-backdrop">
          <Dialog.Content
            as="section"
            className="custom-provider-dialog provider-more-dialog"
            onCloseAutoFocus={(event) => props.onCloseAutoFocus?.(event)}
          >
            <header className="provider-more-header">
              <Dialog.Title as="h2" className="provider-more-title">
                {t("onboarding.provider.more")}
              </Dialog.Title>
              <IconButton label={t("common.close")} variant="ghost" data-cuelume-tap="close" onClick={close}>
                <X />
              </IconButton>
            </header>
            <Show when={searchable()}>
              <Input
                type="search"
                className="provider-more-search"
                placeholder={t("common.search")}
                aria-label={t("onboarding.provider.moreSearch")}
                autocomplete="off"
                value={query()}
                onValueChange={setQuery}
              />
            </Show>
            <div className="provider-more-list">
              <For each={matches()} keyed={false}>
                {(provider) => (
                  <Button
                    type="button"
                    variant="ghost"
                    className="provider-more-row"
                    data-cuelume-tap="select"
                    onClick={() => choose(provider().id)}
                  >
                    <ProviderLogo provider={provider().id} className="provider-picker-logo" />
                    <span className="provider-picker-identity">
                      <span className="provider-picker-name">{provider().name}</span>
                      <Show when={provider().description}>
                        {(description) => <small className="provider-picker-email">{description()}</small>}
                      </Show>
                    </span>
                  </Button>
                )}
              </For>
              <Show when={query().trim() && matches().length === 0}>
                <p className="provider-more-empty">{t("onboarding.provider.moreNoMatch", { query: query().trim() })}</p>
              </Show>
              <Show when={props.custom}>
                <hr className="provider-more-divider" />
                <Button
                  type="button"
                  variant="ghost"
                  className="provider-more-row"
                  data-cuelume-tap="select"
                  onClick={chooseCustom}
                >
                  <SlidersHorizontal className="provider-picker-custom-mark" aria-hidden="true" />
                  <span className="provider-picker-identity">
                    <span className="provider-picker-name">{t("provider.custom.name")}</span>
                    <small className="provider-picker-email">{t("provider.custom.description")}</small>
                  </span>
                </Button>
              </Show>
            </div>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
