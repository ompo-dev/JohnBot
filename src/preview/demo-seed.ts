// Semente de demonstração: dados mockados para TODAS as telas — rotinas, execuções,
// fluxos entre agentes, workflows, canais, tarefas e memórias. Textos em pt-BR.
import type {
  AgentMemory,
  AgentTask,
  Channel,
  ChannelMessage,
  ConversationMessage,
  ConversationSnapshot,
  Routine,
  RoutineRun,
  RoutineFlowLink,
  RoutineFlowStep,
  WorkflowEdge,
  WorkflowGraph,
  WorkflowNode,
} from "@johnbot/contracts/ipc";
import type { MockChannelSeed } from "./mock-channels";
import type { MockjohnBotOptions } from "./mock-johnbot";
import type { MockWorkflowSeed } from "./mock-workflows";
import { STORY_SNAPSHOTS } from "./fixtures";

const NOW = Date.now();
const at = (hours: number) => new Date(NOW - hours * 3_600_000).toISOString();
const ahead = (hours: number) => new Date(NOW + hours * 3_600_000).toISOString();
const ZONE = "America/Sao_Paulo";

// ---------------------------------------------------------------------------
// Rotinas e execuções
// ---------------------------------------------------------------------------

const briefing: Routine = {
  id: "routine-briefing",
  agentId: "chief",
  name: "Briefing matinal",
  instruction: "Resuma as mudanças importantes de mercado e de produto desde ontem.",
  active: true,
  timezone: ZONE,
  trigger: {
    id: "trigger-briefing",
    routineId: "routine-briefing",
    schedule: { kind: "weekdays", time: "07:00" },
    nextRunAt: ahead(14),
    createdAt: at(72),
    updatedAt: at(72),
  },
  createdAt: at(72),
  updatedAt: at(72),
};

const planejamento: Routine = {
  id: "routine-planejamento",
  agentId: "chief",
  name: "Planejamento semanal",
  instruction: "Revise o trabalho aberto e prepare as prioridades da próxima semana.",
  active: false,
  timezone: ZONE,
  trigger: {
    id: "trigger-planejamento",
    routineId: "routine-planejamento",
    schedule: { kind: "weekly", weekday: 5, time: "16:00" },
    nextRunAt: ahead(96),
    createdAt: at(120),
    updatedAt: at(120),
  },
  createdAt: at(120),
  updatedAt: at(120),
};

const checklist: Routine = {
  id: "routine-checklist",
  agentId: "chief",
  name: "Checklist de release",
  instruction: "Percorra o checklist de release, marque pendências e avise o responsável.",
  active: true,
  timezone: ZONE,
  trigger: {
    id: "trigger-checklist",
    routineId: "routine-checklist",
    schedule: { kind: "daily", time: "09:30" },
    nextRunAt: ahead(18),
    createdAt: at(240),
    updatedAt: at(24),
  },
  createdAt: at(240),
  updatedAt: at(24),
};

const varredura: Routine = {
  id: "routine-varredura",
  agentId: "research",
  name: "Varredura de fontes",
  instruction: "Leia as novas fontes da lista e classifique o que vale um resumo.",
  active: true,
  timezone: ZONE,
  trigger: {
    id: "trigger-varredura",
    routineId: "routine-varredura",
    schedule: { kind: "daily", time: "08:00" },
    nextRunAt: ahead(16),
    createdAt: at(200),
    updatedAt: at(200),
  },
  createdAt: at(200),
  updatedAt: at(200),
};

const radar: Routine = {
  id: "routine-radar",
  agentId: "research",
  name: "Radar de concorrentes",
  instruction: "Compare as páginas de preços e de produto dos concorrentes e destaque mudanças.",
  active: true,
  timezone: ZONE,
  trigger: {
    id: "trigger-radar",
    routineId: "routine-radar",
    schedule: { kind: "weekly", weekday: 1, time: "09:00" },
    nextRunAt: ahead(60),
    createdAt: at(300),
    updatedAt: at(300),
  },
  createdAt: at(300),
  updatedAt: at(300),
};

