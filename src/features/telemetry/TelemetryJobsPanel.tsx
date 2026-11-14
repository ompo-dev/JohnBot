import type { FleetImportJob } from "@johnbot/contracts/fleet";
import { Button } from "@johnbot/ui";
import { useText } from "@johnbot/ui/text";
import { createEffect, createSignal, For, onSettled, Show } from "solid-js";
import { createScopeGuard } from "../../scope-lifetime";
import { loadNativeFleetJobs, retryNativeFleetJob, subscribeNativeFleet } from "./telemetry-native-port";

const STATUS = {
  queued: "telemetry.jobs.queued",
  running: "telemetry.jobs.running",
  succeeded: "telemetry.jobs.succeeded",
  failed: "telemetry.jobs.failed",
} as const;

/** Keeps job history independent of file selection. Polling also works while Redis is unavailable. */
export function TelemetryJobsPanel(props: { refreshToken: number; onChanged: () => void }) {
  const { t } = useText();
  const current = createScopeGuard();
  const [state, setState] = createSignal<{ jobs: readonly FleetImportJob[]; failed: boolean; retrying: string | null }>(
    { jobs: [], failed: false, retrying: null },
  );
  const keys = new Map<string, string>();
  let pending = false;
  async function refresh() {
    if (pending || !current()) return;
    pending = true;
    try {
      const page = await loadNativeFleetJobs("local");
      if (!current()) return;
      const previous = new Map(state().jobs.map((job) => [job.id, job.state]));
      setState((value) => ({ ...value, jobs: page.jobs, failed: false }));
      if (page.jobs.some((job) => job.state === "succeeded" && previous.get(job.id) !== "succeeded")) props.onChanged();
    } catch {
      if (current()) setState((value) => ({ ...value, failed: true }));
    } finally {
      pending = false;
    }
  }
  async function retry(job: FleetImportJob) {
    if (state().retrying || job.state !== "failed") return;
    let key = keys.get(job.id);
    if (!key) {
      key = crypto.randomUUID();
      keys.set(job.id, key);
    }
    setState((value) => ({ ...value, retrying: job.id }));
    try {
      await retryNativeFleetJob({ workspaceId: "local", jobId: job.id, idempotencyKey: key });
      keys.delete(job.id);
      await refresh();
    } catch {
      if (current()) setState((value) => ({ ...value, failed: true }));
    } finally {
      if (current()) setState((value) => ({ ...value, retrying: null }));
    }
  }
  createEffect(
    () => props.refreshToken,
    () => {
      void refresh();
    },
    { defer: true },
  );
  onSettled(() => {
    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    void refresh();
    const timer = setInterval(() => {
      if (state().failed || state().jobs.some((job) => job.state === "queued" || job.state === "running"))
        void refresh();
    }, 1500);
    void subscribeNativeFleet("local", () => {
      props.onChanged();
      void refresh();
    })
      .then((stop) => {
        if (disposed) stop();
        else unsubscribe = stop;
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
      clearInterval(timer);
      unsubscribe?.();
    };
  });
  return (
    <section aria-label={t("telemetry.jobs.title")}>
      <h2>{t("telemetry.jobs.title")}</h2>
      <Show when={state().failed}>
        <p role="alert">{t("telemetry.jobs.loadFailed")}</p>
      </Show>
      <Button variant="outline" onClick={() => void refresh()}>
        {t("telemetry.jobs.refresh")}
      </Button>
      <Show when={state().jobs.length === 0}>
        <p>{t("telemetry.jobs.empty")}</p>
      </Show>
      <ul>
        <For each={state().jobs}>
          {(job) => (
            <li>
              <p>
                {job.filename} · {t(STATUS[job.state])} · {t("telemetry.jobs.attempts", { attempts: job.attempts })}
              </p>
              <Show when={job.result}>
                {(result) => (
                  <p>
                    {t("telemetry.native.imported", { inserted: result().inserted, preserved: result().preserved })}
                  </p>
                )}
              </Show>
              <Show when={job.state === "failed"}>
                <Button variant="outline" disabled={state().retrying !== null} onClick={() => void retry(job)}>
                  {t("telemetry.jobs.retry")}
                </Button>
              </Show>
            </li>
          )}
        </For>
      </ul>
    </section>
  );
}
