import { type FleetEditInput, type FleetReading, FleetSensor } from "@johnbot/contracts/fleet";
import { Button, Field, Input, NativeSelect, Textarea } from "@johnbot/ui";
import { useText } from "@johnbot/ui/text";
import { Schema } from "effect";
import { createSignal, For, Show } from "solid-js";
import { createScopeGuard } from "../../scope-lifetime";
import { useTelemetry } from "./telemetry-context";
import { loadNativeFleetPage, NativeFleetError, saveNativeFleetEdit } from "./telemetry-native-port";

interface EditState {
  id: string;
  sensor: typeof FleetSensor.Type;
  value: string;
  missing: boolean;
  reason: string;
  reading: FleetReading | null;
  proposal: FleetEditInput | null;
  status: "idle" | "loading" | "saving" | "saved" | "invalid" | "conflict" | "failed";
}

/** A reviewed proposal is separate from its confirmed write. Expected versions protect stale forms. */
export function TelemetryEditForm() {
  const { t } = useText();
  const data = useTelemetry();
  const current = createScopeGuard();
  const initial: EditState = {
    id: "",
    sensor: "temperature",
    value: "",
    missing: false,
    reason: "",
    reading: null,
    proposal: null,
    status: "idle",
  };
  const [state, setState] = createSignal(initial);
  let generation = 0;
  const labels = () => ({
    temperature: t("telemetry.temperature"),
    oilPressure: t("telemetry.sensor.oilPressure"),
    rpm: t("telemetry.sensor.rpm"),
    vibration: t("telemetry.vibration"),
    consumption: t("telemetry.sensor.consumption"),
    engineHours: t("telemetry.sensor.engineHours"),
  });
  const busy = () => state().status === "loading" || state().status === "saving";
  function errorText() {
    switch (state().status) {
      case "invalid":
        return t("telemetry.edit.invalid");
      case "conflict":
        return t("telemetry.edit.conflict");
      case "failed":
        return t("telemetry.edit.failed");
      default:
        return null;
    }
  }
  async function load() {
    const id = Number(state().id);
    if (!Number.isSafeInteger(id) || id <= 0) {
      setState((previous) => ({ ...previous, status: "invalid" }));
      return;
    }
    const request = ++generation;
    setState((previous) => ({ ...previous, status: "loading", proposal: null }));
    try {
      const page = await loadNativeFleetPage({ workspaceId: data.workspaceId(), readingId: id, limit: 1 });
      if (!current() || request !== generation) return;
      const reading = page.readings.find((row) => row.id === id);
      if (!reading) {
        setState((previous) => ({ ...previous, reading: null, status: "invalid" }));
        return;
      }
      setState((previous) => ({
        ...previous,
        reading,
        value: reading[previous.sensor] === null ? "" : String(reading[previous.sensor]),
        missing: reading[previous.sensor] === null,
        status: "idle",
      }));
    } catch {
      if (current() && request === generation) setState((previous) => ({ ...previous, status: "failed" }));
    }
  }
  function review() {
    const draft = state();
    if (!draft.reading || !draft.reason.trim()) {
      setState((previous) => ({ ...previous, status: "invalid" }));
      return;
    }
    const value = draft.missing ? null : Number(draft.value.trim().replace(",", "."));
    if (
      (!draft.missing && !draft.value.trim()) ||
      (value !== null && (!Number.isFinite(value) || value === -999 || (draft.sensor !== "temperature" && value < 0)))
    ) {
      setState((previous) => ({ ...previous, status: "invalid" }));
      return;
    }
    const proposal: FleetEditInput = {
      workspaceId: data.workspaceId(),
      id: draft.reading.id,
      expectedVersion: draft.reading.version,
      sensor: draft.sensor,
      value,
      reason: draft.reason.trim(),
      idempotencyKey: crypto.randomUUID(),
    };
    setState((previous) => ({ ...previous, proposal, status: "idle" }));
  }
  async function confirm() {
    const proposal = state().proposal;
    if (!proposal || busy()) return;
    setState((previous) => ({ ...previous, status: "saving" }));
    try {
      const result = await saveNativeFleetEdit(proposal);
      if (!current()) return;
      setState((previous) => ({ ...previous, reading: result.reading, proposal: null, status: "saved" }));
      await data.refresh();
    } catch (error) {
      if (current())
        setState((previous) => ({
          ...previous,
          status: error instanceof NativeFleetError && error.code === "version_conflict" ? "conflict" : "failed",
        }));
    }
  }
  return (
    <section className="telemetry-view" aria-label={t("telemetry.edit.title")}>
      <h2>{t("telemetry.edit.title")}</h2>
      <Show when={state().reading}>
        {(reading) => <p>{t("telemetry.edit.loaded", { id: reading().id, version: reading().version })}</p>}
      </Show>
      <div className="telemetry-filters">
        <Field label={t("telemetry.edit.id")}>
          <Input
            type="number"
            min="1"
            step="1"
            value={state().id}
            disabled={busy()}
            onInput={(event) => {
              generation += 1;
              const id = event.currentTarget.value;
              setState((previous) => ({ ...previous, id, reading: null, proposal: null, status: "idle" }));
            }}
          />
        </Field>
        <Button variant="outline" disabled={busy()} onClick={() => void load()}>
          {t("telemetry.edit.load")}
        </Button>
        <Field label={t("telemetry.edit.sensor")}>
          <NativeSelect
            value={state().sensor}
            disabled={busy()}
            onChange={(event) => {
              const sensor = Schema.decodeUnknownSync(FleetSensor)(event.currentTarget.value);
              setState((previous) => {
                const value = previous.reading?.[sensor] ?? null;
                return {
                  ...previous,
                  sensor,
                  value: value === null ? "" : String(value),
                  missing: value === null,
                  proposal: null,
                  status: "idle",
                };
              });
            }}
          >
            <For each={FleetSensor.literals}>{(sensor) => <option value={sensor}>{labels()[sensor]}</option>}</For>
          </NativeSelect>
        </Field>
        <Field label={t("telemetry.edit.presence")}>
          <NativeSelect
            value={state().missing ? "missing" : "value"}
            disabled={busy()}
            onChange={(event) => {
              const missing = event.currentTarget.value === "missing";
              setState((previous) => ({ ...previous, missing, proposal: null, status: "idle" }));
            }}
          >
            <option value="value">{t("telemetry.edit.present")}</option>
            <option value="missing">{t("telemetry.missing")}</option>
          </NativeSelect>
        </Field>
        <Field label={t("telemetry.edit.value")}>
          <Input
            inputmode="decimal"
            value={state().value}
            disabled={busy() || state().missing}
            onInput={(event) => {
              const value = event.currentTarget.value;
              setState((previous) => ({ ...previous, value, proposal: null, status: "idle" }));
            }}
          />
        </Field>
      </div>
      <Field label={t("telemetry.edit.reason")}>
        <Textarea
          value={state().reason}
          maxLength={500}
          disabled={busy()}
          onInput={(event) => {
            const reason = event.currentTarget.value;
            setState((previous) => ({ ...previous, reason, proposal: null, status: "idle" }));
          }}
        />
      </Field>
      <div className="telemetry-actions">
        <Button variant="outline" disabled={!state().reading || busy()} onClick={review}>
          {t("telemetry.edit.review")}
        </Button>
        <Button disabled={!state().proposal || busy()} onClick={() => void confirm()}>
          {t("telemetry.edit.confirm")}
        </Button>
      </div>
      <Show when={state().proposal}>
        {(proposal) => (
          <p>
            {t("telemetry.edit.proposal", {
              id: proposal().id,
              sensor: labels()[proposal().sensor],
              before: state().reading?.[proposal().sensor] ?? t("telemetry.missing"),
              after: proposal().value ?? t("telemetry.missing"),
              version: proposal().expectedVersion,
            })}
          </p>
        )}
      </Show>
      <Show when={errorText()}>{(message) => <p role="alert">{message()}</p>}</Show>
      <Show when={state().status === "saved"}>
        <p role="status">{t("telemetry.edit.saved")}</p>
      </Show>
    </section>
  );
}
