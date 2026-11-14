"use client";
import { lazy, Suspense, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  ConfirmDialog,
  Field,
  Input,
  Ellipsis as MoreHorizontal,
  Spinner,
} from "@johnbot/ui";
import { DropdownMenu as Menu } from "../../components/complex";
import { Bar, BarChart } from "recharts";
import {
  CartesianGrid,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  XAxis,
  YAxis,
} from "@johnbot/ui/chart";
import {
  operationsSchema,
  type Dashboard,
  type Operations,
  type Person,
} from "../../contracts/operations";
import { agentsSchema } from "../../contracts/agents-data";
import { workflowListSchema } from "../../contracts/workflows-data";
import { useDataQuery } from "../../hooks/use-data-query";
import { getData, runCommand } from "../../lib/api/client";
import { useUrlActions, useUrlOpen, useUrlSignal } from "../../lib/url-state";
import type { Change } from "./operations-ui";
import type { ActionEvent } from "@openuidev/lang-core";
import { FirstAgentSetup, type FirstAgentDraft } from "../agents/FirstAgentSetup";
import { DiagramChatPanel } from "../diagrams/DiagramChatPanel";
import type { DiagramChatMessage } from "../diagrams/diagram-model";
import { DASHBOARD_BUILDER_ID, DASHBOARD_BUILDER_NAME } from "../../contracts/dashboard-builder";
import type { AgentProfile } from "@johnbot/ui/data";
import { dashboardDemoProgram } from "../../lib/dashboard-demo";
const DashboardProgram = lazy(() =>
  import("./DashboardProgram").then((module) => ({ default: module.DashboardProgram })),
);
const DASHBOARD_BUILDER_PROFILE: AgentProfile = {
  id: DASHBOARD_BUILDER_ID,
  name: DASHBOARD_BUILDER_NAME,
  title: "Construtor de interfaces",
  description: "Compõe dashboards com os componentes e dados do JohnBot.",
  notifications: false,
  provider: "codex",
  model: "default",
  reasoningEffort: "low",
  threadId: null,
  avatarSeed: DASHBOARD_BUILDER_ID,
  avatarHue: 245,
  avatarUrl: null,
  time: "",
  preview: "",
};

