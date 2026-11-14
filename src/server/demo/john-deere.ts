import {
  CONVERSATION_MEMORY_CHANGES_ITEM_TYPE,
  CONVERSATION_PLAN_ITEM_TYPE,
  CONVERSATION_SUBAGENTS_ITEM_TYPE,
  conversationPlanText,
  conversationSubagentsText,
  routineRunConversationEventItemType,
  type ClientAgentSummary,
  type ConversationMemoryChange,
  type ConversationPlan,
  type ConversationSubagent,
} from "@johnbot/contracts/ipc";
import { FACTORY_ROUTINE_PLAYBOOKS } from "../../preview/demo-seed";

/**
 * Factory people describe the John Twin reference organization. AI agent identities are
 * separate operational systems defined below; stable legacy IDs preserve existing links.
 */
export interface FactoryPerson {
  id: string;
  name: string;
  role: string;
  area: string;
  detail: string;
  provider: "codex" | "claude";
  preview: string;
}

export const FACTORY = "John Deere — Horizontina";

export const JOHN_DEERE_PEOPLE: FactoryPerson[] = [
  {
    id: "marina-costa",
    name: "Marina Costa",
    role: "Diretora de Operações",
    area: "Diretoria",
    detail: "Responde pelos três turnos e pelo resultado industrial da unidade.",
    provider: "codex",
    preview: "Fechei o consolidado do turno B: OEE 78% e duas paradas não planejadas.",
  },
  {
    id: "ana-souza",
    name: "Ana Souza",
    role: "Engenheira de Processo",
    area: "Usinagem",
    detail: "Lidera a investigação de paradas e o plano de prevenção da CNC-01.",
    provider: "claude",
    preview: "A válvula da hidráulica era a mesma causa de setembro. Selo trocado no domingo.",
  },
  {
    id: "carlos-mendes",
    name: "Carlos Mendes",
    role: "Técnico de Manutenção",
    area: "Manutenção",
    detail: "Turno A. Atende CNC-01, Prensa-02 e o Compressor-04.",
    provider: "codex",
    preview: "OM-4821 aberta no SAP PM com o histórico de válvulas anexado.",
  },
  {
    id: "rafael-nunes",
    name: "Rafael Nunes",
    role: "Supervisor de Montagem",
    area: "Montagem",
    detail: "Turno B da linha final da Série 6M. Meta de 28 máquinas por dia.",
    provider: "claude",
    preview: "Linha 6M fechou 26 máquinas; faltou kit de transmissão em duas estações.",
  },
  {
    id: "camila-reis",
    name: "Camila Reis",
    role: "Analista de Qualidade",
    area: "Qualidade",
    detail: "Liberação de lote e tratamento de não conformidade.",
    provider: "codex",
    preview: "Lote 6M-2411 liberado com 2 desvios de torque já tratados.",
  },
  {
    id: "lucas-ferreira",
    name: "Lucas Ferreira",
    role: "Técnico de Motores",
    area: "Sistemas de Potência",
    detail: "Bancada de teste de motores diesel e torque de cabeçote.",
    provider: "codex",
    preview: "Motor 6090 testado: 12 min de queima, sem desvio de pressão.",
  },
  {
    id: "patricia-alves",
    name: "Patrícia Alves",
    role: "Analista de Suprimentos",
    area: "Suprimentos",
    detail: "Peças críticas e prazo de fornecedor para a linha.",
    provider: "claude",
    preview: "Kit de selo da CNC-01 em estoque 1 — pedido de reposição aberto.",
  },
  {
    id: "davi-rocha",
    name: "Davi Rocha",
    role: "Engenheiro de Automação",
    area: "Engenharia e Tecnologia",
    detail: "Integrações, telemetria embarcada e identidade de acessos.",
    provider: "claude",
    preview: "Telemetria da 6M publicando a cada 30 s; alarme de pressão validado.",
  },
  {
    id: "juliana-prado",
    name: "Juliana Prado",
    role: "Engenheira de Produto",
    area: "Engenharia e Tecnologia",
    detail: "Série 6M: ensaios, liberação e conectividade no campo.",
    provider: "codex",
    preview: "Ensaio de campo da 6M aprovado; falta o parecer do jurídico no contrato Sul.",
  },
  {
    id: "bruno-lima",
    name: "Bruno Lima",
    role: "Analista Financeiro",
    area: "Finanças",
    detail: "Orçamento de manutenção e custo de parada por linha.",
    provider: "claude",
    preview: "Custo de parada do mês: R$ 184 mil, 62% da meta trimestral.",
  },
  {
    id: "sofia-barros",
    name: "Sofia Barros",
    role: "Analista de Pós-Vendas",
    area: "Pós-Vendas",
    detail: "Concessionárias da região Sul e SLA de peças em 48 h.",
    provider: "codex",
    preview: "Concessionária Sul com 3 chamados abertos; peça crítica chega amanhã.",
  },
  {
    id: "renata-dias",
    name: "Renata Dias",
    role: "Analista de RH",
    area: "Recursos Humanos",
    detail: "Escala dos três turnos e treinamento da linha 6M.",
    provider: "claude",
    preview: "Escala do turno C fechada; dois operadores em treinamento na montagem.",
  },
  {
    id: "eduardo-martins",
    name: "Eduardo Martins",
    role: "Advogado",
    area: "Jurídico",
    detail: "Contratos de fornecimento, conformidade e pareceres para a operação.",
    provider: "codex",
    preview: "Contrato Sul-2026 revisado; a cláusula de SLA de 48 h segue para aprovação.",
  },
  {
    id: "thiago-ramos",
    name: "Thiago Ramos",
    role: "Soldador Robotizado",
    area: "Solda",
    detail: "Célula 2 de solda robotizada, parâmetros de processo e inspeção visual.",
    provider: "claude",
    preview: "Célula 2 estabilizada após ajuste de gás; a inspeção aprovou as primeiras 18 peças.",
  },
];

