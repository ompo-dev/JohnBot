import { Blocks, Puzzle } from "@johnbot/ui";
import { createMemo, createSignal, Show } from "solid-js";

/** A listing's icon, or a plugin or skill mark when it has none or it does not load. */
export function PluginIcon(props: { iconUrl: string | null; fallback?: "plugin" | "skill"; className?: string }) {
  const [failedUrl, setFailedUrl] = createSignal<string | null>(null);
  const iconUrl = createMemo(() => {
    const url = props.iconUrl;
    return url && failedUrl() !== url ? url : null;
  });
  return (
    <span className={props.className ? `skills-marketplace-icon ${props.className}` : "skills-marketplace-icon"}>
      <Show when={iconUrl()} fallback={props.fallback === "skill" ? <Blocks /> : <Puzzle />} keyed>
        {(url) => <img src={url} alt="" onError={() => setFailedUrl(url)} />}
      </Show>
    </span>
  );
}