const number = (value: number) => value.toLocaleString("pt-BR");
const percent = (value: number) =>
  `${(value * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

export function DashboardView({
  state,
  change,
  saving,
  error,
}: {
  state: Operations;
  change: Change;
  saving: boolean;
  error?: string | null;
}) {
  const person = state.people.find((entry) => entry.id === state.viewerId)!;
  const dashboards = state.dashboards.filter((entry) => entry.personId === person.id);
  const [dashboardId, setDashboardId] = useUrlSignal("dashboard");
  const [setupOpen, setSetupOpen] = useUrlOpen("dialog", "dashboard-setup");
  const [renameOpen, setRenameOpen] = useUrlOpen("dialog", "dashboard-rename");
  const [deleteOpen, setDeleteOpen] = useUrlOpen("dialog", "dashboard-delete");
  const [chatOpen, setChatOpen] = useUrlSignal("dashboardChat");
  const dashboard = dashboards.find((entry) => entry.id === dashboardId()) ?? dashboards[0];
  const agents = useDataQuery("/api/agents?domain=roster", agentsSchema);
  const routines = useDataQuery("/api/workflows?op=list&serverId=local", workflowListSchema);
  const navigate = useUrlActions();
  const [working, setWorking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [rename, setRename] = useState("");
  const [pendingMessages, setPendingMessages] = useState<DiagramChatMessage[]>([]);
  const [draft, setDraft] = useState<FirstAgentDraft>({
    name: "",
    purpose: person.goals.join(". "),
    avatarSeed: DASHBOARD_BUILDER_ID,
    avatarHue: 245,
    suggestionId: null,
    provider: "codex",
    model: "default",
    reasoningEffort: "low",
  });
  useEffect(() => {
    if (dashboard?.id && dashboardId() !== dashboard.id) setDashboardId(dashboard.id);
  }, [dashboard?.id, dashboardId(), setDashboardId]);
  async function compose(text: string, create = false, title?: string) {
    if (working || (!create && !dashboard) || !text.trim()) return;
    setWorking(true);
    setFailure(null);
    const previousIds = new Set(dashboards.map((entry) => entry.id));
    if (!create)
      setPendingMessages([
        { id: crypto.randomUUID(), author: "user", text, createdAt: new Date().toISOString() },
      ]);
    try {
      const result = await runCommand(
        "dashboards.compose",
        {
          expectedRevision: state.revision,
          agentId: DASHBOARD_BUILDER_ID,
          dashboardId: create ? null : dashboard?.id,
          objective: text.trim(),
          ...(title ? { title: title.trim() } : {}),
        },
        operationsSchema,
        { timeoutMs: 120_000 },
      );
      const saved = create
        ? result.data.dashboards.find((entry) => !previousIds.has(entry.id))
        : result.data.dashboards.find((entry) => entry.id === dashboard?.id);
      if (saved) setDashboardId(saved.id);
      setSetupOpen(false);
      setPendingMessages([]);
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : "Falha ao montar o dashboard.");
    } finally {
      setWorking(false);
    }
  }
  async function handleAction(event: ActionEvent) {
    const id = typeof event.params?.id === "string" ? event.params.id : "";
    try {
      if (event.type === "OpenRoutine" || event.type === "RunRoutine") {
        if (!routines.data?.some((item) => item.id === id))
          throw new Error("Rotina indisponível neste workspace.");
        if (event.type === "OpenRoutine")
          navigate?.({ page: "agents", sidebar: "routines", workflow: id });
        else {
          await window.johnbot.workflows.startRun({
            workflowId: id,
            requestId: crypto.randomUUID(),
          });
          await getData("/api/workflows?op=list&serverId=local", workflowListSchema, {
            force: true,
          });
        }
      } else if (event.type === "OpenAgent") {
        if (!agents.data?.some((item) => item.id === id))
          throw new Error("Agente indisponível neste workspace.");
        navigate?.({ page: "agents", sidebar: "agents", agent: id });
      } else if (event.type === "OpenNotebook") {
        throw new Error(
          "Notebooks são registros internos dos agentes. Peça ao assistente um resumo das evidências autorizadas.",
        );
      } else if (event.type === "Navigate") {
        const page = event.params?.page;
        if (page === "routines") navigate?.({ page: "agents", sidebar: "routines" });
        else if (
          page === "agents" ||
          page === "dashboard" ||
          page === "twin" ||
          page === "schedule" ||
          page === "usage" ||
          page === "access"
        )
          navigate?.({ page });
        else throw new Error("Destino não permitido no dashboard.");
      } else if (event.type === "Refresh") {
        await Promise.all([
          getData("/api/operations", operationsSchema, { force: true }),
          getData("/api/workflows?op=list&serverId=local", workflowListSchema, { force: true }),
          getData("/api/agents?domain=roster", agentsSchema, { force: true }),
        ]);
      } else if (event.type === "continue_conversation") {
        const text = String(event.humanFriendlyMessage ?? "").slice(0, 2000);
        setChatOpen(true);
        await compose(text);
      } else throw new Error("Ação não permitida no dashboard.");
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : "Falha na ação do dashboard.");
    }
  }
  if (setupOpen() || !dashboard)
    return (
      <FirstAgentSetup
        value={draft}
        onChange={setDraft}
        suggestions={[]}
        mode="additional"
        fixedAvatar
        requirePurpose
        purposeMaxLength={2000}
        submitting={working}
        error={failure ?? error}
        labels={{
          identity: DASHBOARD_BUILDER_NAME,
          title: "Criar dashboard",
          name: "Nome do dashboard",
          purpose: "O que você quer acompanhar?",
          placeholder:
            "Quero comparar falhas por máquina, acompanhar decisões pendentes e executar minhas rotinas.",
          submit: "Criar meu dashboard",
          submitting: "Construindo dashboard…",
        }}
        onSubmit={(value) => compose(value.purpose, true, value.name)}
        onCancel={dashboard ? () => setSetupOpen(false) : undefined}
      />
    );
  const dataVersion = `${dashboard.id}:${state.revision}:${JSON.stringify(routines.data)}:${JSON.stringify(agents.data)}`;
  return (
    <section className="agent-usage relative" aria-label="Dashboards pessoais">
      <header className="agent-usage-header">
        <div className="agent-usage-identity">
          <h2>
            Dashboards <span aria-hidden="true">/</span> <span>{dashboard.title}</span>
          </h2>
        </div>
        <div className="agent-usage-controls">
          <Select<Dashboard>
            queryKey="dashboard-list"
            options={dashboards}
            optionValue="id"
            optionTextValue="title"
            value={dashboard}
            disabled={working || saving}
            onChange={(value: Dashboard | null) => {
              if (value) {
                setDashboardId(value.id);
                setPendingMessages([]);
                setFailure(null);
              }
            }}
            itemComponent={(item: { item: { rawValue: Dashboard } }) => (
              <SelectItem item={item.item}>{item.item.rawValue.title}</SelectItem>
            )}
          >
            <SelectTrigger size="sm" aria-label="Dashboard selecionado">
              <SelectValue<Dashboard>>
                {(value: { selectedOption: () => Dashboard | undefined }) =>
                  value.selectedOption()?.title ?? dashboard.title
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent />
          </Select>
          <Select<Person>
            queryKey="dashboard-person"
            options={state.people}
            optionValue="id"
            optionTextValue="name"
            value={person}
            disabled={working || saving}
            onChange={(value: Person | null) =>
              value && void change({ type: "viewer", personId: value.id })
            }
            itemComponent={(item: { item: { rawValue: Person } }) => (
              <SelectItem item={item.item}>{item.item.rawValue.name}</SelectItem>
            )}
          >
            <SelectTrigger size="sm" aria-label="Simular a visão de uma pessoa">
              <SelectValue<Person>>
                {(value: { selectedOption: () => Person | undefined }) =>
                  value.selectedOption()?.name ?? person.name
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent />
          </Select>
          <Button
            size="sm"
            variant="outline"
            disabled={working}
            onClick={() => {
              setDraft({ ...draft, name: "", purpose: person.goals.join(". ") });
              setFailure(null);
              setSetupOpen(true);
            }}
          >
            Novo dashboard
          </Button>
          <Menu.Root>
            <Menu.Trigger
              aria-label="Opções do dashboard"
              className="ui-button ui-button-variant-ghost ui-button-size-xs"
              disabled={working || saving}
            >
              <MoreHorizontal aria-hidden="true" />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Content className="ui-action-menu">
                <Menu.Item
                  onSelect={() => {
                    setRename(dashboard.title);
                    setRenameOpen(true);
                  }}
                >
                  Renomear
                </Menu.Item>
                <Menu.Item
                  onSelect={async () => {
                    const newId = `dashboard:${crypto.randomUUID()}`;
                    if (
                      await change({
                        type: "dashboard-duplicate",
                        dashboardId: dashboard.id,
                        newId,
                      })
                    )
                      setDashboardId(newId);
                  }}
                >
                  Duplicar
                </Menu.Item>
                <Menu.Item onSelect={() => setDeleteOpen(true)}>Excluir</Menu.Item>
              </Menu.Content>
            </Menu.Portal>
          </Menu.Root>
        </div>
      </header>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="agent-usage-body pb-20">
          {(error || failure) && (
            <Alert tone="danger" role="alert">
              {failure ?? error}
            </Alert>
          )}
          <p className="agent-usage-secondary">
            {dashboard.origin === "template" ? "Prévia simulada · " : ""}
            {dashboard.objective}
          </p>
          {dashboard.program ? (
            agents.data && routines.data ? (
              <Suspense fallback={<Spinner label="Carregando biblioteca do dashboard" />}>
                <DashboardProgram
                  key={dataVersion}
                  program={dashboard.program}
                  state={state}
                  routines={routines.data}
                  agents={agents.data}
                  onAction={(event) => void handleAction(event)}
                  onError={setFailure}
                />
              </Suspense>
            ) : agents.error || routines.error ? (
              <Alert tone="danger" role="alert">
                {agents.error ?? routines.error}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleAction({ type: "Refresh", params: {} } as ActionEvent)}
                >
                  Tentar novamente
                </Button>
              </Alert>
            ) : (
              <Spinner label="Carregando fontes do dashboard" />
            )
          ) : dashboard.origin === "template" && agents.data && routines.data ? (
            <Suspense fallback={<Spinner label="Carregando biblioteca do dashboard" />}>
              <DashboardProgram
                key={`fallback:${dataVersion}`}
                program={dashboardDemoProgram()}
                state={state}
                routines={routines.data}
                agents={agents.data}
                onAction={(event) => void handleAction(event)}
                onError={setFailure}
              />
            </Suspense>
          ) : (
            <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-2">
              {dashboard.widgets.map((widget) => (
                <section
                  className={`agent-usage-trend min-w-0 ${widget.width === "full" ? "lg:col-span-2" : ""}`}
                  key={widget.id}
                >
                  <DashboardModule widget={widget} state={state} />
                </section>
              ))}
            </div>
          )}
          <p className="agent-usage-footer">
            Atualizado em {new Date(dashboard.updatedAt).toLocaleString("pt-BR")}
          </p>
        </div>
        <div className="diagram-view-chat">
          <DiagramChatPanel
            key={dashboard.id}
            agent={DASHBOARD_BUILDER_PROFILE}
            messages={[...(dashboard.messages ?? []), ...pendingMessages]}
            working={working}
            open={chatOpen()}
            onOpenChange={setChatOpen}
            onSend={(text) => void compose(text)}
            labels={{
              launcher: "Pedir ao agente para editar este dashboard",
              title: DASHBOARD_BUILDER_NAME,
              empty:
                "Peça gráficos, filtros, tabelas, abas ou ações de agentes e rotinas. O construtor usa a biblioteca de componentes do JohnBot.",
              placeholder: "Como você quer alterar este dashboard?",
            }}
          />
        </div>
      </div>
      <ConfirmDialog
        open={renameOpen()}
        title="Renomear dashboard"
        confirmLabel="Salvar nome"
        tone="default"
        pending={saving}
        onCancel={() => setRenameOpen(false)}
        onConfirm={async () => {
          if (
            rename.trim() &&
            (await change({
              type: "dashboard-rename",
              dashboardId: dashboard.id,
              title: rename.trim(),
            }))
          )
            setRenameOpen(false);
        }}
      >
        <Field label="Nome do dashboard">
          <Input value={rename} maxLength={200} onValueChange={setRename} />
        </Field>
      </ConfirmDialog>
      <ConfirmDialog
        open={deleteOpen()}
        title="Excluir dashboard?"
        description={`Somente “${dashboard.title}” e seu histórico serão removidos. Os outros painéis permanecem.`}
        confirmLabel="Excluir dashboard"
        pending={saving}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={async () => {
          if (await change({ type: "dashboard-delete", dashboardId: dashboard.id })) {
            setDeleteOpen(false);
            setDashboardId(dashboards.find((entry) => entry.id !== dashboard.id)?.id ?? null);
          }
        }}
      />
    </section>
  );
}

function DashboardModule({
  widget,
  state,
}: {
  widget: Dashboard["widgets"][number];
  state: Operations;
}) {
  const navigate = useUrlActions();
  const machines = [...state.dataset.machines].sort((a, b) => b.failure_rate - a.failure_rate);
  return (
    <>
      <div className="agent-usage-section-header">
        <h3>{widget.title}</h3>
        {widget.source === "routines" && (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => navigate?.({ page: "agents", sidebar: "routines" })}
          >
            Abrir rotinas
          </Button>
        )}
      </div>
      {widget.source === "downtime" ? (
        <>
          {widget.kind === "chart" ? (
            <ChartContainer label="Frequência de falhas por máquina">
              <BarChart
                data={machines}
                margin={{ top: 12, right: 12, bottom: 0, left: 0 }}
                accessibilityLayer
                role="img"
                aria-label="Frequência de falhas por máquina"
              >
                <CartesianGrid vertical={false} stroke="var(--johnbot-border-strong)" />
                <XAxis
                  dataKey="group"
                  tickLine={false}
                  axisLine={false}
                  stroke="var(--johnbot-text-muted)"
                  tickFormatter={(value) => String(value).replace(/-Unit\d+-/u, " · ")}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  stroke="var(--johnbot-text-muted)"
                  tickFormatter={(value) => percent(Number(value))}
                />
                <ChartTooltip
                  content={(props: object) => (
                    <ChartTooltipContent {...props} formatValue={percent} />
                  )}
                />
                <Bar
                  dataKey="failure_rate"
                  name="Frequência de falhas"
                  fill="var(--johnbot-chart-series-codex)"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ChartContainer>
          ) : (
            <ReportTable
              headers={["Máquina", "Falhas", "Frequência"]}
              rows={machines.map((machine) => [
                machine.group,
                number(machine.failures),
                percent(machine.failure_rate),
              ])}
            />
          )}
          <p className="agent-usage-secondary">
            {number(state.dataset.records)} registros · {number(state.dataset.failures)} com falha.
            Fonte: {state.dataset.source}.
          </p>
        </>
      ) : widget.source === "quality" ? (
        <dl className="agent-usage-totals">
          {[
            ["Válidos", state.dataset.records],
            ["Rejeitados", state.dataset.rejected],
            ["Duplicados", state.dataset.duplicates],
            ["Com falha", state.dataset.failures],
          ].map(([label, count]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{number(Number(count))}</dd>
            </div>
          ))}
        </dl>
      ) : widget.source === "routines" ? (
        <RoutineResults />
      ) : widget.source === "actions" ? (
        <ReportTable
          headers={["Minha pendência", "Prazo", "Estado"]}
          rows={state.actions
            .filter((action) => action.ownerId === state.viewerId)
            .map((action) => [
              action.title,
              action.dueAt ? new Date(action.dueAt).toLocaleDateString("pt-BR") : "A definir",
              action.status === "done" ? "Concluída" : "Aberta",
            ])}
        />
      ) : (
        <ReportTable
          headers={["Evidência", "Último resumo"]}
          rows={state.notebooks.map((book) => [
            book.title,
            book.entries.at(-1)?.result.slice(0, 160) ?? "Sem registro",
          ])}
        />
      )}
    </>
  );
}

function ReportTable({
  headers,
  rows,
  onOpen,
}: {
  headers: string[];
  rows: string[][];
  onOpen?: (index: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <div className="agent-usage-table">
        <table>
          <thead>
            <tr>
              {headers.map((header) => (
                <th scope="col" key={header}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.slice(0, expanded ? undefined : 5).map((row, index) => (
                <tr key={`${row[0]}:${index}`}>
                  {row.map((value, column) => (
                    <td key={headers[column]}>
                      {column === 0 && onOpen ? (
                        <Button variant="ghost" size="xs" onClick={() => onOpen(index)}>
                          {value}
                        </Button>
                      ) : (
                        value
                      )}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={headers.length}>Sem dados neste recorte.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {rows.length > 5 && (
        <Button
          variant="ghost"
          size="xs"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Ver menos" : `Ver todos (${rows.length})`}
        </Button>
      )}
    </>
  );
}

function RoutineResults() {
  const query = useDataQuery("/api/workflows?op=list&serverId=local", workflowListSchema);
  const navigate = useUrlActions();
  const ordered = [...(query.data ?? [])].sort((a, b) =>
    (b.lastRun?.at ?? b.updatedAt).localeCompare(a.lastRun?.at ?? a.updatedAt),
  );
  return (
    <>
      {query.error && (
        <Alert tone="danger" role="alert">
          {query.error}
        </Alert>
      )}
      <ReportTable
        headers={["Rotina", "Etapas", "Resultado"]}
        rows={ordered.map((routine) => [
          routine.title,
          String(routine.steps),
          routine.lastRun
            ? ((
                {
                  done: "Concluída",
                  failed: "Falhou",
                  stopped: "Interrompida",
                  running: "Em execução",
                  approval: "Aguardando aprovação",
                } as Record<string, string>
              )[routine.lastRun.status] ?? routine.lastRun.status)
            : "Sem execução",
        ])}
        onOpen={(index) =>
          navigate?.({ page: "agents", sidebar: "routines", workflow: ordered[index]!.id })
        }
      />
    </>
  );
}