/** AI agents are operational systems. Factory people stay in the John Twin only. */
const FACTORY_AGENT_IDENTITIES = [
  ["marina-costa", "Orquestrador de Operações", "Diretoria", "Consolida turnos, riscos e decisões industriais."],
  ["ana-souza", "Diagnóstico de Processo", "Usinagem", "Analisa paradas, causa raiz e prevenção da CNC-01."],
  ["carlos-mendes", "Coordenador de Manutenção", "Manutenção", "Prioriza ordens, janelas e ativos críticos."],
  ["rafael-nunes", "Controle de Montagem", "Montagem", "Equilibra a linha 6M, abastecimento e volume diário."],
  ["camila-reis", "Guardião da Qualidade", "Qualidade", "Rastreia lote, torque, desvios e critérios de bloqueio."],
  ["lucas-ferreira", "Monitor de Motores", "Sistemas de Potência", "Acompanha bancada, pressão e liberação de motores."],
  ["patricia-alves", "Planejador de Suprimentos", "Suprimentos", "Protege peças críticas, fornecedores e alternativas homologadas."],
  ["davi-rocha", "Especialista em Automação", "Engenharia e Tecnologia", "Monitora telemetria, integrações e alarmes da fábrica."],
  ["juliana-prado", "Coordenador de Produto", "Engenharia e Tecnologia", "Orquestra ensaios, liberação e conectividade da Série 6M."],
  ["bruno-lima", "Analista de Custos", "Finanças", "Converte paradas e riscos em impacto financeiro."],
  ["sofia-barros", "Assistente de Pós-Vendas", "Pós-Vendas", "Prioriza concessionárias, SLA e atendimento de campo."],
  ["renata-dias", "Planejador de Pessoas", "Recursos Humanos", "Coordena escala, treinamento e cobertura de turnos."],
  ["eduardo-martins", "Consultor de Conformidade", "Jurídico", "Revisa contratos, riscos e aprovações regulatórias."],
  ["thiago-ramos", "Supervisor de Solda", "Solda", "Controla parâmetros robotizados e inspeção da célula 2."],
] as const;

