import { FleetEngineResponse, FleetImportJob, FleetImportReceipt, FleetPreview } from "@johnbot/contracts/fleet";
import { isDynamicRecord, isOneOf } from "@johnbot/contracts/runtime-values";
import { Button, Field, Input } from "@johnbot/ui";
import { useText } from "@johnbot/ui/text";
import { Channel, invoke } from "@tauri-apps/api/core";
import { Schema } from "effect";
import { createEffect, createSignal, onSettled, Show } from "solid-js";
import { createScopeGuard } from "../../scope-lifetime";
import { TelemetryAttachmentPanel } from "./TelemetryAttachmentPanel";
import { TelemetryEditForm } from "./TelemetryEditForm";
import { TelemetryJobsPanel } from "./TelemetryJobsPanel";
import { TelemetryPreviewTable } from "./TelemetryPreviewTable";
import { TelemetryReportPanel } from "./TelemetryReportPanel";
import { TelemetryView } from "./TelemetryView";
import { TelemetryProvider, useTelemetry } from "./telemetry-context";
import { readTelemetryFile } from "./telemetry-file";
import { nativeTelemetryPort } from "./telemetry-native-port";

const phases = ["selecting", "reading", "preparing", "finished"] as const;
type Phase = (typeof phases)[number];
type State = {
  status: "checking" | "ready" | "busy" | "failed";
  preview: typeof FleetPreview.Type | null;
  previewId: string | null;
  commandKey: string | null;
  receipt: typeof FleetImportReceipt.Type | null;
  job: typeof FleetImportJob.Type | null;
  persistence: boolean;
  phase: Phase;
  error: string | null;
};
const decode = Schema.decodeUnknownSync(FleetEngineResponse);

function NativeDataPanel(props: { refreshToken: number }) {
  const data = useTelemetry();
  createEffect(
    () => props.refreshToken,
    () => {
      void data.refresh();
    },
    { defer: true },
  );
  return (
    <>
      <TelemetryView />
      <TelemetryReportPanel refreshToken={props.refreshToken} />
      <TelemetryEditForm />
    </>
  );
}

