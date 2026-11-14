/**
 * John Twin seed: the John Deere factory as rows, so the Twin screens read PostgreSQL.
 * Run with `bun prisma/seed-john-twin.ts`. It updates only the factory fixture rows.
 */
import { closeDatabase, getDatabase } from "../src/server/database/client";

type Node = { id: string; kind: string; name: string; detail: string; dept?: string; status?: string };
type Edge = { from: string; to: string; label: string };

const org = "org";

const nodes: Node[] = [
  // The factory
  { id: org, kind: "department", name: "John Deere — Horizontina", detail: "Fábrica de máquinas agrícolas. 2.300 pessoas, 3 turnos." },

  // Áreas corporativas e industriais
  { id: "d-eng", kind: "department", name: "Engenharia e Tecnologia", detail: "Produto, automação, IA e conectividade no campo.", dept: org },
  { id: "d-manuf", kind: "department", name: "Manufatura e Operações", detail: "Montagem, usinagem, solda, pintura, logística e qualidade.", dept: org },
  { id: "d-potencia", kind: "department", name: "Sistemas de Potência", detail: "Motores diesel e transmissões que equipam as máquinas.", dept: org },
  { id: "d-corp", kind: "department", name: "Suporte Corporativo", detail: "Finanças, RH, Jurídico, Suprimentos e Pós-Vendas.", dept: org },

  // Engenharia
  { id: "d-produto", kind: "department", name: "Engenharia de Produto", detail: "Série 6M e plataformas de colheita.", dept: "d-eng" },
  { id: "d-auto", kind: "department", name: "Automação e Conectividade", detail: "Telemetria embarcada e integrações de campo.", dept: "d-eng" },

  // Manufatura
  { id: "d-usinagem", kind: "department", name: "Usinagem", detail: "Centros de usinagem e prensas.", dept: "d-manuf" },
  { id: "d-solda", kind: "department", name: "Solda", detail: "Células robotizadas de solda.", dept: "d-manuf" },
  { id: "d-pintura", kind: "department", name: "Pintura", detail: "Cabine eletrostática e secagem.", dept: "d-manuf" },
  { id: "d-montagem", kind: "department", name: "Montagem", detail: "Linha final da Série 6M.", dept: "d-manuf" },
  { id: "d-logistica", kind: "department", name: "Logística", detail: "Abastecimento de linha e expedição.", dept: "d-manuf" },
  { id: "d-qualidade", kind: "department", name: "Qualidade", detail: "Inspeção e liberação de lotes.", dept: "d-manuf" },

  // Sistemas de potência
  { id: "d-motores", kind: "department", name: "Motores Diesel", detail: "Usinagem e montagem de motores.", dept: "d-potencia" },
  { id: "d-transmissao", kind: "department", name: "Transmissões", detail: "Conjuntos de transmissão e eixos.", dept: "d-potencia" },

  // Suporte corporativo
  { id: "d-financas", kind: "department", name: "Finanças", detail: "Custos, orçamento e resultado.", dept: "d-corp" },
  { id: "d-rh", kind: "department", name: "Recursos Humanos", detail: "Escala, treinamento e clima.", dept: "d-corp" },
  { id: "d-juridico", kind: "department", name: "Jurídico", detail: "Contratos de fornecimento e conformidade.", dept: "d-corp" },
  { id: "d-suprimentos", kind: "department", name: "Suprimentos", detail: "Compras e peças críticas.", dept: "d-corp" },
  { id: "d-posvendas", kind: "department", name: "Pós-Vendas", detail: "Rede de concessionárias e peças.", dept: "d-corp" },

  // Cargos
  { id: "r-diretor", kind: "role", name: "Diretor de Operações", detail: "Vê o consolidado de todas as áreas.", dept: org },
  { id: "r-eng-produto", kind: "role", name: "Engenheiro de Produto", detail: "Projeto, ensaios e liberação de produto.", dept: "d-produto" },
  { id: "r-eng-auto", kind: "role", name: "Engenheiro de Automação", detail: "Telemetria, integrações e dados de campo.", dept: "d-auto" },
  { id: "r-tecnico", kind: "role", name: "Técnico de Manutenção", detail: "Ordens, histórico de máquinas e procedimentos.", dept: "d-manuf" },
  { id: "r-operador", kind: "role", name: "Operador de Montagem", detail: "Apontamento de turno e qualidade na linha.", dept: "d-montagem" },
  { id: "r-soldador", kind: "role", name: "Soldador Robotizado", detail: "Parâmetros da célula e inspeção visual.", dept: "d-solda" },
  { id: "r-usinagem", kind: "role", name: "Operador de Usinagem", detail: "Programa, ferramenta e medição de peça.", dept: "d-usinagem" },
  { id: "r-pintura", kind: "role", name: "Pintor Industrial", detail: "Cabine, cura e padrão de cor.", dept: "d-pintura" },
  { id: "r-qualidade", kind: "role", name: "Analista de Qualidade", detail: "Liberação de lote e não conformidade.", dept: "d-qualidade" },
  { id: "r-motor", kind: "role", name: "Técnico de Motores", detail: "Bancada de teste e torque.", dept: "d-motores" },
  { id: "r-transmissao", kind: "role", name: "Técnico de Transmissão", detail: "Montagem e teste de transmissões.", dept: "d-transmissao" },
  { id: "r-compras", kind: "role", name: "Analista de Suprimentos", detail: "Cotações, prazos e estoque de peças.", dept: "d-suprimentos" },
  { id: "r-rh", kind: "role", name: "Analista de RH", detail: "Escala, férias e treinamento.", dept: "d-rh" },
  { id: "r-financeiro", kind: "role", name: "Analista Financeiro", detail: "Orçamento de manutenção e custo de parada.", dept: "d-financas" },
  { id: "r-juridico", kind: "role", name: "Advogado", detail: "Contratos e conformidade.", dept: "d-juridico" },
  { id: "r-posvendas", kind: "role", name: "Analista de Pós-Vendas", detail: "Concessionárias, peças e SLA.", dept: "d-posvendas" },

  // Pessoas
  { id: "p-marina", kind: "person", name: "Marina Costa", detail: "Diretora de operações. Responde pelos três turnos.", dept: org },
  { id: "p-ana", kind: "person", name: "Ana Souza", detail: "Engenheira de processo — lidera a investigação de paradas.", dept: "d-usinagem" },
  { id: "p-carlos", kind: "person", name: "Carlos Mendes", detail: "Técnico de manutenção sênior, turno A.", dept: "d-manuf" },
  { id: "p-bruno", kind: "person", name: "Bruno Lima", detail: "Analista financeiro — orçamento de manutenção.", dept: "d-financas" },
  { id: "p-davi", kind: "person", name: "Davi Rocha", detail: "Integrações e identidade de acessos.", dept: "d-auto" },
  { id: "p-juliana", kind: "person", name: "Juliana Prado", detail: "Engenheira de produto da Série 6M.", dept: "d-produto" },
  { id: "p-rafael", kind: "person", name: "Rafael Nunes", detail: "Supervisor de montagem, turno B.", dept: "d-montagem" },
  { id: "p-camila", kind: "person", name: "Camila Reis", detail: "Analista de qualidade — liberação de lotes.", dept: "d-qualidade" },
  { id: "p-lucas", kind: "person", name: "Lucas Ferreira", detail: "Técnico de motores diesel.", dept: "d-motores" },
  { id: "p-patricia", kind: "person", name: "Patrícia Alves", detail: "Analista de suprimentos — peças críticas.", dept: "d-suprimentos" },
  { id: "p-eduardo", kind: "person", name: "Eduardo Martins", detail: "Advogado — contratos de fornecimento.", dept: "d-juridico" },
  { id: "p-sofia", kind: "person", name: "Sofia Barros", detail: "Analista de pós-vendas — concessionárias.", dept: "d-posvendas" },
  { id: "p-thiago", kind: "person", name: "Thiago Ramos", detail: "Soldador robotizado, célula 2.", dept: "d-solda" },
  { id: "p-renata", kind: "person", name: "Renata Dias", detail: "Analista de RH — escala e treinamento.", dept: "d-rh" },

  // Máquinas
  { id: "m-cnc01", kind: "machine", name: "CNC-01", detail: "Centro de usinagem 5 eixos. Compressor de hidráulica é o ponto fraco.", dept: "d-usinagem", status: "parada" },
  { id: "m-prensa02", kind: "machine", name: "Prensa-02", detail: "Prensa hidráulica 200 t.", dept: "d-usinagem" },
  { id: "m-solda01", kind: "machine", name: "Solda-01", detail: "Célula robotizada de solda, dois robôs.", dept: "d-solda" },
  { id: "m-pintura01", kind: "machine", name: "Pintura-01", detail: "Cabine de pintura eletrostática.", dept: "d-pintura" },
  { id: "m-montagem01", kind: "machine", name: "Montagem 6M", detail: "Linha final da Série 6M.", dept: "d-montagem" },
  { id: "m-motor01", kind: "machine", name: "Teste Motores-01", detail: "Banco de testes de motores diesel.", dept: "d-motores" },
  { id: "m-trans01", kind: "machine", name: "Transmissão-01", detail: "Linha de montagem de transmissões.", dept: "d-transmissao" },
  { id: "m-compressor", kind: "machine", name: "Compressor-04", detail: "Ar comprimido — alimenta CNC-01 e Prensa-02.", dept: "d-manuf" },
  { id: "m-empilhadeira", kind: "machine", name: "Empilhadeira-07", detail: "Movimentação de linha no turno B.", dept: "d-logistica" },

  // Sistemas
  { id: "s-sap", kind: "system", name: "SAP PM", detail: "Ordens de manutenção e estoque de peças.", dept: "d-suprimentos" },
  { id: "s-telemetry", kind: "system", name: "TelemetryOS", detail: "Telemetria das máquinas e registro operacional.", dept: "d-auto" },
  { id: "s-mes", kind: "system", name: "MES Linha", detail: "Apontamento de produção e rastreabilidade.", dept: "d-montagem" },
  { id: "s-powerbi", kind: "system", name: "Power BI", detail: "Indicadores de OEE e custos.", dept: "d-financas" },
  { id: "s-turnos", kind: "system", name: "Apontamento de Turno", detail: "Registro de turno dos operadores.", dept: "d-montagem" },
  { id: "s-outlook", kind: "system", name: "Outlook", detail: "Aprovações e comunicação com fornecedores.", dept: org },

  // Projetos, clientes e contratos
  { id: "prj-paradas", kind: "project", name: "Redução de paradas Q1", detail: "Meta: -30% de paradas não planejadas.", dept: "d-manuf" },
  { id: "prj-conectividade", kind: "project", name: "Conectividade no campo", detail: "Telemetria embarcada na Série 6M.", dept: "d-auto" },
  { id: "prj-6m", kind: "project", name: "Ramp-up da Série 6M", detail: "Subir a linha para 28 máquinas por dia.", dept: "d-montagem" },
  { id: "c-sul", kind: "client", name: "Concessionária Sul", detail: "Rede de concessionárias da região Sul.", dept: org },
  { id: "k-sul", kind: "contract", name: "Contrato Sul-2026", detail: "SLA de peças em 48 h, renovável em ago. de 2026.", dept: org },
];