const pipeline: Routine = {
  id: "routine-pipeline",
  agentId: "sales",
  name: "Resumo de pipeline",
  instruction: "Monte o resumo do pipeline do dia com próximos passos por conta.",
  active: true,
  timezone: ZONE,
  trigger: {
    id: "trigger-pipeline",
    routineId: "routine-pipeline",
    schedule: { kind: "weekdays", time: "08:30" },
    nextRunAt: ahead(15),
    createdAt: at(150),
    updatedAt: at(150),
  },
  createdAt: at(150),
  updatedAt: at(150),
};

function run(
  id: string,
  routine: Routine,
  status: RoutineRun["status"],
  kind: RoutineRun["kind"],
  hours: number,
): RoutineRun {
  const scheduledFor = at(hours);
  return {
    id,
    routineId: routine.id,
    agentId: routine.agentId,
    triggerId: kind === "manual" ? null : routine.trigger.id,
    kind,
    scheduledFor,
    routineName: routine.name,
    instruction: routine.instruction,
    deliveryId: `delivery-${id}`,
    status,
    error: status === "failed" ? "O agente não conseguiu concluir esta execução." : null,
    createdAt: scheduledFor,
    updatedAt: scheduledFor,
  };
}

const routineRuns: Record<string, RoutineRun[]> = {
  "routine-briefing": [
    run("run-briefing-1", briefing, "running", "scheduled", 0.2),
    run("run-briefing-2", briefing, "succeeded", "scheduled", 24),
    run("run-briefing-3", briefing, "needs-attention", "manual", 28),
    run("run-briefing-4", briefing, "failed", "scheduled", 52),
    run("run-briefing-5", briefing, "succeeded", "scheduled", 76),
  ],
  "routine-checklist": [
    run("run-checklist-1", checklist, "succeeded", "scheduled", 3),
    run("run-checklist-2", checklist, "succeeded", "scheduled", 27),
    run("run-checklist-3", checklist, "cancelled", "scheduled", 51),
  ],
  "routine-varredura": [
    run("run-varredura-1", varredura, "succeeded", "scheduled", 2),
    run("run-varredura-2", varredura, "succeeded", "scheduled", 26),
  ],
  "routine-radar": [run("run-radar-1", radar, "succeeded", "scheduled", 49)],
  "routine-pipeline": [
    run("run-pipeline-1", pipeline, "succeeded", "scheduled", 1),
    run("run-pipeline-2", pipeline, "failed", "scheduled", 25),
  ],
};

const factoryRoutineOwners = [
  ["marina-costa", "Orquestrador de Operações", "Diretoria"],
  ["ana-souza", "Diagnóstico de Processo", "Usinagem"],
  ["carlos-mendes", "Coordenador de Manutenção", "Manutenção"],
  ["rafael-nunes", "Controle de Montagem", "Montagem"],
  ["camila-reis", "Guardião da Qualidade", "Qualidade"],
  ["lucas-ferreira", "Monitor de Motores", "Sistemas de Potência"],
  ["patricia-alves", "Planejador de Suprimentos", "Suprimentos"],
  ["davi-rocha", "Especialista em Automação", "Engenharia e Tecnologia"],
  ["juliana-prado", "Coordenador de Produto", "Engenharia e Tecnologia"],
  ["bruno-lima", "Analista de Custos", "Finanças"],
  ["sofia-barros", "Assistente de Pós-Vendas", "Pós-Vendas"],
  ["renata-dias", "Planejador de Pessoas", "Recursos Humanos"],
  ["eduardo-martins", "Consultor de Conformidade", "Jurídico"],
  ["thiago-ramos", "Supervisor de Solda", "Solda"],
] as const;

