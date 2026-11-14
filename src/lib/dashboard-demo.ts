import type { Operations } from "../contracts/operations";
import type { WorkflowSummary, ClientAgentSummary } from "../contracts/ipc";

/**
 * Builds an interactive default OpenUI dashboard program using registered dashboard components:
 * - Root Stack
 * - Queries for quality, machines, routines, actions, person
 * - Initialized $machine = ""
 * - 4 Tabs: overview, machines, routines, actions
 * - Overview with live Metrics (from First(quality)), BarChart, AreaChart, Table
 * - Machines tab with Input bound to $machine filter + reset Button (Set($machine, ""))
 * - Routines tab with dynamic RoutineCard components bound to OpenRoutine actions
 * - Actions tab with Select filter for status
 */
export function dashboardDemoProgram(
  _state?: Operations,
  _routines?: WorkflowSummary[],
  _agents?: ClientAgentSummary[],
): string {
  return `quality = Query("dashboardData", { source: "quality" })
machines = Query("dashboardData", { source: "machines" })
routines = Query("dashboardData", { source: "routines" })
actions = Query("dashboardData", { source: "actions" })
person = Query("dashboardData", { source: "person" })

$machine = ""
$actionStatus = ""

qualityFirst = @First(quality)
personFirst = @First(person)
filteredMachines = $machine ? @Where(machines, "group", $machine) : machines
filteredActions = $actionStatus ? @Where(actions, "status", $actionStatus) : actions

overviewContent = Stack([
  Heading(personFirst.name, 3),
  Row([
    Metric("Registros Totais", qualityFirst.records),
    Metric("Total de Falhas", qualityFirst.failures),
    Metric("Rejeitados", qualityFirst.rejected),
    Metric("Duplicados", qualityFirst.duplicates)
  ], "m"),
  Card("Frequência de Falhas por Máquina", "Registros observados por equipamento", [
    BarChart(machines, "group", "failure_rate", "Taxa de Falha")
  ]),
  Card("Registros por Máquina", "Total de registros observados por equipamento", [
    AreaChart(machines, "group", "records", "Registros")
  ]),
  Card("Tabela Consolidada", "Métricas diretas das máquinas", [
    Table(machines)
  ])
], "vertical", "l")

machinesContent = Stack([
  Heading("Monitoramento de Equipamentos", 3),
  Row([
    Input("machine", $machine, "Filtrar por máquina..."),
    Button("Limpar filtro", @Set($machine, ""))
  ], "m"),
  Card("Equipamentos", "Dados filtrados por seleção", [
    Table(filteredMachines)
  ])
], "vertical", "l")

routinesContent = Stack([
  Heading("Rotinas e Automações", 3),
  Card("Rotinas Registradas", "Selecione para abrir o fluxo de trabalho", [
    Stack(@Each(routines, "r", RoutineCard(r.id, r.title, r.lastRun.status, r.steps, r.lastRun.at, @OpenRoutine(r.id))), "vertical", "s")
  ])
], "vertical", "l")

actionsContent = Stack([
  Heading("Ações e Pendências", 3),
  Row([
    Select("actionStatus", $actionStatus, [
      { label: "Todas as pendências", value: "" },
      { label: "Aberta", value: "open" },
      { label: "Concluída", value: "done" }
    ], "Filtrar por status...")
  ], "m"),
  Card("Lista de Pendências", "Ações filtradas pelo status", [
    Table(filteredActions)
  ])
], "vertical", "l")

root = Stack([
  Tabs([
    { id: "overview", label: "Visão Geral", content: overviewContent },
    { id: "machines", label: "Máquinas", content: machinesContent },
    { id: "routines", label: "Rotinas", content: routinesContent },
    { id: "actions", label: "Ações", content: actionsContent }
  ])
], "vertical", "l")
`;
}
