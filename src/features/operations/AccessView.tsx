"use client";
import { useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { History, Shield, Users } from "lucide-react";
import type { Operations } from "../../contracts/operations";
import { canAccess } from "../../lib/operations-model";
import { DataTable, type Change } from "./operations-ui";
import {
  Alert,
  Button,
  Checkbox,
  Input,
  ItemGroup,
  NativeSelect,
  SettingsSection,
} from "@johnbot/ui";

function AccessView({
  state,
  change,
  saving,
  navMount,
}: {
  state: Operations;
  change: Change;
  saving: boolean;
  navMount?: HTMLElement;
}) {
  const admin = canAccess(state, state.viewerId, "admin", "organization:settings");
  const [tab, setTab] = useState("people");
  const [failure, setFailure] = useState<string | null>(null);
  const [personId, setPersonId] = useState(state.viewerId);
  const person = state.people.find((entry) => entry.id === personId)!;
  async function saveMembership(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await change({
      type: "person",
      person: {
        ...person,
        sectorIds: data.getAll("sectors").map(String),
        roleIds: data.getAll("roles").map(String),
        reportsTo: data.getAll("managers").map(String),
      },
    });
  }
  async function saveRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget,
      data = new FormData(form),
      subject = String(data.get("subject")).split("|");
    const actions = data.getAll("actions").map(String) as Operations["rules"][number]["actions"];
    const expiry = data.get("expires") ? new Date(String(data.get("expires"))) : null;
    if (
      !actions.length ||
      (expiry && (!Number.isFinite(expiry.getTime()) || expiry.getTime() <= Date.now()))
    ) {
      setFailure("Selecione uma ação e uma expiração futura válida.");
      return;
    }
    setFailure(null);
    if (
      await change({
        type: "rule",
        rule: {
          id: crypto.randomUUID(),
          subjectKind: subject[0] as "person" | "sector" | "role",
          subjectId: subject[1] ?? "",
          resource: String(data.get("resource")),
          actions,
          effect: String(data.get("effect")) as "allow" | "deny",
          sectorIds: [],
          reason: String(data.get("reason")),
          expiresAt: expiry?.toISOString() ?? null,
          approvedBy: state.viewerId,
        },
      })
    )
      form.reset();
  }
  const navigation = (
    <nav className="settings-modal-nav" aria-label="Seções de organização e acesso">
      {[
        ["people", "Pessoas e vínculos"],
        ["rules", "Permissões e exceções"],
        ["audit", "Auditoria"],
      ].map(([id, label]) => (
        <Button
          key={id}
          size="sm"
          variant={tab === id ? "secondary" : "ghost"}
          className="settings-modal-nav-item"
          aria-current={tab === id ? "page" : undefined}
          aria-pressed={tab === id}
          onClick={() => setTab(id)}
        >
          {id === "people" ? (
            <Users aria-hidden="true" />
          ) : id === "rules" ? (
            <Shield aria-hidden="true" />
          ) : (
            <History aria-hidden="true" />
          )}
          <span>{label}</span>
        </Button>
      ))}
    </nav>
  );
  return (
    <>
      {navMount
        ? createPortal(<div className="settings-page-nav-group">{navigation}</div>, navMount)
        : navigation}
      {failure && (
        <Alert tone="danger" role="alert">
          {failure}
        </Alert>
      )}
      <p className="mb-4 text-sm opacity-65">
        Políticas do workspace de simulação. A seleção de pessoa não é autenticação de produção.
        Negativas prevalecem; exceções expiram no servidor.
      </p>
      {tab === "people" && (
        <SettingsSection
          title="Pessoas e vínculos"
          description="Uma pessoa pode pertencer a vários setores e cargos."
        >
          <DataTable
            headers={["Pessoa", "Setores", "Cargos", "Responde a"]}
            rows={state.people.map((entry) => [
              entry.name,
              entry.sectorIds
                .map((id) => state.sectors.find((sector) => sector.id === id)?.name ?? id)
                .join(", "),
              entry.roleIds
                .map((id) => state.roles.find((role) => role.id === id)?.name ?? id)
                .join(", "),
              entry.reportsTo
                .map((id) => state.people.find((person) => person.id === id)?.name ?? id)
                .join(", "),
            ])}
          />
          {admin && (
            <div className="mt-6">
              <form className="settings-modal-card grid gap-3 p-4" onSubmit={saveMembership}>
                <h2 className="font-medium">Vínculos múltiplos</h2>
                <NativeSelect
                  value={personId}
                  aria-label="Pessoa a editar"
                  disabled={saving}
                  onChange={(event) => setPersonId(event.target.value)}
                >
                  {state.people.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </NativeSelect>
                <div key={`${person.id}:${state.revision}`} className="grid gap-4 sm:grid-cols-3">
                  {[
                    ["sectors", "Setores", state.sectors, person.sectorIds],
                    ["roles", "Cargos", state.roles, person.roleIds],
                    [
                      "managers",
                      "Responsáveis",
                      state.people.filter((entry) => entry.id !== person.id),
                      person.reportsTo,
                    ],
                  ].map(([name, label, options, checked]) => (
                    <fieldset key={String(name)} className="max-h-64 overflow-auto">
                      <legend className="mb-2 text-sm font-medium">{String(label)}</legend>
                      {(options as { id: string; name: string }[]).map((option) => (
                        <label key={option.id} className="mb-2 flex gap-2 text-xs">
                          <Checkbox
                            name={String(name)}
                            value={option.id}
                            defaultChecked={(checked as string[]).includes(option.id)}
                          />
                          {option.name}
                        </label>
                      ))}
                    </fieldset>
                  ))}
                </div>
                <Button type="submit" variant="outline" size="sm" disabled={saving}>
                  Salvar vínculos
                </Button>
              </form>
            </div>
          )}
        </SettingsSection>
      )}
      {tab === "rules" && (
        <SettingsSection
          title="Permissões e exceções"
          description="Regras por pessoa, setor ou cargo. Negativas prevalecem sobre permissões."
        >
          {admin && (
            <ItemGroup>
              <form className="settings-modal-card grid gap-3 p-4" onSubmit={saveRule}>
                <h2 className="font-medium">Permissão ou exceção</h2>
                <NativeSelect name="subject" aria-label="Destinatário">
                  {[
                    ["person", state.people],
                    ["sector", state.sectors],
                    ["role", state.roles],
                  ].flatMap(([kind, entries]) =>
                    (entries as { id: string; name: string }[]).map((entry) => (
                      <option key={`${kind}:${entry.id}`} value={`${kind}|${entry.id}`}>
                        {String(kind)}: {entry.name}
                      </option>
                    )),
                  )}
                </NativeSelect>
                <Input
                  name="resource"
                  aria-label="Recurso"
                  placeholder="connector:whatsapp, table:machine-downtime, notebook:*"
                  required
                />
                <fieldset className="flex flex-wrap gap-3">
                  <legend className="mb-2 text-sm">Ações</legend>
                  {["read", "write", "execute", "share", "admin"].map((action) => (
                    <label key={action} className="text-xs">
                      <Checkbox name="actions" value={action} defaultChecked={action === "read"} />{" "}
                      {action}
                    </label>
                  ))}
                </fieldset>
                <NativeSelect name="effect" aria-label="Efeito">
                  <option value="allow">Permitir</option>
                  <option value="deny">Negar</option>
                </NativeSelect>
                <Input
                  name="reason"
                  placeholder="Justificativa obrigatória"
                  aria-label="Justificativa"
                  required
                  maxLength={500}
                />
                <label className="text-xs">
                  Expiração opcional <Input name="expires" type="datetime-local" />
                </label>
                <Button type="submit" variant="outline" size="sm" disabled={saving}>
                  Salvar política
                </Button>
              </form>
            </ItemGroup>
          )}
          <h3 className="mb-3 mt-5 font-medium">Políticas visíveis</h3>
          <DataTable
            headers={["Destinatário", "Recurso", "Efeito", "Ações", "Expira", "Controle"]}
            rows={state.rules.map((rule) => [
              (rule.subjectKind === "person"
                ? state.people
                : rule.subjectKind === "sector"
                  ? state.sectors
                  : state.roles
              ).find((entry) => entry.id === rule.subjectId)?.name ?? rule.subjectId,
              rule.resource,
              rule.effect === "allow" ? "Permitir" : "Negar",
              rule.actions.join(", "),
              rule.expiresAt ? new Date(rule.expiresAt).toLocaleString("pt-BR") : "Sem expiração",
              admin ? (
                <Button
                  key={rule.id}
                  variant="outline"
                  size="sm"
                  disabled={saving || rule.id === "simulation-owner"}
                  onClick={() => void change({ type: "revoke-rule", ruleId: rule.id })}
                >
                  Revogar
                </Button>
              ) : (
                "Consulta"
              ),
            ])}
          />
        </SettingsSection>
      )}
      {tab === "audit" && (
        <SettingsSection
          title="Auditoria da simulação"
          description="Histórico de alterações e seus responsáveis."
        >
          <DataTable
            headers={["Quando", "Pessoa", "Ação", "Recurso"]}
            rows={[...state.audit]
              .reverse()
              .slice(0, 100)
              .map((event) => [
                new Date(event.at).toLocaleString("pt-BR"),
                state.people.find((person) => person.id === event.actorId)?.name ?? event.actorId,
                event.action,
                event.resource,
              ])}
          />
        </SettingsSection>
      )}
    </>
  );
}

export { AccessView };
