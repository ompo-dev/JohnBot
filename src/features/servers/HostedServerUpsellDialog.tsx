import { Button, CalendarClock, Dialog } from "@johnbot/ui";
import { useText } from "../../components/text";

export interface HostedServerUpsellDialogProps {
  routine: { name: string };
  onSeePlans: () => void;
  onClose: () => void;
}

/**
 * The offer of a hosted server after a new routine. A short loop shows it: the laptop lid closes and the
 * routine stops, while the server keeps running.
 */
export function HostedServerUpsellDialog(props: HostedServerUpsellDialogProps) {
  if (!productFeatures.payments) return null;
  const { t } = useText();
  let seePlans: HTMLButtonElement | undefined;
  return (
    <Dialog.Root open onOpenChange={(open) => !open && props.onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay>
          <Dialog.Content
            as="section"
            className="hosted-upsell-modal"
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              seePlans?.focus({ preventScroll: true });
            }}
          >
            <div className="hosted-upsell-scene" aria-hidden="true">
              <figure className="hosted-upsell-device">
                <div className="hosted-upsell-laptop">
                  <span className="hosted-upsell-laptop-lid">
                    <span className="hosted-upsell-laptop-screen">
                      <CalendarClock />
                    </span>
                  </span>
                  <span className="hosted-upsell-laptop-base" />
                </div>
                <figcaption>
                  {t("server.upsell.modal.computer")}
                  <span className="hosted-upsell-status hosted-upsell-status-flip">
                    <span className="hosted-upsell-status-on">{t("server.upsell.modal.running")}</span>
                    <span className="hosted-upsell-status-off">{t("server.upsell.modal.stopped")}</span>
                  </span>
                </figcaption>
              </figure>
              <figure className="hosted-upsell-device">
                <div className="hosted-upsell-rack">
                  <span />
                  <span />
                  <span />
                </div>
                <figcaption>
                  {t("server.upsell.modal.server")}
                  <span className="hosted-upsell-status">
                    <span className="hosted-upsell-status-on">{t("server.upsell.modal.running")}</span>
                  </span>
                </figcaption>
              </figure>
            </div>
            <Dialog.Title as="h2" className="hosted-upsell-modal-title">
              {t("server.upsell.modal.title")}
            </Dialog.Title>
            <Dialog.Description as="p" className="hosted-upsell-modal-description">
              {t("server.upsell.modal.description", { name: props.routine.name })}
            </Dialog.Description>
            <footer className="hosted-upsell-modal-actions">
              <Button variant="ghost" onClick={() => props.onClose()}>
                {t("server.upsell.notNow")}
              </Button>
              <Button ref={(element) => (seePlans = element)} onClick={() => props.onSeePlans()}>
                {t("server.upsell.seePlans")}
              </Button>
            </footer>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
import { productFeatures } from "../../lib/product-features";
