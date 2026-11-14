import type { BrowserPreview } from "@johnbot/contracts/ipc";
import { Monitor, Skeleton } from "@johnbot/ui";
import { useText } from "@johnbot/ui/text";
import { Show } from "solid-js";

export function BrowserTakeoverPreview(props: {
  preview: BrowserPreview | null;
  previewStatus: "idle" | "loading" | "ready" | "failed";
  page: { title: string; host: string };
}) {
  const { t } = useText();
  return (
    <Show
      when={props.previewStatus === "ready" ? props.preview : null}
      fallback={
        <Show
          when={props.previewStatus === "loading" || props.previewStatus === "idle"}
          fallback={
            <div className="browser-takeover-preview-fallback">
              <Monitor aria-hidden="true" />
              <strong>{props.page.title}</strong>
              <span>{props.page.host}</span>
            </div>
          }
        >
          <Skeleton className="browser-takeover-preview-skeleton" />
        </Show>
      }
    >
      {(preview) => (
        <img
          src={preview().dataUrl}
          width={preview().width}
          height={preview().height}
          alt={t("browser.preview.image", { title: props.page.title })}
        />
      )}
    </Show>
  );
}