export const JOHN_DEERE_AGENTS: ClientAgentSummary[] = FACTORY_AGENT_IDENTITIES.map(([id, name, area, detail], index) => ({
  id,
  name,
  title: "Agente operacional",
  description: `${area} · ${detail}`,
  notifications: true,
  provider: index % 2 === 0 ? "codex" : "claude",
  model: index % 2 === 0 ? "gpt-5.6-luna" : "claude-sonnet-5",
  reasoningEffort: index % 3 === 0 ? "high" : "medium",
  threadId: `thread-${id}`,
  workspacePath: `/johnbot/Agents/${id}`,
  preview: detail,
  updatedAt: null,
  avatarSeed: `agent-${id}`,
  avatarHue: [245, 185, 55, 320, 150, 30, 215, 0][index % 8] as ClientAgentSummary["avatarHue"],
  avatarUrl: null,
}));

interface FactoryConversationBrief {
  request: string;
  summary: string;
  followUp: string;
  nextStep: string;
  confirmation: string;
  result: string;
}

/** Conversas de trabalho persistidas para a fábrica: contexto, decisão e acompanhamento. */
const FACTORY_CONVERSATIONS: Record<string, FactoryConversationBrief> = {
  "marina-costa": {
    request: "Feche o consolidado dos três turnos e destaque riscos para a reunião das 08:00.",
    summary: "Turno B encerrou com OEE de 78%, duas paradas não planejadas e backlog de 4 ordens críticas. A produção da Série 6M ficou em 26 de 28 máquinas.",
    followUp: "Quais decisões precisam de mim antes da troca de turno?",
    nextStep: "Aprovar prioridade para Compressor-04, liberar reposição do kit de transmissão e manter a inspeção de torque reforçada no lote 6M-2411.",
    confirmation: "Registre responsáveis e o horário de retorno de cada frente.",
    result: "Plano registrado: Carlos atualiza manutenção às 09:30, Patrícia confirma peças às 10:00 e Camila publica a liberação do lote às 11:00.",
  },
  "ana-souza": {
    request: "Resuma a investigação da parada da CNC-01 e compare com o evento de setembro.",
    summary: "A oscilação de pressão coincide com a falha anterior: válvula hidráulica com vedação degradada. O selo foi substituído no domingo e a telemetria não mostrou novo pico.",
    followUp: "O que falta para encerrar a causa raiz e evitar repetição?",
    nextStep: "Manter medição de pressão a cada 30 segundos por sete dias, revisar o intervalo de inspeção da válvula e anexar a análise à OM-4821.",
    confirmation: "Inclua impacto de produção e a ação preventiva na revisão semanal.",
    result: "Análise atualizada: 42 minutos evitados por turno estimado; ação preventiva atribuída à manutenção e revisão marcada para sexta-feira.",
  },
  "carlos-mendes": {
    request: "Mostre o estado das ordens da CNC-01, Prensa-02 e Compressor-04 no turno A.",
    summary: "OM-4821 da CNC-01 está em observação pós-troca; Prensa-02 segue disponível; Compressor-04 tem inspeção preventiva programada antes do turno B.",
    followUp: "Há peça ou bloqueio que possa parar a linha hoje?",
    nextStep: "O kit de selo está no estoque com uma unidade. Solicitei reposição e deixei a inspeção do compressor como prioridade antes da janela de montagem.",
    confirmation: "Avise a operação se a janela do compressor ultrapassar 20 minutos.",
    result: "Alerta configurado e procedimento anexado à ordem. Nenhuma parada aberta no início do turno.",
  },
  "rafael-nunes": {
    request: "Como fechou a linha 6M e qual é o plano para recuperar o volume amanhã?",
    summary: "A linha fechou 26 máquinas. Duas estações ficaram aguardando kit de transmissão; qualidade não registrou bloqueio de lote.",
    followUp: "Organize a recuperação sem criar hora extra desnecessária.",
    nextStep: "Priorizar os dois kits no abastecimento das 07:00, sequenciar as cabines já liberadas e revisar o balanceamento da estação 4 com logística.",
    confirmation: "Me traga um checkpoint depois das primeiras dez máquinas.",
    result: "Checkpoint agendado para 10:15; plano aponta retorno a 28 máquinas sem hora extra se os kits chegarem no primeiro abastecimento.",
  },
  "camila-reis": {
    request: "Qual é a condição do lote 6M-2411 e dos desvios de torque?",
    summary: "O lote foi liberado com dois desvios de torque tratados. As medições posteriores ficaram dentro da faixa e as peças afetadas estão rastreadas.",
    followUp: "Precisamos conter algo antes de expedir?",
    nextStep: "Manter amostragem reforçada nas próximas 30 unidades e bloquear somente a estação se houver terceiro desvio consecutivo.",
    confirmation: "Publique o critério de bloqueio para montagem e pós-vendas.",
    result: "Critério publicado e ciência registrada; nenhuma unidade expedida sem rastreabilidade do torque.",
  },
  "lucas-ferreira": {
    request: "Atualize a bancada de teste de motores e os desvios de pressão.",
    summary: "O motor 6090 completou 12 minutos de queima sem desvio de pressão. Torque de cabeçote e temperatura ficaram dentro da especificação.",
    followUp: "Existe risco para a sequência de testes do turno B?",
    nextStep: "Não há bloqueio. Vou repetir a leitura após o resfriamento e liberar a próxima unidade com o mesmo roteiro de bancada.",
    confirmation: "Envie o registro ao time de qualidade quando concluir.",
    result: "Registro enviado à qualidade e bancada liberada para a próxima unidade às 14:20.",
  },
  "patricia-alves": {
    request: "Confirme disponibilidade das peças críticas da CNC-01 e da montagem 6M.",
    summary: "Há um kit de selo da CNC-01 em estoque e pedido de reposição aberto. Os kits de transmissão têm entrega confirmada para o primeiro abastecimento de amanhã.",
    followUp: "Qual fornecedor exige escalonamento hoje?",
    nextStep: "O fornecedor do selo recebeu pedido expresso; vou confirmar coleta até 16:00 e manter alternativa homologada preparada.",
    confirmation: "Relacione custo e risco caso a coleta não seja confirmada.",
    result: "Cenário registrado: sem coleta, cobertura para um ciclo; alternativa homologada preserva a manutenção preventiva sem parada adicional.",
  },
  "davi-rocha": {
    request: "Valide telemetria da Série 6M, alarme de pressão e acessos do turno.",
    summary: "A telemetria está publicando a cada 30 segundos. O alarme de pressão da CNC-01 foi validado e os acessos de manutenção seguem ativos somente para os grupos aprovados.",
    followUp: "Há integração pendente que afete o relatório da operação?",
    nextStep: "Vou monitorar a fila de eventos do MES e reconciliar a leitura da CNC-01 com SAP PM após a próxima ordem concluída.",
    confirmation: "Mantenha auditoria de acesso no relatório diário.",
    result: "Auditoria incluída: nenhum acesso fora do grupo autorizado e fila de eventos sem atraso.",
  },
  "juliana-prado": {
    request: "Resuma o ensaio de campo da Série 6M e as pendências para a liberação.",
    summary: "O ensaio de campo foi aprovado; conectividade embarcada e desempenho operacional cumpriram os critérios. Falta o parecer jurídico do Contrato Sul-2026.",
    followUp: "O que precisa entrar na próxima revisão de produto?",
    nextStep: "Incluir o resultado de conectividade, o plano de ramp-up de 28 máquinas e a pendência contratual com responsável e prazo.",
    confirmation: "Prepare uma nota executiva de uma página para diretoria.",
    result: "Nota preparada com decisão solicitada, evidências do ensaio e dependência jurídica destacada para a reunião de sexta-feira.",
  },
  "bruno-lima": {
    request: "Atualize custo de parada e consumo do orçamento de manutenção.",
    summary: "O custo de parada do mês está em R$ 184 mil, equivalente a 62% da meta trimestral. A CNC-01 concentra o maior impacto, mas a prevenção reduz a projeção para o próximo ciclo.",
    followUp: "Qual decisão financeira protege a meta sem cortar manutenção crítica?",
    nextStep: "Reservar orçamento para o kit de selo e Compressor-04; postergar somente despesas não críticas de melhoria estética.",
    confirmation: "Cruze a recomendação com o plano de produção da Série 6M.",
    result: "Cenário conciliado: investimento preventivo mantém a recuperação de 28 máquinas e reduz risco de custo extraordinário.",
  },
  "sofia-barros": {
    request: "Mostre os chamados da Concessionária Sul e o risco para o SLA de peças.",
    summary: "Há três chamados abertos. A peça crítica principal chega amanhã; dois casos estão dentro do SLA e um aguarda confirmação de transporte.",
    followUp: "Como manter a concessionária informada sem prometer data incerta?",
    nextStep: "Enviar atualização com janela confirmada, informar o acompanhamento do transporte e abrir contingência com estoque regional.",
    confirmation: "Registre a comunicação no contrato e acione jurídico se o SLA ficar em risco.",
    result: "Comunicação enviada e rastreada; jurídico será acionado automaticamente se a confirmação não chegar até 15:00.",
  },
  "renata-dias": {
    request: "Confirme escala dos três turnos e a situação do treinamento na montagem.",
    summary: "Turno C está fechado. Dois operadores permanecem em treinamento na montagem, com cobertura prevista para não reduzir a meta da Série 6M.",
    followUp: "Há risco de competência para a estação 4 amanhã?",
    nextStep: "Manter um operador certificado como sombra nos dois primeiros ciclos e registrar a avaliação no fim do turno.",
    confirmation: "Avise montagem e segurança do trabalho sobre a dupla de acompanhamento.",
    result: "Escala e acompanhamento confirmados; nenhuma lacuna de certificação identificada para o turno seguinte.",
  },
  "eduardo-martins": {
    request: "Revise o Contrato Sul-2026 e destaque cláusulas que dependem de decisão operacional.",
    summary: "A minuta está aderente ao SLA de peças em 48 horas. A cláusula de exceção precisa do critério de indisponibilidade aprovado por operações e pós-vendas.",
    followUp: "Qual texto protege a fábrica sem comprometer o relacionamento com a rede?",
    nextStep: "Manter comunicação preventiva, exigir rastreabilidade do transporte e limitar a exceção a evento comprovado fora do controle da fábrica.",
    confirmation: "Envie a redação para Marina e Sofia com prazo de retorno.",
    result: "Parecer compartilhado; revisão conjunta marcada antes da assinatura e sem pendências de conformidade abertas.",
  },
  "thiago-ramos": {
    request: "Atualize a célula 2 de solda e a inspeção das primeiras peças após o ajuste.",
    summary: "A célula estabilizou após ajuste de gás. A inspeção visual aprovou as primeiras 18 peças e os parâmetros do robô ficaram dentro da receita liberada.",
    followUp: "O que devemos observar antes de liberar o ritmo normal?",
    nextStep: "Acompanhar por mais dois lotes, registrar consumo de gás e chamar qualidade se surgir porosidade acima do limite visual.",
    confirmation: "Deixe o checklist disponível para o turno seguinte.",
    result: "Checklist publicado na célula e passagem de turno preparada com parâmetros, amostras e responsável de qualidade.",
  },
};