const occupies: Array<[string, string]> = [
  ["p-marina", "r-diretor"],
  ["p-ana", "r-eng-produto"],
  ["p-carlos", "r-tecnico"],
  ["p-bruno", "r-financeiro"],
  ["p-davi", "r-eng-auto"],
  ["p-juliana", "r-eng-produto"],
  ["p-rafael", "r-operador"],
  ["p-camila", "r-qualidade"],
  ["p-lucas", "r-motor"],
  ["p-patricia", "r-compras"],
  ["p-eduardo", "r-juridico"],
  ["p-sofia", "r-posvendas"],
  ["p-thiago", "r-soldador"],
  ["p-renata", "r-rh"],
];

const edges: Edge[] = [
  ...occupies.map(([person, role]): Edge => ({ from: person, to: role, label: "ocupa" })),
  { from: "d-eng", to: "d-manuf", label: "atende" },
  { from: "d-potencia", to: "d-manuf", label: "abastece" },
  { from: "d-corp", to: "d-manuf", label: "apoia" },
  { from: "d-eng", to: "prj-conectividade", label: "conduz" },
  { from: "m-cnc01", to: "s-telemetry", label: "telemetria" },
  { from: "m-prensa02", to: "s-telemetry", label: "telemetria" },
  { from: "m-solda01", to: "s-telemetry", label: "telemetria" },
  { from: "m-motor01", to: "s-telemetry", label: "telemetria" },
  { from: "m-compressor", to: "m-cnc01", label: "alimenta" },
  { from: "m-compressor", to: "m-prensa02", label: "alimenta" },
  { from: "d-suprimentos", to: "s-sap", label: "ordens" },
  { from: "d-montagem", to: "s-mes", label: "aponta" },
  { from: "d-montagem", to: "s-turnos", label: "registra" },
  { from: "d-financas", to: "s-powerbi", label: "indicadores" },
  { from: "p-carlos", to: "prj-paradas", label: "participa" },
  { from: "p-ana", to: "prj-paradas", label: "lidera" },
  { from: "p-juliana", to: "prj-6m", label: "lidera" },
  { from: "p-rafael", to: "m-montagem01", label: "opera" },
  { from: "p-thiago", to: "m-solda01", label: "opera" },
  { from: "p-lucas", to: "m-motor01", label: "opera" },
  { from: "p-davi", to: "s-sap", label: "integra" },
  { from: "k-sul", to: "c-sul", label: "vincula" },
  { from: "p-sofia", to: "c-sul", label: "atende" },
];

