"use client";
import { useState, type FormEvent, type ReactNode } from "react";
import { Alert, Button, Input, NativeSelect, Checkbox } from "@johnbot/ui";
import { SettingsPanel } from "@johnbot/ui/SettingsPanel";
import type { TwinNode } from "../../john/john-data";
import type { Operations } from "../../contracts/operations";
import { useOperations } from "../../hooks/use-operations";
import { canAccess } from "../../lib/operations-model";

export interface PersonSettingsPanelProps {
  node: TwinNode;
  onClose: () => void;
  onWidthChange?: (width: number) => void;
}

export default function PersonSettingsPanel(props: PersonSettingsPanelProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const { data, error, saving, change } = useOperations();

  if (props.node.kind !== "person") {
    return (
      <PersonSettingsShell
        label={
          props.node.kind === "person" ? "Configurações da pessoa" : "Configurações da entidade"
        }
        onWidthChange={props.onWidthChange}
      >
        <header className="settings-panel-header">
          <h2 className="text-base font-semibold">{props.node.name}</h2>
          <p className="text-xs opacity-65">{props.node.detail}</p>
        </header>
        <div className="settings-panel-content flex flex-col gap-3">
          <p className="text-sm opacity-70">Entidade não pessoal · somente leitura</p>
          <div className="pt-2">
            <Button variant="outline" size="sm" type="button" onClick={props.onClose}>
              Fechar
            </Button>
          </div>
        </div>
      </PersonSettingsShell>
    );
  }

  if (!data) {
    return (
      <PersonSettingsShell
        label={
          props.node.kind === "person" ? "Configurações da pessoa" : "Configurações da entidade"
        }
        onWidthChange={props.onWidthChange}
      >
        <p role={error ? "alert" : "status"} className="text-sm">
          {error ?? "Carregando acesso da pessoa…"}
        </p>
      </PersonSettingsShell>
    );
  }

  const person = data.people.find((entry) => entry.id === props.node.id);
  if (!person) {
    return (
      <PersonSettingsShell
        label={
          props.node.kind === "person" ? "Configurações da pessoa" : "Configurações da entidade"
        }
        onWidthChange={props.onWidthChange}
      >
        <h2 className="text-base font-semibold">{props.node.name}</h2>
        <p className="text-sm opacity-65">Dados de acesso indisponíveis para esta pessoa.</p>
      </PersonSettingsShell>
    );
  }

  const admin = canAccess(data, data.viewerId, "admin", "organization:settings");

  const now = Date.now();
  const allApplicableRules = data.rules
    .filter(
      (rule) =>
        (rule.subjectKind === "person" && rule.subjectId === person.id) ||
        (rule.subjectKind === "sector" && person.sectorIds.includes(rule.subjectId)) ||
        (rule.subjectKind === "role" && person.roleIds.includes(rule.subjectId)),
    )
    .map((rule) => {
      const isExpired = rule.expiresAt ? new Date(rule.expiresAt).getTime() <= now : false;
      let sourceLabel = `Pessoa (${person.name})`;
      if (rule.subjectKind === "sector") {
        const sector = data.sectors.find((s) => s.id === rule.subjectId);
        sourceLabel = `Setor (${sector?.name ?? rule.subjectId})`;
      } else if (rule.subjectKind === "role") {
        const role = data.roles.find((r) => r.id === rule.subjectId);
        sourceLabel = `Cargo (${role?.name ?? rule.subjectId})`;
      }

      return {
        ...rule,
        sourceLabel,
        isExpired,
        isPersonal: rule.subjectKind === "person" && rule.subjectId === person.id,
      };
    });

  const submitMembership = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    await change({
      type: "person",
      person: {
        ...person,
        sectorIds: values.getAll("sector").map(String),
        roleIds: values.getAll("role").map(String),
      },
    });
  };

  const submitRule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const actions = values.getAll("action").map(String) as Operations["rules"][number]["actions"];
    const expires = String(values.get("expires") ?? "");
    if (!actions.length) {
      setFormError("Selecione pelo menos uma ação para a exceção.");
      return;
    }
    if (expires && !Number.isFinite(new Date(expires).getTime())) {
      setFormError("Informe uma expiração válida.");
      return;
    }
    setFormError(null);
    const ok = await change({
      type: "rule",
      rule: {
        id: crypto.randomUUID(),
        subjectKind: "person",
        subjectId: person.id,
        resource: String(values.get("resource")),
        actions,
        effect: String(values.get("effect")) as "allow" | "deny",
        sectorIds: [],
        reason: String(values.get("reason")),
        expiresAt: expires ? new Date(expires).toISOString() : null,
        approvedBy: data.viewerId,
      },
    });
    if (ok) form.reset();
  };

  return (
    <PersonSettingsShell
      label={props.node.kind === "person" ? "Configurações da pessoa" : "Configurações da entidade"}
      onWidthChange={props.onWidthChange}
    >
      <header className="settings-panel-header border-b  pb-3">
        <h2 className="text-lg font-semibold">{person.name}</h2>
        <p className="text-xs opacity-65">Pessoa · {props.node.detail}</p>
      </header>

      {!admin && (
        <div className="rounded-md border border-amber-500/20 bg-amber-500/10 p-2.5 text-xs text-amber-200">
          Somente leitura: você não tem acesso de administrador.
        </div>
      )}

      {(error || formError) && (
        <Alert role="alert" tone="danger">
          {formError ?? error}
        </Alert>
      )}

      <div className="settings-panel-content flex flex-col gap-6">
        {/* Setores e Cargos */}
        <section className="settings-link-section flex flex-col gap-3">
          <h3 className="settings-link-section-title text-sm font-semibold">Setores e cargos</h3>
          <form
            key={`${person.id}:${data.revision}`}
            className="settings-link-group settings-link-group-inset flex flex-col gap-3 rounded-lg border   p-3"
            onSubmit={submitMembership}
          >
            <fieldset className="flex flex-col gap-1.5">
              <legend className="text-xs font-medium opacity-65">Setores</legend>
              <div className="flex flex-wrap gap-3 pt-1">
                {data.sectors.map((item) => (
                  <label
                    key={item.id}
                    className="inline-flex cursor-pointer items-center gap-2 text-xs"
                  >
                    <Checkbox
                      disabled={!admin || saving}
                      name="sector"
                      value={item.id}
                      defaultChecked={person.sectorIds.includes(item.id)}
                    />

                    <span>{item.name}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="flex flex-col gap-1.5 pt-2">
              <legend className="text-xs font-medium opacity-65">Cargos</legend>
              <div className="flex flex-wrap gap-3 pt-1">
                {data.roles.map((item) => (
                  <label
                    key={item.id}
                    className="inline-flex cursor-pointer items-center gap-2 text-xs"
                  >
                    <Checkbox
                      disabled={!admin || saving}
                      name="role"
                      value={item.id}
                      defaultChecked={person.roleIds.includes(item.id)}
                    />

                    <span>{item.name}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {admin && (
              <div className="pt-2">
                <Button variant="outline" size="sm" type="submit" disabled={saving}>
                  Salvar vínculos
                </Button>
              </div>
            )}
          </form>
        </section>

        {/* Exceção pessoal (apenas admin) */}
        {admin && (
          <section className="settings-link-section flex flex-col gap-3">
            <h3 className="settings-link-section-title text-sm font-semibold">Exceção pessoal</h3>
            <form
              className="settings-link-group settings-link-group-inset flex flex-col gap-3 rounded-lg border   p-3"
              onSubmit={submitRule}
            >
              <div className="settings-field flex flex-col gap-1">
                <span className="text-xs font-medium opacity-65">Recurso</span>
                <Input name="resource" required placeholder="notebook:*" aria-label="Recurso" />
              </div>

              <fieldset className="flex flex-col gap-1.5">
                <legend className="text-xs font-medium opacity-65">Ações</legend>
                <div className="flex flex-wrap gap-2.5 pt-1">
                  {(["read", "write", "execute", "share", "admin"] as const).map((action) => (
                    <label
                      key={action}
                      className="inline-flex cursor-pointer items-center gap-1.5 text-xs"
                    >
                      <Checkbox name="action" value={action} defaultChecked={action === "read"} />

                      <span>{action}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="settings-field flex flex-col gap-1">
                <span className="text-xs font-medium opacity-65">Efeito</span>
                <NativeSelect
                  name="effect"
                  aria-label="Efeito"
                  className="ui-native-select h-8 rounded-md border  bg-transparent px-2 text-xs"
                >
                  <option value="allow">Permitir</option>
                  <option value="deny">Negar</option>
                </NativeSelect>
              </div>

              <div className="settings-field flex flex-col gap-1">
                <span className="text-xs font-medium opacity-65">Justificativa</span>
                <Input
                  name="reason"
                  required
                  placeholder="Justificativa da exceção"
                  aria-label="Justificativa"
                />
              </div>

              <div className="settings-field flex flex-col gap-1">
                <span className="text-xs font-medium opacity-65">Expiração (opcional)</span>
                <Input name="expires" type="datetime-local" aria-label="Expiração" />
              </div>

              <div className="pt-2">
                <Button variant="outline" size="sm" type="submit" disabled={saving}>
                  Adicionar exceção
                </Button>
              </div>
            </form>
          </section>
        )}

        {/* Regras herdadas e pessoais */}
        <section className="settings-link-section flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h3 className="settings-link-section-title text-sm font-semibold">
              Regras herdadas e pessoais
            </h3>
            <p className="text-xs opacity-65">Negativas prevalecem sobre permissões.</p>
          </div>

          <div className="settings-link-group settings-link-group-inset flex flex-col gap-2 rounded-lg border   p-3">
            {allApplicableRules.length === 0 ? (
              <p className="text-xs opacity-70">Nenhuma regra aplicável.</p>
            ) : (
              allApplicableRules.map((rule) => (
                <div key={rule.id} className="flex flex-col gap-1.5 rounded border   p-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">
                      {rule.effect === "deny" ? "⛔ Negar" : "✅ Permitir"} · {rule.resource}
                    </span>
                    {rule.isPersonal && admin ? (
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        disabled={saving || rule.id === "simulation-owner"}
                        onClick={() => void change({ type: "revoke-rule", ruleId: rule.id })}
                      >
                        Revogar
                      </Button>
                    ) : (
                      <span className="rounded  px-1.5 py-0.5 text-[10px] opacity-65">
                        Herdada (somente leitura)
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] opacity-65">
                    <span>Origem: {rule.sourceLabel}</span>
                    <span>·</span>
                    <span>Ações: {rule.actions.join(", ")}</span>
                    <span>·</span>
                    <span>
                      Status:{" "}
                      {rule.isExpired ? (
                        <span className="">Expirada</span>
                      ) : (
                        <span className="text-emerald-500">Ativa</span>
                      )}
                    </span>
                    {rule.expiresAt && (
                      <span>
                        ({rule.isExpired ? "Expirou em" : "Expira em"}{" "}
                        {new Date(rule.expiresAt).toLocaleString("pt-BR")})
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] opacity-65">
                    <span>Justificativa: {rule.reason}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <div className="pt-2">
          <Button variant="outline" size="sm" type="button" onClick={props.onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </PersonSettingsShell>
  );
}

function PersonSettingsShell({
  children,
  label,
  onWidthChange,
}: {
  children: ReactNode;
  label: string;
  onWidthChange?: (width: number) => void;
}) {
  const [width, setWidth] = useState(360);
  const resize = (value: number) => {
    setWidth(value);
    onWidthChange?.(value);
  };
  return (
    <SettingsPanel
      id="twin-person-settings"
      label={label}
      width={width}
      maxWidth={() => Math.max(360, window.innerWidth - 420)}
      onResize={resize}
      onResizeEnd={resize}
    >
      <div className="settings-panel-body p-4">{children}</div>
    </SettingsPanel>
  );
}
