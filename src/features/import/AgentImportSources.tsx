import { ProviderLogo } from "@johnbot/brand";
import { Button, ChevronRight, Monitor } from "@johnbot/ui";
import type { JSX } from "@solidjs/web";
import { createUniqueId, Show } from "solid-js";
import { useText } from "../../components/text";
import { HermesLogo } from "./HermesImportView";

/** Product names, the same in each language. */
const HERMES_AGENT = "Hermes Agent";
const GROK_BOT = "Grok Bot";

export interface AgentImportSourcesProps {
  /** The Transfer tab is there: this computer, or a server the user administers. */
  transfer: boolean;
  onHermes: () => void;
  onGrok: () => void;
  onTransfer: () => void;
}

/** Server settings > Import, first: where the agents are now. Each source has its own steps after this. */
export function AgentImportSources(props: AgentImportSourcesProps) {
  const { t } = useText();
  const headingId = `agent-import-sources-${createUniqueId()}`;
  return (
    <section className="agent-import-guide" aria-labelledby={headingId}>
      <header className="agent-import-intro">
        <h3 id={headingId} className="agent-import-heading">
          {t("import.source.title")}
        </h3>
        <p className="agent-import-lede">{t("import.source.lede")}</p>
      </header>
      <ul className="agent-import-sources">
        <li>
          <SourceButton
            title={HERMES_AGENT}
            note={t("import.source.hermesNote")}
            icon={<HermesLogo className="agent-import-source-logo" />}
            onClick={props.onHermes}
          />
        </li>
        <li>
          <SourceButton
            title={GROK_BOT}
            note={t("import.source.grokNote")}
            icon={<ProviderLogo provider="grok" className="agent-import-source-logo" />}
            onClick={props.onGrok}
          />
        </li>
        <Show when={props.transfer}>
          <li>
            <SourceButton
              title={t("import.source.transfer")}
              note={t("import.source.transferNote")}
              icon={<Monitor className="agent-import-picker-icon" aria-hidden="true" />}
              onClick={props.onTransfer}
            />
          </li>
        </Show>
      </ul>
    </section>
  );
}

function SourceButton(props: { title: string; note: string; icon: JSX.Element; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      className="agent-import-picker agent-import-source"
      onClick={() => props.onClick()}
    >
      {props.icon}
      <span className="agent-import-picker-copy">
        <span className="agent-import-picker-title">{props.title}</span>
        <span className="agent-import-picker-meta">{props.note}</span>
      </span>
      <ChevronRight className="storage-row-chevron" aria-hidden="true" />
    </Button>
  );
}