const notebooks = [
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
        text: "Fechamento: troca do selo programada para domingo. Plano de prevenção: monitorar pressão do Compressor-04 com alarme em 95 bar e revisão trimestral do circuito.",
        tags: ["fechamento", "prevenção"],
        links: ["m-compressor", "prj-paradas"],
      },
    ],
  },
  {
    id: "nb-manuf",
    title: "Caderno — Manufatura",
    ownerKind: "department",
    ownerId: "d-manuf",
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
        text: "Semana: 3 paradas não planejadas (-2 vs. semana anterior). Causa líder: hidráulica. Peça crítica em falta: kit de selo da CNC-01 (estoque 1).",
        tags: ["resumo", "estoque"],
        links: ["s-sap"],
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
        date: "2026-11-08T09:10:00-03:00",
        author: "Ana Souza",
        text: "Meta em 62% do trimestre: 11 paradas contra 18 no mesmo período do ano passado. Alarme de pressão no Compressor-04 já está ativo.",
        tags: ["meta", "andamento"],
        links: ["m-compressor", "prj-paradas"],
      },
    ],
  },
];

const accessExceptions = [
  { id: "ax-1", personId: "p-carlos", scope: "s-telemetry:history", reason: "Investigação de paradas hidráulicas.", expiresAt: null },
  { id: "ax-2", personId: "p-camila", scope: "s-mes:write", reason: "Liberação de lote exige apontamento no MES.", expiresAt: "2026-12-07T00:00:00.000Z" },
  { id: "ax-3", personId: "p-thiago", scope: "m-solda01:parameters", reason: "Ajuste fino da célula 2 durante o turno.", expiresAt: "2026-11-14T00:00:00.000Z" },
];

