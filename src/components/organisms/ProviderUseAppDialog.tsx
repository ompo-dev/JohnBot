/**
 * A provider that only the johnBot app can sign in from here.
 *
 * Its sign-in page returns to the computer that opened it. The app on that computer receives it and
 * sends it on to the host; a browser tab cannot receive it. So the browser says where the sign-in
 * works, and offers the app. It is the same frame as the code sign-in dialog, which the same rows open.
 */

import { Button, Dialog, IconButton, X } from "@johnbot/ui";
import { useText } from "../text";

export interface ProviderUseAppDialogProps {
  open: boolean;
  providerName: string;
  /** Opens the page that downloads the johnBot app. */
  onDownload: () => void;
  onClose: () => void;
}

export function ProviderUseAppDialog(props: ProviderUseAppDialogProps) {
  const { t } = useText();
  return (
    <Dialog.Root
      open={props.open}
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="provider-code-login-backdrop">
          <Dialog.Content className="provider-code-login-dialog" as="section">
            <header className="provider-code-login-header">
              <Dialog.Title className="provider-code-login-title">
                {t("provider.useApp.title", { name: props.providerName })}
              </Dialog.Title>
              <Dialog.Description className="provider-code-login-description">
                {t("provider.useApp.description", { name: props.providerName })}
              </Dialog.Description>
            </header>
            <div className="provider-code-login-body provider-use-app-actions">
              <Button type="button" variant="outline" onClick={props.onClose}>
                {t("common.close")}
              </Button>
              <Button type="button" onClick={props.onDownload}>
                {t("provider.useApp.download")}
              </Button>
            </div>
            <IconButton
              className="provider-code-login-close"
              label={t("common.close")}
              variant="ghost"
              data-cuelume-tap="close"
              onClick={props.onClose}
            >
              <X />
            </IconButton>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