export const FACTORY_ROUTINE_PLAYBOOKS: Record<string, string[]> = {
  "marina-costa": ["Conciliar OEE e volume dos três turnos", "Priorizar as quatro ordens críticas", "Simular recuperação das duas máquinas pendentes", "Solicitar aprovação de contingência", "Publicar decisões e checkpoint às 09:30"],
  "ana-souza": ["Comparar curva hidráulica da CNC-01 com setembro", "Investigar vedação e histerese da válvula", "Calcular perda de ciclo por oscilação", "Validar causa raiz com manutenção", "Acompanhar pressão por sete dias"],
  "carlos-mendes": ["Consultar OM-4821 e bloqueios de segurança", "Conferir kit de selo e plano de lubrificação", "Reservar janela de 20 minutos do compressor", "Delegar teste de pressão à automação", "Anexar evidência e liberar ativo após inspeção"],
  "rafael-nunes": ["Reconciliar sequência de chassis e kits de transmissão", "Identificar gargalo na estação 4", "Rebalancear operadores habilitados", "Aguardar liberação de qualidade", "Medir recuperação após dez máquinas"],
  "camila-reis": ["Rastrear torque do lote 6M-2411", "Segregar unidades com medição incompleta", "Avaliar tendência nas últimas 30 peças", "Solicitar contenção se terceiro desvio ocorrer", "Liberar expedição com rastreabilidade"],
  "lucas-ferreira": ["Conferir calibração da bancada 6090", "Comparar pressão e temperatura após resfriamento", "Investigar desvios de torque de cabeçote", "Repetir teste de queima por 12 minutos", "Emitir laudo de liberação para qualidade"],
  "patricia-alves": ["Conciliar estoque físico do kit CNC-01", "Calcular cobertura por consumo e lead time", "Confirmar coleta expressa com fornecedor", "Avaliar alternativa homologada e custo", "Escalonar atraso para operação e finanças"],
  "davi-rocha": ["Validar qualidade dos sinais OPC-UA", "Detectar lacunas de telemetria de 30 segundos", "Correlacionar alarme e pressão hidráulica", "Testar integração em ambiente de validação", "Publicar diagnóstico com versão e rollback"],
  "juliana-prado": ["Reunir evidências do ensaio de campo 6M", "Confrontar requisitos e resultados por variante", "Revisar conectividade e falhas de sensor", "Solicitar parecer jurídico do contrato Sul", "Emitir pacote de liberação de produto"],
  "bruno-lima": ["Reconciliar custo de parada de R$ 184 mil", "Separar impacto por centro de custo", "Simular reparo versus substituição", "Validar premissas com suprimentos", "Submeter cenário financeiro à diretoria"],
  "sofia-barros": ["Classificar três chamados da concessionária Sul", "Conferir SLA contratual de 48 horas", "Cruzar peça crítica com estoque e transporte", "Propor contingência ao atendimento de campo", "Confirmar entrega e encerrar com evidência"],
  "renata-dias": ["Conciliar escala dos três turnos", "Verificar certificações obrigatórias por estação", "Identificar duas lacunas de treinamento", "Simular cobertura respeitando descanso", "Publicar escala e plano de capacitação"],
  "eduardo-martins": ["Comparar versões do contrato Sul-2026", "Verificar cláusulas de SLA e responsabilidade", "Analisar exposição e alternativas de redação", "Solicitar aprovação de exceções", "Registrar parecer e trilha de assinatura"],
  "thiago-ramos": ["Verificar lote e receita da célula robotizada 2", "Comparar vazão de gás e corrente de solda", "Inspecionar primeiras 18 peças após ajuste", "Acionar contenção por porosidade", "Liberar receita validada e registrar parâmetros"],
};

const factoryRoutineSpecs = factoryRoutineOwners.flatMap(([agentId, name, area], index) => [
  {
    agentId,
    name: FACTORY_ROUTINE_PLAYBOOKS[agentId][0],
    instruction: `${name}: executar o diagnóstico de ${area}.\n${FACTORY_ROUTINE_PLAYBOOKS[agentId].map((step, i) => `${i + 1}. ${step}`).join("\n")}\nSe faltar evidência, interromper a liberação e solicitar revisão humana. Entregar tabela de evidências, risco, decisão e próximo retorno.`,
    time: `${String(6 + (index % 3)).padStart(2, "0")}:30`,
  },
  {
    agentId,
    name: `Fechamento — ${area}`,
    instruction: `Auditoria de encerramento de ${area}:\n${FACTORY_ROUTINE_PLAYBOOKS[agentId].slice().reverse().map((step, i) => `${i + 1}. Verificar resultado: ${step}`).join("\n")}\nComparar planejado e realizado; reabrir pendências sem evidência; registrar responsáveis e escalar bloqueios.`,
    time: `${String(16 + (index % 3)).padStart(2, "0")}:15`,
  },
]);

