// John Twin + John Notebooks (ferramenta interna: registros, rastreamento,
// telemetria): dados de demonstração da organização. Frontend puro.

export type TwinKind =
  | "department"
  | "person"
  | "role"
  | "machine"
  | "system"
  | "project"
  | "client"
  | "contract";

export interface TwinNode {
  id: string;
  kind: TwinKind;
  name: string;
  detail: string;
  /** Departamento ao qual o nó pertence no grafo. */
  dept?: string;
  /** Rótulo de estado (ex.: máquina parada). */
  status?: string;
}

export interface TwinEdge {
  from: string;
  to: string;
  label?: string;
}

export interface NotebookEntry {
  id: string;
  date: string;
  author: string;
  text: string;
  tags: string[];
  /** Nós do Twin citados pela entrada. */
  links: string[];
}

export type NotebookOwnerKind = "person" | "department" | "equipment" | "project" | "client" | "agent" | "case";

export interface Notebook {
  id: string;
  title: string;
  ownerKind: NotebookOwnerKind;
  ownerId: string;
  /** Quem pode ler, em termos de cargos/áreas. */
  visibility: string[];
  entries: NotebookEntry[];
}

export const KIND_LABEL: Record<TwinKind, string> = {
  department: "Departamento",
  person: "Pessoa",
  role: "Cargo",
  machine: "Máquina",
  system: "Sistema",
  project: "Projeto",
  client: "Cliente",
  contract: "Contrato",
};

export const TWIN_NODES: TwinNode[] = [
  { id: "org", kind: "department", name: "Fábrica São Paulo", detail: "Unidade principal — 412 pessoas, 3 turnos." },
  // Departamentos
  { id: "d-manutencao", kind: "department", name: "Manutenção", detail: "12 técnicos, 3 engenheiros. OEM: CNC e prensas.", dept: "org" },
  { id: "d-producao", kind: "department", name: "Produção", detail: "3 linhas, 180 operadores.", dept: "org" },
  { id: "d-qualidade", kind: "department", name: "Qualidade", detail: "Inspeção e liberação de lotes.", dept: "org" },
  { id: "d-financeiro", kind: "department", name: "Financeiro", detail: "Contas, custos e orçamento de manutenção.", dept: "org" },
  { id: "d-ti", kind: "department", name: "TI", detail: "Integrações, identidade e dados.", dept: "org" },
  // Pessoas
  { id: "p-carlos", kind: "person", name: "Carlos Mendes", detail: "Técnico de manutenção sênior, turno A.", dept: "d-manutencao" },
  { id: "p-ana", kind: "person", name: "Ana Souza", detail: "Engenheira de processo — lidera a investigação de paradas.", dept: "d-manutencao" },
  { id: "p-bruno", kind: "person", name: "Bruno Lima", detail: "Analista financeiro — orçamento de manutenção.", dept: "d-financeiro" },
  { id: "p-marina", kind: "person", name: "Marina Costa", detail: "Diretora de operações.", dept: "org" },
  { id: "p-davi", kind: "person", name: "Davi Rocha", detail: "Integrações e identidade de acessos.", dept: "d-ti" },
  // Cargos
  { id: "r-tecnico", kind: "role", name: "Técnico de Manutenção", detail: "Vê ordens, histórico de máquinas e procedimentos.", dept: "d-manutencao" },
  { id: "r-engenheiro", kind: "role", name: "Engenheiro de Processo", detail: "Vê telemetria completa e custos de parada.", dept: "d-manutencao" },
  { id: "r-diretor", kind: "role", name: "Diretor de Operações", detail: "Vê consolidado de todas as áreas.", dept: "org" },
  // Máquinas
  { id: "m-cnc01", kind: "machine", name: "CNC-01", detail: "Centro de usinagem 5 eixos. Compressor de hidráulica é o ponto fraco.", dept: "d-producao", status: "parada" },
  { id: "m-prensa02", kind: "machine", name: "Prensa-02", detail: "Prensa hidráulica 200t.", dept: "d-producao" },
  { id: "m-robo03", kind: "machine", name: "Robô-03", detail: "Palletizador da linha 2.", dept: "d-producao" },
  { id: "m-compressor", kind: "machine", name: "Compressor-04", detail: "Ar comprimido — alimenta CNC-01 e Prensa-02.", dept: "d-manutencao" },
  // Sistemas
  { id: "s-telemetry", kind: "system", name: "TelemetryOS", detail: "Telemetria das máquinas e registro operacional.", dept: "d-ti" },
  { id: "s-sap", kind: "system", name: "SAP PM", detail: "Ordens de manutenção e estoque de peças.", dept: "d-ti" },
  { id: "s-excel", kind: "system", name: "Planilhas de turno", detail: "Registro de turno dos operadores.", dept: "d-producao" },
  { id: "s-powerbi", kind: "system", name: "Power BI", detail: "Indicadores de OEE e custos.", dept: "d-financeiro" },
  { id: "s-outlook", kind: "system", name: "Outlook", detail: "Aprovações e comunicação com fornecedores.", dept: "org" },
  // Projetos
  { id: "prj-paradas", kind: "project", name: "Redução de paradas Q1", detail: "Meta: -30% de paradas não planejadas.", dept: "d-manutencao" },
  // Comercial (clientes e contratos aparecem via conectores da Loja)
  { id: "d-comercial", kind: "department", name: "Comercial", detail: "Contas, contratos e entregas.", dept: "org" },
  { id: "c-acme", kind: "client", name: "Acme Metalúrgica", detail: "Contrato de manutenção assistida.", dept: "d-comercial" },
  { id: "c-delta", kind: "client", name: "Delta Plásticos", detail: "Projeto de automação em andamento.", dept: "d-comercial" },
  { id: "k-acme", kind: "contract", name: "Contrato ACME-2026", detail: "SLA 4h, renovável em ago. de 2026.", dept: "d-comercial" },
];

