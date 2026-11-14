import type { JSX } from "@solidjs/web";
import { Errored } from "solid-js";
import { useText } from "../../components/text";

/** A chat row that fails to draw shows a short notice, so the rest of the transcript stays usable. */
export function ChatRowBoundary(props: { children: JSX.Element }) {
  const { t } = useText();
  return <Errored fallback={<p className="chat-row-unavailable">{t("chat.row.unavailable")}</p>}>{props.children}</Errored>;
}