const factoryRoutines = factoryRoutineSpecs
  .map((spec, index) => {
    const id = `routine-factory-${spec.agentId}-${index % 2 === 0 ? "opening" : "closing"}`;
    const routine: Routine = {
      id,
      agentId: spec.agentId,
      name: spec.name,
      instruction: spec.instruction,
      active: true,
      timezone: ZONE,
      trigger: {
        id: `trigger-${id}`,
        routineId: id,
        schedule: { kind: "weekdays", time: spec.time },
        nextRunAt: ahead(index + 2),
        createdAt: at(96 + index),
        updatedAt: at(24 + index),
      },
      createdAt: at(96 + index),
      updatedAt: at(24 + index),
    };
    return [spec.agentId, routine] as const;
  }).reduce<Record<string, Routine[]>>((all, [agentId, routine]) => {
    const routines = all[agentId] ?? [];
    routines.push(routine);
    all[agentId] = routines;
    return all;
  }, {});

const factoryRoutineRuns = Object.fromEntries(
  Object.values(factoryRoutines).flatMap((routines, index) =>
    routines.map((routine, routineIndex) => [
      routine.id,
      [run(`run-${routine.id}`, routine, "succeeded", "scheduled", index + routineIndex + 1)],
    ]),
  ),
);

const routineFlowLinks: RoutineFlowLink[] = [
  ...Object.values(factoryRoutines).flatMap((routines, index) => routines.flatMap((routine, routineIndex) => {
    const targets = routineIndex === 0 ? [1, 2, 3] : [2, 4];
    const agents = targets.map((offset) => factoryRoutineOwners[(index + offset) % factoryRoutineOwners.length][0]);
    const chain = [routine.agentId, ...agents];
    return agents.map((toAgentId, step) => ({
      id: `link-${routine.id}-${step}`, routineId: routine.id, fromAgentId: chain[step], toAgentId,
      instruction: `${FACTORY_ROUTINE_PLAYBOOKS[routine.agentId][step + 1]}. Validar com ${factoryRoutineOwners.find(([id]) => id === toAgentId)?.[1]}; devolver evidência e bloquear liberação se houver divergência.`,
      createdAt: at(24),
    }));
  })),
  {
    id: "flow-link-research",
    routineId: "routine-briefing",
    fromAgentId: "chief",
    toAgentId: "research",
    instruction: "Confira as fontes citadas antes de enviar o briefing.",
    createdAt: at(30),
  },
  {
    id: "flow-link-sales",
    routineId: "routine-briefing",
    fromAgentId: "chief",
    toAgentId: "sales",
    instruction: "Avalie o impacto do briefing para os clientes em negociação.",
    createdAt: at(30),
  },
];

const routineFlowSteps: RoutineFlowStep[] = [
  ...Object.values(factoryRoutines).flatMap((routines) => routines.flatMap((routine) => {
    const links = routineFlowLinks.filter((link) => link.routineId === routine.id);
    return [routine.agentId, ...links.map((link) => link.toAgentId)].map((agentId, index) => ({
      id: `step-${routine.id}-${index}`, runId: `run-${routine.id}`, agentId,
      deliveryId: index === 0 ? null : `delivery-${routine.id}-${index}`,
      input: index === 0 ? routine.instruction : links[index - 1].instruction,
      output: `Simulação: ${FACTORY_ROUTINE_PLAYBOOKS[routine.agentId][index]}. Evidência anexada ao fechamento e revisão solicitada quando aplicável.`,
      status: "succeeded" as const, error: null, createdAt: at(2), updatedAt: at(1.8),
    }));
  })),
  {
    id: "flow-step-chief",
    runId: "run-briefing-1",
    agentId: "chief",
    deliveryId: null,
    input: "Monte o briefing de hoje com base nas notas do projeto.",
    output: "Briefing montado: 3 mudanças de produto, 2 de mercado. Fontes anexadas.",
    status: "succeeded",
    error: null,
    createdAt: at(0.2),
    updatedAt: at(0.15),
  },
  {
    id: "flow-step-research",
    runId: "run-briefing-1",
    agentId: "research",
    deliveryId: "delivery-flow-research",
    input: "Confira as fontes citadas antes de enviar o briefing.",
    output: null,
    status: "running",
    error: null,
    createdAt: at(0.1),
    updatedAt: at(0.1),
  },
];

// ---------------------------------------------------------------------------
// Memórias
// ---------------------------------------------------------------------------