export const TWIN_EDGES: TwinEdge[] = [
  { from: "d-manutencao", to: "d-producao", label: "atende" },
  { from: "p-carlos", to: "r-tecnico", label: "ocupa" },
  { from: "p-ana", to: "r-engenheiro", label: "ocupa" },
  { from: "p-marina", to: "r-diretor", label: "ocupa" },
  { from: "m-cnc01", to: "s-telemetry", label: "telemetria" },
  { from: "m-prensa02", to: "s-telemetry", label: "telemetria" },
  { from: "m-compressor", to: "m-cnc01", label: "alimenta" },
  { from: "m-compressor", to: "m-prensa02", label: "alimenta" },
  { from: "d-manutencao", to: "s-sap", label: "ordens" },
  { from: "d-producao", to: "s-excel", label: "registro" },
  { from: "d-financeiro", to: "s-powerbi", label: "indicadores" },
  { from: "p-carlos", to: "prj-paradas", label: "participa" },
  { from: "p-ana", to: "prj-paradas", label: "lidera" },
  { from: "p-davi", to: "s-sap", label: "integra" },
  { from: "k-acme", to: "c-acme", label: "vincula" },
];

export const NOTEBOOKS: Notebook[] = [
  {
    id: "nb-cnc01",
    title: "Caderno — CNC-01",
    ownerKind: "equipment",
    ownerId: "m-cnc01",
    visibility: ["Manutenção", "Produção", "Diretoria"],
    entries: [
      {
        id: "nbe-1",
        date: "2026-11-07T14:12:00-03:00",
        author: "John (TelemetryOS)",
        text: "Parada não planejada detectada às 14:12. Pressão hidráulica abaixo de 90 bar por 4 min. Workflow abriu a ordem OM-4821 no SAP PM e notificou Carlos Mendes.",
        tags: ["parada", "hidráulica", "om-4821"],
        links: ["m-cnc01", "s-telemetry", "s-sap", "p-carlos"],
      },
      {
        id: "nbe-2",
        date: "2026-11-07T14:40:00-03:00",
        author: "Carlos Mendes",
        text: "Válvula da unidade hidráulica com vazamento — mesma causa da ocorrência de setembro. Compressor-04 manteve 88 bar; suspeita de desgaste no selo.",
        tags: ["investigação", "hidráulica"],
        links: ["m-cnc01", "m-compressor"],
      },
      {
        id: "nbe-3",
        date: "2026-11-07T16:05:00-03:00",
        author: "Ana Souza",
        text: "Fechamento: troca do selo programada para domingo. Plano de prevenção: monitorar pressão do Compressor-04 com alarme em 95 bar e revisão trimestral do circuito. Conhecimento aprovado para o caderno institucional.",
        tags: ["fechamento", "prevenção"],
        links: ["m-compressor", "prj-paradas"],
      },
      {
        id: "nbe-4",
        date: "2026-09-18T10:30:00-03:00",
        author: "John (registro)",
        text: "Ocorrência anterior: superaquecimento do spindle após 6h de ciclo contínuo. Resolução: ajuste de refrigeração e novo ciclo de lubrificação.",
        tags: ["spindle", "histórico"],
        links: ["m-cnc01"],
      },
    ],
  },
  {
    id: "nb-manutencao",
    title: "Caderno — Manutenção",
    ownerKind: "department",
    ownerId: "d-manutencao",
    visibility: ["Manutenção", "Diretoria"],
    entries: [
      {
        id: "nbe-m1",
        date: "2026-11-05T08:00:00-03:00",
        author: "Ana Souza",
        text: "Padrão da área: toda parada com causa hidráulica ganha registro no caderno da máquina e apontamento no projeto Redução de paradas Q1.",
        tags: ["padrão"],
        links: ["prj-paradas"],
      },
      {
        id: "nbe-m2",
        date: "2026-10-28T17:20:00-03:00",
        author: "John (resumo semanal)",
        text: "Semana: 3 paradas não planejadas (-2 vs. semana anterior). Causa líder: hidráulica. Peça crítica em falta: selo kit CNC (estoque 1).",
        tags: ["resumo", "estoque"],
        links: ["s-sap"],
      },
    ],
  },
  {
    id: "nb-carlos",
    title: "Caderno — Carlos Mendes",
    ownerKind: "person",
    ownerId: "p-carlos",
    visibility: ["Carlos Mendes", "Manutenção"],
    entries: [
      {
        id: "nbe-c1",
        date: "2026-11-07T14:45:00-03:00",
        author: "Carlos Mendes",
        text: "Preferência registrada: ao abrir ordem de hidráulica, o John deve trazer o procedimento PMP-114 e o histórico de válvulas da CNC-01 sem eu pedir.",
        tags: ["preferência"],
        links: ["r-tecnico"],
      },
    ],
  },
  {
    id: "nb-paradas",
    title: "Caderno — Redução de paradas Q1",
    ownerKind: "project",
    ownerId: "prj-paradas",
    visibility: ["Manutenção", "Produção", "Financeiro", "Diretoria"],
    entries: [
      {
        id: "nbe-p1",
        date: "2026-11-07T16:10:00-03:00",
        author: "John (projeto)",
        text: "Impacto da parada de hoje no projeto: 2,1 h de linha parada ≈ R$ 8,4 mil. Ação sugerida ao Bruno: revisar provisão de manutenção do mês.",
        tags: ["custo", "projeto"],
        links: ["p-bruno", "m-cnc01"],
      },
    ],
  },
  {
    id: "nb-acme",
    title: "Caderno — Acme Metalúrgica",
    ownerKind: "client",
    ownerId: "c-acme",
    visibility: ["Comercial", "Diretoria"],
    entries: [
      {
        id: "nbe-a1",
        date: "2026-11-03T09:00:00-03:00",
        author: "John (contrato)",
        text: "Renovação do Contrato ACME-2026 em 90 dias. SLA cumprido em 98,2% das ordens. Ponto de atenção: cliente pediu inclusão de telemetria das prensas.",
        tags: ["renovação", "sla"],
        links: ["k-acme", "s-telemetry"],
      },
    ],
  },
];
