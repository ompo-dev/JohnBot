import { Field, Input } from "@johnbot/ui";
import { useText } from "@johnbot/ui/text";
import { createSignal, Show } from "solid-js";
import { TelemetryView } from "./TelemetryView";
import { TelemetryProvider } from "./telemetry-context";

/** Native desktop entry for the telemetry slice, independent of account/provider startup in the chat UI. */
export function TelemetryApp() {
  const { t } = useText();
  const [workspaceId, setWorkspaceId] = createSignal("local");
  return (
    <main className="telemetry-page">
      <header>
        <h1>{t("telemetry.title")}</h1>
        <p>{t("telemetry.pilot")}</p>
      </header>
      <Field label={t("telemetry.workspace")}>
        <Input
          value={workspaceId()}
          onChange={(event) => {
            if (event.currentTarget.value.trim()) setWorkspaceId(event.currentTarget.value.trim());
          }}
        />
      </Field>
      <Show keyed when={workspaceId()}>
        {(workspace) => (
          <TelemetryProvider workspaceId={workspace}>
            <TelemetryView />
          </TelemetryProvider>
        )}
      </Show>
    </main>
  );
}
