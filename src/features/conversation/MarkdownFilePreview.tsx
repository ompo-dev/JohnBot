import { Show } from "solid-js";
import type { AgentProfile } from "../../data";
import { useText } from "../../components/text";
import { MarkdownMessageText } from "./MarkdownMessageText";

export interface MarkdownFilePreviewProps {
  body: string;
  agents: AgentProfile[];
  loading?: boolean;
  error?: string | null;
  truncated?: boolean;
  className?: string;
  renderedClass: string;
  statusClass: string;
  truncatedClass: string;
  /** The quote id of the file. With it, a selection in the text opens the selection actions. */
  selectionQuoteId?: string | undefined;
  onSelectAgent: (agentId: string) => void;
  onOpenLink: (url: string) => void;
  onOpenSharedFile: (path: string) => void;
  /** Absent when no agent workspace can resolve a path, so a path stays text. */
  onOpenWorkspaceFile?: ((path: string) => void) | undefined;
}

/** The text limit of the callers that set `truncated`. */
const TRUNCATED_AFTER = 1_000_000;

export function MarkdownFilePreview(props: MarkdownFilePreviewProps) {
  const { t, format } = useText();
  const contentReady = () => props.loading !== true && !props.error;

  return (
    <div className={`markdown-file-preview${props.className ? ` ${props.className}` : ""}`}>
      <Show
        when={contentReady()}
        fallback={
          <pre className={props.statusClass}>
            {props.loading === true ? t("common.loading") : (props.error ?? t("preview.unavailable"))}
          </pre>
        }
      >
        <article className={props.renderedClass} data-selection-file-quote={props.selectionQuoteId}>
          <MarkdownMessageText
            body={props.body}
            agents={props.agents}
            attachments={[]}
            citations={[]}
            showCitationFooter={false}
            onSelectAgent={props.onSelectAgent}
            onOpenLink={props.onOpenLink}
            onOpenSharedFile={props.onOpenSharedFile}
            onOpenWorkspaceFile={props.onOpenWorkspaceFile}
          />
        </article>
        <Show when={props.truncated}>
          <p className={props.truncatedClass}>{t("preview.truncated", { limit: format.number(TRUNCATED_AFTER) })}</p>
        </Show>
      </Show>
    </div>
  );
}