type FactoryConversationMessage = {
  author: "user" | "agent" | "system";
  text: string;
  itemType?: string;
  attachments?: Array<{ id: string; name: string; size: number; kind: "file"; mimeType: string; previewKind: "pdf" | "text"; previewUrl: null }>;
  plan?: ConversationPlan;
  subagents?: ConversationSubagent[];
  memoryChanges?: ConversationMemoryChange[];
  routine?: { routineId: string; runId: string; name: string; scheduledFor: string };
};

function factoryWorkItems(id: string): FactoryConversationMessage[] {
  const brief = FACTORY_CONVERSATIONS[id];
  const playbook = FACTORY_ROUTINE_PLAYBOOKS[id];
  const agent = JOHN_DEERE_AGENTS.find((agent) => agent.id === id)!;
  const plan: ConversationPlan = {
    explanation: `${agent.name}: ${brief.followUp}`,
    steps: playbook.map((text, index) => ({ id: `etapa-${index}`, text, status: "completed" as const })),
  };
  const subagents: ConversationSubagent[] = [
    {
      id: `subagent-${id}-dados`,
      title: playbook[0],
      agentType: "analyst",
      prompt: brief.request,
      status: "completed",
      startedAt: "2026-11-13T08:00:00.000Z",
      endedAt: "2026-11-13T08:02:00.000Z",
      steps: [
        { id: "ler", kind: "read", text: playbook[1] },
        { id: "resumo", kind: "text", text: brief.summary },
      ],
      error: null,
    },
    {
      id: `subagent-${id}-risco`,
      title: playbook[3],
      agentType: "reviewer",
      prompt: brief.followUp,
      status: "completed",
      startedAt: "2026-11-13T08:01:00.000Z",
      endedAt: "2026-11-13T08:03:00.000Z",
      steps: [{ id: "validar", kind: "thinking", text: brief.nextStep }],
      error: null,
    },
  ];
  const memoryChanges: ConversationMemoryChange[] = [
    { memoryId: `memory-${id}-turno`, action: "saved", text: brief.result },
  ];
  const routineId = `routine-factory-${id}-opening`;
  const runId = `run-${routineId}`;
  return [
    { author: "assistant", itemType: CONVERSATION_PLAN_ITEM_TYPE, text: conversationPlanText(plan), plan },
    { author: "assistant", itemType: CONVERSATION_SUBAGENTS_ITEM_TYPE, text: conversationSubagentsText(subagents), subagents },
    {
      author: "system",
      itemType: routineRunConversationEventItemType("succeeded", routineId, runId),
      text: playbook[0],
      routine: { routineId, runId, name: playbook[0], scheduledFor: "2026-11-13T08:00:00.000Z" },
    },
    { author: "system", itemType: CONVERSATION_MEMORY_CHANGES_ITEM_TYPE, text: "Memória: 1 salva, 0 atualizadas, 0 esquecidas.", memoryChanges },
    { author: "agent", text: `### Caderno de análise — ${agent.name}\n\n${brief.summary}\n\n| Verificação | Evidência esperada |\n| --- | --- |\n${playbook.map((step, index) => `| ${index + 1} | ${step} |`).join("\n")}\n\n**Decisão:** ${brief.nextStep}\n\n**Retorno:** ${brief.result}\n\n\`\`\`mermaid\nflowchart TD\n  fonte["${agent.name}"] --> diagnostico["${playbook[0]}"]\n  diagnostico --> revisao["${playbook[3]}"]\n  revisao --> entrega["${playbook[4]}"]\n\`\`\`\n\n_Dados e execução demonstrativos; nenhuma ação foi enviada à fábrica._` },
  ];
}