const memory = (
  id: string,
  agentId: string,
  text: string,
  origin: AgentMemory["origin"],
  hours: number,
): AgentMemory => ({
  id,
  agentId,
  text,
  origin,
  sourceTurnId: origin === "manual" ? null : `turn-${id}`,
  createdAt: at(hours),
  updatedAt: at(hours),
});

const memories: Record<string, AgentMemory[]> = {
  chief: [
    memory("memory-chief-1", "chief", "O usuário prefere atualizações curtas, com o resultado primeiro.", "automatic", 96),
    memory("memory-chief-2", "chief", "Use Bun para scripts de pacote neste projeto.", "manual", 90),
    memory("memory-chief-3", "chief", "Marque o responsável e o próximo passo em cada marco do plano.", "automatic", 48),
    memory(
      "memory-chief-4",
      "chief",
      "Caderno institucional da CNC-01: toda parada hidráulica registra causa, ação e prevenção antes de fechar a ordem.",
      "manual",
      20,
    ),
  ],
  research: [
    memory("memory-research-1", "research", "Prefira fontes primárias; cite a data de publicação.", "automatic", 120),
    memory("memory-research-2", "research", "Resumos em no máximo 5 bullets.", "manual", 110),
  ],
  sales: [
    memory("memory-sales-1", "sales", "Nunca prometa prazo sem confirmar com o Chief.", "automatic", 140),
    memory("memory-sales-2", "sales", "Follow-ups em terça e quinta pela manhã.", "manual", 130),
  ],
};

// ---------------------------------------------------------------------------
// Tarefas
// ---------------------------------------------------------------------------

const task = (
  id: string,
  agentId: string,
  threadId: string,
  title: string,
  state: AgentTask["state"],
  progress: string | null,
  hours: number,
): AgentTask => ({
  id,
  agentId,
  threadId,
  origin: "user",
  title,
  state,
  outcome: null,
  hold: null,
  activeTurnId: state === "running" ? `turn-${id}` : null,
  progress,
  error: null,
  queuedMessages: [],
  createdAt: at(hours),
  updatedAt: at(hours * 0.5),
  closedAt: null,
});

const tasks: Record<string, AgentTask[]> = {
  chief: [
    task("task-chief-1", "chief", "task-thread-chief-1", "Plano de lançamento da v0.55", "running", "Lendo as notas do projeto e montando os marcos…", 2),
    task("task-chief-2", "chief", "task-thread-chief-2", "Revisar orçamento de infraestrutura", "queued", null, 26),
    task("task-chief-3", "chief", "task-thread-chief-3", "Consolidar feedback da equipe", "idle", null, 50),
    task(
      "task-chief-4",
      "chief",
      "task-thread-chief-4",
      "Investigar parada da CNC-01 (OM-4821)",
      "running",
      "Cruzando telemetria do Compressor-04 com o histórico de válvulas…",
      0.5,
    ),
  ],
  research: [
    task("task-research-1", "research", "task-thread-research-1", "Comparar benchmarks de modelos", "running", "Coletando números das três fontes…", 4),
    task("task-research-2", "research", "task-thread-research-2", "Dossiê do concorrente novo", "idle", null, 30),
  ],
  sales: [
    task("task-sales-1", "sales", "task-thread-sales-1", "Rascunho de follow-up para Acme", "running", "Personalizando o e-mail com os pontos da call…", 1.5),
    task("task-sales-2", "sales", "task-thread-sales-2", "Lista de contas para o Q1", "queued", null, 44),
  ],
};

// ---------------------------------------------------------------------------
// Workflows
// ---------------------------------------------------------------------------

const node = (
  id: string,
  kind: WorkflowNode["kind"],
  x: number,
  y: number,
  fields: WorkflowNode["fields"],
  schedule?: WorkflowNode["schedule"],
): WorkflowNode => ({ id, kind, at: { x, y }, fields: { ...fields,
  ...(kind === "agent" && fields.text ? { task: fields.text } : {}),
  ...(kind === "llm" && fields.text ? { prompt: fields.text } : {}),
  ...(kind === "condition" && fields.expression ? { rule: fields.expression } : {}),
  ...(kind === "approval" && fields.title ? { question: fields.title } : {}),
}, ...(schedule ? { schedule } : {}) });

const edge = (id: string, from: string, to: string): WorkflowEdge => ({ id, from, to, type: "text" });