const database = getDatabase();

await database.$transaction(async (transaction) => {
  for (const [position, node] of nodes.entries()) {
    const data = { kind: node.kind, name: node.name, detail: node.detail, dept: node.dept ?? null, status: node.status ?? null, position };
    await transaction.twinNode.upsert({ where: { id: node.id }, create: { id: node.id, ...data }, update: data });
  }

  for (const edge of edges) {
    const current = await transaction.twinEdge.findFirst({ where: edge, select: { id: true } });
    if (!current) await transaction.twinEdge.create({ data: edge });
  }

  for (const notebook of notebooks) {
    await transaction.twinNotebook.upsert({
      where: { id: notebook.id },
      create: { id: notebook.id, title: notebook.title, ownerKind: notebook.ownerKind, ownerId: notebook.ownerId, visibility: notebook.visibility },
      update: { title: notebook.title, ownerKind: notebook.ownerKind, ownerId: notebook.ownerId, visibility: notebook.visibility },
    });
    for (const entry of notebook.entries) {
      const data = { notebookId: notebook.id, date: new Date(entry.date), author: entry.author, text: entry.text, tags: entry.tags, links: entry.links };
      await transaction.twinNotebookEntry.upsert({ where: { id: entry.id }, create: { id: entry.id, ...data }, update: data });
    }
  }

  for (const exception of accessExceptions) {
    const data = { personId: exception.personId, scope: exception.scope, reason: exception.reason, expiresAt: exception.expiresAt ? new Date(exception.expiresAt) : null };
    await transaction.twinAccessException.upsert({ where: { id: exception.id }, create: { id: exception.id, ...data }, update: data });
  }
});

console.log(
  `seeded twin: ${nodes.length} nodes, ${edges.length} edges, ${notebooks.length} notebooks, ${accessExceptions.length} access exceptions`,
);
await closeDatabase();
