import type { FleetAttachmentAnalysis, FleetAttachmentInput } from "@johnbot/contracts/fleet";
import { Button, Field, Input } from "@johnbot/ui";
import { useText } from "@johnbot/ui/text";
import { createSignal, For, onSettled, Show } from "solid-js";
import { createScopeGuard } from "../../scope-lifetime";
import { TelemetryDailyChart } from "./TelemetryDailyChart";
import { TelemetryPreviewTable } from "./TelemetryPreviewTable";
import { readAttachmentFile } from "./telemetry-attachment-file";
import { analyzeNativeAttachment } from "./telemetry-native-port";

export interface TelemetryAttachment {
  readonly file: File;
  readonly input: FleetAttachmentInput;
  readonly analysis: FleetAttachmentAnalysis;
}

/** Selected files stay in this scope. Analysis never confirms an import. */
export function TelemetryAttachmentPanel(props: { onImport: (file: File) => void; importDisabled: boolean }) {
  const { t, errorMessage } = useText();
  const current = createScopeGuard();
  const [state, setState] = createSignal<{
    busy: boolean;
    items: readonly TelemetryAttachment[];
    errors: readonly string[];
  }>({ busy: false, items: [], errors: [] });
  let running = false,
    cancelled = false;
  let active: AbortController | null = null;
  const cancel = () => {
    cancelled = true;
    active?.abort();
  };
  onSettled(() => cancel);
  async function add(files: readonly File[]) {
    if (running) return;
    running = true;
    cancelled = false;
    const items = [...state().items],
      errors: string[] = [];
    setState({ busy: true, items, errors });
    try {
      for (const file of files) {
        if (cancelled || !current()) break;
        if (items.length >= 3) {
          errors.push(t("telemetry.attachments.limit"));
          break;
        }
        active = new AbortController();
        try {
          const input = await readAttachmentFile(file, active.signal);
          if (cancelled || !current()) break;
          const analysis = await analyzeNativeAttachment(input);
          if (cancelled || !current()) break;
          if (items.some((item) => item.analysis.digest === analysis.digest)) {
            errors.push(t("telemetry.attachments.duplicate", { filename: file.name }));
            continue;
          }
          items.push({ file, input, analysis });
        } catch (error) {
          if (!cancelled)
            errors.push(
              t("telemetry.attachments.fileFailed", {
                filename: file.name,
                reason: errorMessage(error, t("telemetry.attachments.failed")),
              }),
            );
        }
      }
    } finally {
      active = null;
      running = false;
      if (current()) setState({ busy: false, items: [...items], errors });
    }
  }
  return (
    <section
      className="telemetry-view"
      aria-label={t("telemetry.attachments.title")}
      onDragOver={(event) => {
        if (event.dataTransfer?.types.includes("Files")) event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        void add(Array.from(event.dataTransfer?.files ?? []));
      }}
    >
      <h2>{t("telemetry.attachments.title")}</h2>
      <p>{t("telemetry.attachments.local")}</p>
      <Field label={t("telemetry.attachments.choose")}>
        <Input
          type="file"
          multiple
          accept=".csv,.xlsx,.json,.pdf,.txt,.md,.markdown"
          disabled={state().busy}
          onChange={(event) => {
            const input = event.currentTarget;
            void add(Array.from(input.files ?? [])).finally(() => {
              input.value = "";
            });
          }}
        />
      </Field>
      <Show when={state().busy}>
        <p role="status">{t("telemetry.attachments.processing")}</p>
        <Button variant="outline" onClick={cancel}>
          {t("telemetry.attachments.cancel")}
        </Button>
      </Show>
      <For each={state().errors}>{(error) => <p role="alert">{error}</p>}</For>
      <For each={state().items}>
        {(item) => (
          <section aria-label={item.file.name}>
            <h3>{item.file.name}</h3>
            <p>
              {t("telemetry.attachments.text", {
                characters: item.analysis.characters,
                lines: item.analysis.lineCount,
              })}
            </p>
            <Show when={item.analysis.truncated}>
              <p>{t("telemetry.attachments.truncated")}</p>
            </Show>
            <Show when={item.analysis.kind === "telemetry" ? item.analysis : null}>
              {(analysis) => (
                <>
                  <p>
                    {t("telemetry.attachments.metrics", {
                      readings: analysis().summary.readings,
                      machines: analysis().summary.machines,
                      alerts: analysis().summary.alerts,
                    })}
                  </p>
                  <TelemetryDailyChart daily={analysis().daily} />
                  <TelemetryPreviewTable
                    caption={t("telemetry.attachments.sample")}
                    preview={{
                      filename: analysis().filename,
                      digest: analysis().digest,
                      counts: analysis().counts,
                      sample: analysis().sample,
                      issues: [],
                      machineCount: analysis().summary.machines,
                      alertReadingCount: analysis().summary.alerts,
                    }}
                  />
                  <Button disabled={props.importDisabled || state().busy} onClick={() => props.onImport(item.file)}>
                    {t("telemetry.attachments.prepare")}
                  </Button>
                </>
              )}
            </Show>
            <details>
              <summary>{t("telemetry.attachments.excerpt")}</summary>
              <pre className="telemetry-attachment-text">{item.analysis.previewText}</pre>
            </details>
            <Button
              variant="outline"
              disabled={state().busy}
              onClick={() =>
                setState((previous) => ({ ...previous, items: previous.items.filter((entry) => entry !== item) }))
              }
            >
              {t("telemetry.attachments.remove")}
            </Button>
          </section>
        )}
      </For>
    </section>
  );
}