/** The native host owns confirmed commands and background work. */
export function TelemetryNativeApp() {
  const { t, errorMessage } = useText();
  const current = createScopeGuard();
  const initial: State = {
    status: "checking",
    preview: null,
    previewId: null,
    commandKey: null,
    receipt: null,
    job: null,
    persistence: false,
    phase: "selecting",
    error: null,
  };
  const [state, setState] = createSignal<State>(initial);
  const [refreshToken, setRefreshToken] = createSignal(0);
  const port = nativeTelemetryPort();
  const progressText = () =>
    ({
      selecting: t("telemetry.native.progress.selecting"),
      reading: t("telemetry.native.progress.reading"),
      preparing: t("telemetry.native.progress.preparing"),
      finished: t("telemetry.native.progress.finished"),
    })[state().phase];
  async function check() {
    setState(initial);
    try {
      const response = decode(await invoke<unknown>("engine_health"));
      if (!response.ok || !("ready" in response.value) || !response.value.ready)
        throw new Error("Invalid health response.");
      if (current()) setState({ ...initial, status: "ready", persistence: response.value.persistence });
    } catch {
      if (current()) setState({ ...initial, status: "failed" });
    }
  }
  onSettled(() => {
    void check();
  });
  async function preview(file: File) {
    if (state().status === "busy" || state().status === "checking") return;
    setState((previous) => ({ ...initial, persistence: previous.persistence, status: "busy", phase: "reading" }));
    const progress = new Channel<unknown>();
    progress.onmessage = (message) => {
      if (current() && isDynamicRecord(message) && isOneOf(phases, message.phase)) {
        const phase = message.phase;
        setState((previous) => ({ ...previous, phase }));
      }
    };
    try {
      const input = await readTelemetryFile(file);
      const raw = await invoke<unknown>("prepare_import", { input, progress });
      if (!current()) return;
      const response = decode(raw);
      if (!response.ok) {
        setState((previous) => ({
          ...initial,
          persistence: previous.persistence,
          status: "failed",
          error: errorMessage(new Error(response.error.message), t("telemetry.native.failed")),
        }));
        return;
      }
      const result = Schema.decodeUnknownSync(FleetPreview)(response.value);
      setState((previous) => ({
        ...previous,
        status: "ready",
        preview: result,
        previewId: response.id,
        commandKey: crypto.randomUUID(),
        phase: "finished",
      }));
    } catch {
      if (current()) setState((previous) => ({ ...initial, persistence: previous.persistence, status: "failed" }));
    }
  }
  async function confirm(background = false) {
    const pending = state();
    if (
      pending.status !== "ready" ||
      !pending.persistence ||
      !pending.previewId ||
      !pending.commandKey ||
      pending.receipt ||
      pending.job
    )
      return;
    setState((previous) => ({ ...previous, status: "busy", phase: "preparing" }));
    try {
      const response = decode(
        await invoke<unknown>("confirm_import", {
          input: { workspaceId: "local", previewId: pending.previewId, idempotencyKey: pending.commandKey, background },
        }),
      );
      if (!response.ok) throw new Error("Confirmation refused.");
      const receipt = background ? null : Schema.decodeUnknownSync(FleetImportReceipt)(response.value);
      const job = background ? Schema.decodeUnknownSync(FleetImportJob)(response.value) : null;
      if (current()) {
        setState((previous) => ({ ...previous, status: "ready", receipt, job, phase: "finished" }));
        setRefreshToken((version) => version + 1);
      }
    } catch {
      if (current()) setState((previous) => ({ ...previous, status: "failed" }));
    }
  }
  return (
    <main className="telemetry-page">
      <header>
        <h1>{t("telemetry.title")}</h1>
        <p>{t("telemetry.native.description")}</p>
      </header>
      <Show when={state().status === "checking"}>
        <p role="status">{t("telemetry.native.checking")}</p>
      </Show>
      <Show when={state().status === "ready"}>
        <p role="status">{t("telemetry.native.ready")}</p>
      </Show>
      <Show when={state().status === "busy"}>
        <p role="status">{progressText()}</p>
      </Show>
      <Show when={state().status === "failed"}>
        <p role="alert">{state().error ?? t("telemetry.native.failed")}</p>
      </Show>
      <Show when={state().status !== "checking" && !state().persistence}>
        <p>{t("telemetry.native.databaseUnavailable")}</p>
      </Show>
      <Field label={t("telemetry.native.choose")}>
        <Input
          type="file"
          accept=".csv,.xlsx,.json"
          disabled={state().status === "busy" || state().status === "checking"}
          onChange={(event) => {
            const element = event.currentTarget;
            const file = element.files?.item(0);
            if (file)
              void preview(file).finally(() => {
                element.value = "";
              });
          }}
        />
      </Field>
      <div className="telemetry-actions">
        <Button
          disabled={
            state().status !== "ready" ||
            !state().persistence ||
            !state().preview ||
            state().receipt !== null ||
            state().job !== null
          }
          onClick={() => void confirm()}
        >
          {t("telemetry.native.confirm")}
        </Button>
        <Button
          variant="outline"
          disabled={
            state().status !== "ready" ||
            !state().persistence ||
            !state().preview ||
            state().receipt !== null ||
            state().job !== null
          }
          onClick={() => void confirm(true)}
        >
          {t("telemetry.jobs.confirm")}
        </Button>
        <Button
          variant="outline"
          disabled={state().status === "busy" || state().status === "checking"}
          onClick={() => void check()}
        >
          {t("telemetry.native.check")}
        </Button>
      </div>
      <Show when={state().preview}>
        {(result) => (
          <section aria-label={t("telemetry.native.preview")}>
            <h2>{t("telemetry.native.preview")}</h2>
            <p>{result().filename}</p>
            <TelemetryPreviewTable preview={result()} />
            <p>
              {t("telemetry.native.summary", {
                received: result().counts.received,
                unique: result().counts.unique,
                invalid: result().counts.invalid,
                duplicate: result().counts.duplicate,
              })}
            </p>
            <Show when={!state().receipt && !state().job}>
              <p>{t("telemetry.native.readonly")}</p>
            </Show>
          </section>
        )}
      </Show>
      <Show when={state().receipt}>
        {(receipt) => (
          <p role="status">
            {t("telemetry.native.imported", { inserted: receipt().inserted, preserved: receipt().preserved })}
          </p>
        )}
      </Show>
      <TelemetryAttachmentPanel
        onImport={(file) => void preview(file)}
        importDisabled={state().status === "busy" || state().status === "checking"}
      />
      <Show when={state().persistence}>
        <TelemetryJobsPanel refreshToken={refreshToken()} onChanged={() => setRefreshToken((version) => version + 1)} />
        <TelemetryProvider workspaceId="local" port={port}>
          <NativeDataPanel refreshToken={refreshToken()} />
        </TelemetryProvider>
      </Show>
    </main>
  );
}
