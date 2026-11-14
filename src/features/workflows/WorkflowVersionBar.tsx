/** The bar that shows while the canvas shows a saved version, read-only, with Back and Make current. */

import { ArrowLeft, Button, History, Lock } from "@johnbot/ui";
import { useText } from "../../components/text";

export function WorkflowVersionBar(props: {
  /** When the version was saved, as the switcher lists it. */
  at: string;
  onBack: () => void;
  onMakeCurrent: () => void;
}) {
  const { t } = useText();
  return (
    <section className="wfn-hud wfn-hud-version" aria-label={t("workflow.canvas.version.preview")}>
      <span className="wfn-hud-icon" aria-hidden="true">
        <History />
      </span>
      <span className="wfn-hud-label">{t("workflow.canvas.version.label")}</span>
      <span className="wfn-hud-meta">{props.at}</span>
      <span className="wfn-hud-separator" aria-hidden="true" />
      <span className="wfn-hud-lock">
        <Lock className="wfn-hud-lock-icon" aria-hidden="true" />
        {t("workflow.canvas.version.readOnly")}
      </span>
      <Button variant="ghost" size="sm" className="wfn-hud-button" onClick={props.onBack}>
        <ArrowLeft aria-hidden="true" />
        {t("workflow.canvas.version.back")}
      </Button>
      <Button size="sm" className="wfn-hud-button" onClick={props.onMakeCurrent}>
        {t("workflow.canvas.version.makeCurrent")}
      </Button>
    </section>
  );
}
