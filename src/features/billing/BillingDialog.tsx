import { Dialog, IconButton, Text, X } from "@johnbot/ui";
import type { JSX } from "@solidjs/web";
import { useText } from "../../components/text";
import type { SettingsHostedServersStore } from "../settings/stores/hosted-servers-store";
import { BillingPanel } from "./BillingPanel";
import type { BillingStore } from "./billing-store";

export interface BillingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  store: BillingStore;
  /** The hosted servers of the account. A server whose plan ended is renewed or deleted here. */
  hostedServers?: SettingsHostedServersStore | undefined;
  /** The License part, above the server plans. */
  license?: JSX.Element;
}

/** The Billing panel in a dialog, for the web client, which has no Billing settings. */
export function BillingDialog(props: BillingDialogProps): JSX.Element {
  if (!productFeatures.billing) return null;
  const { t } = useText();

  return (
    <Dialog.Root open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="billing-dialog-backdrop">
          <Dialog.Content as="section" className="billing-dialog">
            <IconButton
              className="billing-dialog-close"
              label={t("common.close")}
              variant="ghost"
              onClick={() => props.onOpenChange(false)}
            >
              <X />
            </IconButton>
            <header className="billing-dialog-header">
              <Dialog.Title as="h2" className="billing-dialog-title">
                {t("billing.title")}
              </Dialog.Title>
              <Dialog.Description as="p">
                <Text tone="muted">{t("billing.description")}</Text>
              </Dialog.Description>
            </header>
            <div className="billing-dialog-body">
              <BillingPanel store={props.store} available hostedServers={props.hostedServers} license={props.license} />
            </div>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
import { productFeatures } from "../../lib/product-features";