/** Conversas por função mostram evidência, plano, delegação, rotina e memória. */
export function johnDeereConversation(id: string): FactoryConversationMessage[] {
  const conversation = FACTORY_CONVERSATIONS[id];
  if (!conversation) return [];
  const key = id.replace(/[^a-z0-9]/gu, "");
  const operational = ["marina-costa", "rafael-nunes", "camila-reis", "thiago-ramos"].includes(id);
  const technical = ["ana-souza", "carlos-mendes", "lucas-ferreira", "davi-rocha", "juliana-prado"].includes(id);
  const evidence = operational ? "relatorio-do-turno.pdf" : technical ? "laudo-tecnico.pdf" : "analise-de-impacto.xlsx";
  const plan = operational ? "quadro-de-acoes.md" : technical ? "procedimento-de-execucao.md" : "recomendacao-executiva.md";

  if (operational) {
    return [
      { author: "system", itemType: "event", text: "Passagem de turno recebida; indicadores da fábrica conciliados." },
      { author: "user", text: conversation.request },
      { author: "agent", text: `${conversation.summary}\n\n| Indicador | Resultado |\n| --- | --- |\n| Status | Em acompanhamento |\n| Próximo retorno | Próximo turno |`, attachments: [{ id: `arquivo-${key}-evidencia`, name: evidence, size: 284_000, kind: "file", mimeType: "application/pdf", previewKind: "pdf", previewUrl: null }] },
      { author: "user", text: conversation.followUp },
      { author: "agent", text: conversation.nextStep },
      { author: "system", itemType: "event", text: "Responsáveis notificados e prazo de retorno criado na agenda de operação." },
      { author: "user", text: conversation.confirmation },
      { author: "agent", text: conversation.result, attachments: [{ id: `arquivo-${key}-plano`, name: plan, size: 3_840, kind: "file", mimeType: "text/markdown", previewKind: "text", previewUrl: null }] },
      ...factoryWorkItems(id),
    ];
  }

  if (technical) {
    return [
      { author: "user", text: conversation.request },
      { author: "agent", text: "Vou cruzar histórico, telemetria e procedimento antes de recomendar qualquer ação." },
      { author: "system", itemType: "event", text: "Consulta técnica concluída: registros de manutenção e telemetria disponíveis." },
      { author: "agent", text: conversation.summary, attachments: [{ id: `arquivo-${key}-evidencia`, name: evidence, size: 284_000, kind: "file", mimeType: "application/pdf", previewKind: "pdf", previewUrl: null }] },
      { author: "user", text: conversation.followUp },
      { author: "agent", text: conversation.nextStep, attachments: [{ id: `arquivo-${key}-plano`, name: plan, size: 3_840, kind: "file", mimeType: "text/markdown", previewKind: "text", previewUrl: null }] },
      { author: "user", text: conversation.confirmation },
      { author: "agent", text: conversation.result },
      ...factoryWorkItems(id),
    ];
  }

  return [
    { author: "user", text: conversation.request },
    {
      author: "agent",
      text: conversation.summary,
      attachments: [{ id: `arquivo-${key}-evidencia`, name: evidence, size: 284_000, kind: "file", mimeType: "application/pdf", previewKind: "pdf", previewUrl: null }],
    },
    { author: "system", itemType: "event", text: "Dados corporativos reconciliados; evidências e decisão registradas para acompanhamento." },
    { author: "user", text: conversation.followUp },
    {
      author: "agent",
      text: conversation.nextStep,
      attachments: [{ id: `arquivo-${key}-plano`, name: plan, size: 3_840, kind: "file", mimeType: "text/markdown", previewKind: "text", previewUrl: null }],
    },
    { author: "user", text: conversation.confirmation },
    { author: "agent", text: conversation.result },
    ...factoryWorkItems(id),
  ];
}