const graph = (nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowGraph => ({ nodes, edges, strokes: [] });

const workflowSeeds: MockWorkflowSeed[] = [
  {
    id: "wf-machine-downtime-csv",
    title: "Machine Downtime — Bronze, Prata e Ouro",
    updatedAt: at(0),
    graph: graph([
      node("csv-start", "trigger", 40, 200, { trigger: "manual", title: "Processar Machine Downtime.csv" }),
      node("csv-bronze", "prompt", 340, 200, { text: "BRONZE · Ingerir o CSV original, preservar conteúdo e hash SHA-256, contar registros e manter rastreabilidade." }),
      node("csv-silver", "prompt", 640, 200, { text: "PRATA · Limpar espaços, padronizar cabeçalhos e datas ISO, converter sensores em números, separar inválidos e remover duplicatas exatas. Não inventar valores ausentes." }),
      node("csv-gold", "prompt", 940, 200, { text: "OURO · Calcular frequências de falha por máquina, linha e mês, resumir qualidade e gerar insights descritivos. Não estimar MTTR, MTBF ou OEE sem duração." }),
      node("csv-report", "output", 1240, 200, { target: "file", text: "Publicar camadas Bronze/Prata/Ouro e relatório; salvar execução e resultados no PostgreSQL." }),
    ], [
      edge("csv-e1", "csv-start", "csv-bronze"), edge("csv-e2", "csv-bronze", "csv-silver"),
      edge("csv-e3", "csv-silver", "csv-gold"), edge("csv-e4", "csv-gold", "csv-report"),
    ]),
  },
  {
    id: "wf-parada-cnc01",
    title: "Resposta a parada — CNC-01",
    updatedAt: at(1),
    graph: graph(
      [
        node("p-trigger", "trigger", 60, 120, { trigger: "webhook" }),
        node("p-prompt", "prompt", 320, 120, { text: "Reúna contexto da CNC-01: telemetria, ocorrências anteriores e técnicos de plantão." }),
        node("p-agent", "agent", 580, 120, { agentId: "research" }),
        node("p-condition", "condition", 840, 120, { expression: "risco de parada superior a 20 minutos" }),
        node("p-approval", "approval", 1100, 60, { title: "Aprovar contingência de produção" }),
        node("p-output", "output", 1360, 60, { target: "notify" }),
        node("p-log", "output", 1100, 240, { target: "file" }),
      ],
      [
        edge("pe1", "p-trigger", "p-prompt"),
        edge("pe2", "p-prompt", "p-agent"),
        edge("pe3", "p-agent", "p-condition"),
        edge("pe4", "p-condition", "p-approval"),
        edge("pe5", "p-approval", "p-output"),
        edge("pe6", "p-condition", "p-log"),
      ],
    ),
  },
  {
    id: "wf-radar-concorrentes",
    title: "Radar de concorrentes",
    updatedAt: at(20),
    graph: graph(
      [
        node("n-trigger", "trigger", 60, 120, { trigger: "schedule" }, { kind: "daily", time: "08:00" }),
        node("n-prompt", "prompt", 320, 120, { text: "Leia as páginas de preços dos concorrentes e liste o que mudou esta semana." }),
        node("n-agent", "agent", 580, 120, { agentId: "research" }),
        node("n-llm", "llm", 840, 120, { text: "Resumo executivo das mudanças de preços." }),
        node("n-condition", "condition", 1100, 120, { expression: "mudança de preço maior que 5%" }),
        node("n-approval", "approval", 1360, 60, { title: "Validar alerta executivo" }),
        node("n-output", "output", 1620, 60, { target: "notify" }),
        node("n-archive", "output", 1360, 240, { target: "file" }),
      ],
      [
        edge("e1", "n-trigger", "n-prompt"),
        edge("e2", "n-prompt", "n-agent"),
        edge("e3", "n-agent", "n-llm"),
        edge("e4", "n-llm", "n-condition"),
        edge("e5", "n-condition", "n-approval"),
        edge("e6", "n-approval", "n-output"),
        edge("e7", "n-condition", "n-archive"),
      ],
    ),
  },
  {
    id: "wf-release-notes",
    title: "Notas de release",
    updatedAt: at(52),
    graph: graph(
      [
        node("r-trigger", "trigger", 60, 260, { trigger: "manual" }),
        node("r-prompt", "prompt", 320, 260, { text: "Transforme os commits da semana em notas de release legíveis." }),
        node("r-agent", "agent", 580, 260, { agentId: "research" }),
        node("r-llm", "llm", 840, 260, { text: "Organize por impacto, migração e riscos." }),
        node("r-review", "approval", 1100, 260, { title: "Revisão de produto" }),
        node("r-output", "output", 1360, 260, { target: "file" }),
      ],
      [edge("re1", "r-trigger", "r-prompt"), edge("re2", "r-prompt", "r-agent"), edge("re3", "r-agent", "r-llm"), edge("re4", "r-llm", "r-review"), edge("re5", "r-review", "r-output")],
    ),
  },
];

// ---------------------------------------------------------------------------
// Canais
// ---------------------------------------------------------------------------

const channelMessage = (
  id: string,
  channelId: string,
  sequence: number,
  author: ChannelMessage["author"],
  message: ConversationMessage,
): ChannelMessage => ({ id, channelId, sequence, author, taskId: null, superseded: false, message });

const launchChannel: Channel = {
  id: "channel-launch",
  name: "launch",
  title: "Lançamento",
  instructions: "Coordenação do lançamento da próxima versão.",
  members: [{ agentId: "chief" }, { agentId: "research" }, { agentId: "sales" }],
  leadAgentId: "chief",
  archived: false,
  revision: 3,
  createdAt: at(200),
};

const suporteChannel: Channel = {
  id: "channel-suporte",
  name: "suporte",
  title: "Suporte",
  instructions: "Triagem de pedidos de suporte e dúvidas de clientes.",
  members: [{ agentId: "research" }, { agentId: "sales" }],
  leadAgentId: "research",
  archived: false,
  revision: 2,
  createdAt: at(180),
};

const channelSeeds: MockChannelSeed[] = [
  {
    channel: launchChannel,
    messages: [
      channelMessage("cm-1", "channel-launch", 1, { kind: "member", id: "member-self", name: "Norbert" }, {
        id: "cm-1-msg",
        author: "user",
        source: "user",
        text: "Falta o que para o lançamento de quinta?",
        createdAt: at(5),
        status: "completed",
        senderMember: { id: "member-self", name: "Norbert" },
      }),
      channelMessage("cm-2", "channel-launch", 2, { kind: "agent", id: "chief", name: "Chief" }, {
        id: "cm-2-msg",
        turnId: "turn-launch-1",
        author: "agent",
        source: "agent",
        senderAgentId: "chief",
        text: "Faltam duas coisas: a revisão final das notas de release e o teste de carga do endpoint de auth.",
        createdAt: at(4.8),
        status: "completed",
      }),
      channelMessage("cm-3", "channel-launch", 3, { kind: "agent", id: "research", name: "Research" }, {
        id: "cm-3-msg",
        turnId: "turn-launch-1",
        author: "agent",
        source: "agent",
        senderAgentId: "research",
        text: "As fontes do anúncio já estão verificadas — sobrou só o print da nova página de preços.",
        createdAt: at(4.5),
        status: "completed",
      }),
      channelMessage("cm-4", "channel-launch", 4, { kind: "member", id: "member-alice", name: "Alice Chen" }, {
        id: "cm-4-msg",
        author: "user",
        source: "user",
        text: "Eu cuido do print hoje à tarde.",
        createdAt: at(4),
        status: "completed",
        senderMember: { id: "member-alice", name: "Alice Chen" },
      }),
      channelMessage("cm-5", "channel-launch", 5, { kind: "agent", id: "sales", name: "Sales Outbound" }, {
        id: "cm-5-msg",
        turnId: "turn-launch-2",
        author: "agent",
        source: "agent",
        senderAgentId: "sales",
        text: "Três contas querem saber do changelog — vou enviar o rascunho hoje.",
        createdAt: at(2),
        status: "completed",
      }),
    ],
  },
  {
    channel: suporteChannel,
    messages: [
      channelMessage("cs-1", "channel-suporte", 1, { kind: "member", id: "member-jon", name: "Jon Bell" }, {
        id: "cs-1-msg",
        author: "user",
        source: "user",
        text: "Um cliente relatou erro ao importar planilhas grandes.",
        createdAt: at(8),
        status: "completed",
        senderMember: { id: "member-jon", name: "Jon Bell" },
      }),
      channelMessage("cs-2", "channel-suporte", 2, { kind: "agent", id: "research", name: "Research" }, {
        id: "cs-2-msg",
        turnId: "turn-suporte-1",
        author: "agent",
        source: "agent",
        senderAgentId: "research",
        text: "Reproduzido: acima de 50 MB o parser estoura o limite de memória. Já tenho a causa provável.",
        createdAt: at(7.5),
        status: "completed",
      }),
      channelMessage("cs-3", "channel-suporte", 3, { kind: "agent", id: "sales", name: "Sales Outbound" }, {
        id: "cs-3-msg",
        turnId: "turn-suporte-1",
        author: "agent",
        source: "agent",
        senderAgentId: "sales",
        text: "Combinei resposta para sexta com o cliente, com status da correção.",
        createdAt: at(6),
        status: "completed",
      }),
    ],
  },
];

// ---------------------------------------------------------------------------
// Snapshots: preserva os padrões (Chief/Research) e acrescenta a história da
// parada da CNC-01 na conversa do Chief + a conversa da Sales.
// ---------------------------------------------------------------------------

const paradaMessages: ConversationMessage[] = [
  {
    id: "parada-msg-1",
    author: "user",
    source: "user",
    text: "A CNC-01 parou agora. O que aconteceu e o que já foi feito?",
    createdAt: at(1.2),
    status: "completed",
    senderMember: { id: "member-self", name: "Norbert" },
  },
  {
    id: "parada-msg-2",
    turnId: "turn-parada-1",
    author: "assistant",
    source: "assistant",
    text: "Resumo: TelemetryOS detectou pressão hidráulica abaixo de 90 bar às 14:12 e abriu a ordem OM-4821 no SAP PM; Carlos Mendes foi notificado. Ele encontrou vazamento na válvula da unidade hidráulica — mesma causa de setembro. A troca do selo está agendada para domingo e o registro já está no caderno institucional da CNC-01, com plano de prevenção (alarme em 95 bar no Compressor-04).",
    createdAt: at(1.1),
    status: "completed",
  },
  {
    id: "parada-msg-3",
    author: "user",
    source: "user",
    text: "E o impacto no projeto de redução de paradas?",
    createdAt: at(1),
    status: "completed",
    senderMember: { id: "member-self", name: "Norbert" },
  },
  {
    id: "parada-msg-4",
    turnId: "turn-parada-1",
    author: "assistant",
    source: "assistant",
    text: "2,1 h de linha parada ≈ R$ 8,4 mil. Ainda dentro da meta do trimestre, mas sugiro revisar a provisão de manutenção do mês com o Bruno.",
    createdAt: at(0.9),
    status: "completed",
  },
];

const extraSnapshots: Record<string, ConversationSnapshot> = {
  ...STORY_SNAPSHOTS,
  sales: {
    agentId: "sales",
    threadId: "thread-sales",
    activeTurnId: null,
    revision: 1,
    messages: [
      {
        id: "sales-msg-1",
        author: "user",
        source: "user",
        text: "Prepare o follow-up da call com a Acme de ontem.",
        createdAt: at(3),
        status: "completed",
        senderMember: { id: "member-self", name: "Norbert" },
      },
      {
        id: "sales-msg-2",
        author: "assistant",
        source: "assistant",
        text: "Rascunho pronto: abro com o combinado da call, trago o case do uptime e fecho com dois horários para a demo técnica.",
        createdAt: at(2.8),
        status: "completed",
      },
    ],
  },
  chief: {
    ...(STORY_SNAPSHOTS.chief ?? {
      agentId: "chief",
      threadId: "thread-chief",
      activeTurnId: null,
      revision: 1,
      messages: [],
    }),
    messages: [...(STORY_SNAPSHOTS.chief?.messages ?? []), ...paradaMessages],
  },
};

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const DEMO_OPTIONS: MockjohnBotOptions = {
  routines: {
    chief: [briefing, planejamento, checklist],
    research: [varredura, radar],
    sales: [pipeline],
    ...factoryRoutines,
  },
  routineRuns: { ...routineRuns, ...factoryRoutineRuns },
  routineFlowLinks,
  routineFlowSteps,
  memories,
  tasks,
  workflows: workflowSeeds,
  channels: channelSeeds,
  snapshots: extraSnapshots,
};
