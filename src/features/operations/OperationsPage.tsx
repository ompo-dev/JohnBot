"use client";
import { useState } from "react";
import { Alert, Field, NativeSelect, Spinner } from "@johnbot/ui";
import { useOperations } from "../../hooks/use-operations";
import { useUrlSignal } from "../../lib/url-state";
import { DashboardView } from "./DashboardView";
import { AccessView } from "./AccessView";
import { SettingsPageFrame } from "../window/SettingsPageFrame";
import { SettingsDialogShell, type SettingsPagePlacement } from "../settings/SettingsDialogShell";
import type { Operations } from "../../contracts/operations";
import type { Change } from "./operations-ui";

export type OperationsView = "dashboard" | "access";

export function OperationsPage({ view }: { view: OperationsView }) {
  const { data, error, saving, change } = useOperations();
  if (view === "dashboard" && data)
    return (
      <DashboardView
        key={data.viewerId}
        state={data}
        change={change}
        saving={saving}
        error={error}
      />
    );
  if (view === "access" && data)
    return <AccessPage state={data} change={change} saving={saving} error={error} />;
  return (
    <section
      className="agent-usage"
      aria-label={view === "dashboard" ? "Dashboard pessoal" : "Organização e acesso"}
    >
      <header className="agent-usage-header">
        <h2>{view === "dashboard" ? "Dashboards" : "Organização e acesso"}</h2>
      </header>
      <div className="agent-usage-body">
        {error ? (
          <Alert tone="danger" role="alert">
            {error}
          </Alert>
        ) : (
          <div className="agent-usage-loading">
            <Spinner label="Carregando espaço de trabalho" />
            <div className="agent-usage-placeholder" />
          </div>
        )}
      </div>
    </section>
  );
}

function AccessPage({
  state,
  change,
  saving,
  error,
}: {
  state: Operations;
  change: Change;
  saving: boolean;
  error: string | null;
}) {
  const [mounts, setMounts] = useState<SettingsPagePlacement>();
  const [, setPage] = useUrlSignal("page");
  return (
    <>
      <SettingsPageFrame
        heading={
          <h1 className="settings-page-title" tabIndex={-1}>
            Organização e acesso
          </h1>
        }
        onMounts={setMounts}
        onEscape={() => setPage("agents")}
      />
      <SettingsDialogShell
        open
        title="Organização e acesso"
        description="Pessoas, setores, cargos e permissões do John Twin."
        contentKey={state.viewerId}
        page={mounts}
        sidebar={
          <Field label="Visão da pessoa">
            <NativeSelect
              aria-label="Simular a visão de uma pessoa"
              value={state.viewerId}
              disabled={saving}
              onChange={(event) => void change({ type: "viewer", personId: event.target.value })}
            >
              {state.people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        }
      >
        {error && (
          <Alert tone="danger" role="alert">
            {error}
          </Alert>
        )}
        <AccessView
          key={state.viewerId}
          state={state}
          change={change}
          saving={saving}
          navMount={mounts?.nav}
        />
      </SettingsDialogShell>
    </>
  );
}