const AREA_SECTOR: Record<string, string> = {
  Diretoria: "sec-diretoria",
  Usinagem: "sec-manufatura",
  Manutenção: "sec-manufatura",
  Montagem: "sec-manufatura",
  Qualidade: "sec-manufatura",
  "Sistemas de Potência": "sec-potencia",
  Solda: "sec-manufatura",
  Suprimentos: "sec-corporativo",
  Finanças: "sec-corporativo",
  "Pós-Vendas": "sec-corporativo",
  "Recursos Humanos": "sec-corporativo",
  Jurídico: "sec-corporativo",
  "Engenharia e Tecnologia": "sec-engenharia",
};

const SECTORS = [
  { id: "sec-diretoria", name: "Diretoria" },
  { id: "sec-engenharia", name: "Engenharia e Tecnologia" },
  { id: "sec-manufatura", name: "Manufatura e Operações" },
  { id: "sec-potencia", name: "Sistemas de Potência" },
  { id: "sec-corporativo", name: "Suporte Corporativo" },
];

/** The sidebar layout must name its built-in sections as well as every factory sector. */
export function johnDeereSidebar() {
  const agentAssignments: Record<string, string> = {};
  for (const agent of JOHN_DEERE_AGENTS) {
    const area = agent.description.split(" · ")[0] ?? "";
    const sector = AREA_SECTOR[area];
    if (sector) agentAssignments[agent.id] = sector;
  }
  return {
    layout: {
      revision: 1,
      sections: SECTORS,
      order: ["people", "unassigned", ...SECTORS.map((sector) => sector.id)],
      agentAssignments,
      agentOrder: JOHN_DEERE_AGENTS.map((agent) => agent.id),
    },
    pins: { items: [], updatedAt: null },
  };
}
