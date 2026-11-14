import { Puzzle } from "@johnbot/ui";
import { createSignal, Show } from "solid-js";

export function SkillGlyph(props: { iconUrl: string | null }) {
  const [failedUrl, setFailedUrl] = createSignal<string | null>(null);
  const iconUrl = () => (props.iconUrl && failedUrl() !== props.iconUrl ? props.iconUrl : null);

  return (
    <span className="agent-skill-icon" aria-hidden="true">
      <Show when={iconUrl()} fallback={<Puzzle />} keyed>
        {(url) => <img src={url} alt="" onError={() => setFailedUrl(url)} />}
      </Show>
    </span>
  );
}
