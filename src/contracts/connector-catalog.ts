import type { Operations } from "./operations";

/** Implementation and connectivity are separate; a catalog entry never proves an external connection. */
export const CONNECTOR_CATALOG: Operations["connectors"] = [
  {
    id: "postgres",
    name: "PostgreSQL",
    family: "data",
    implementation: "real",
    status: "ready",
    capabilities: ["Dados locais do JohnBot"],
    detail:
      "Persistência Prisma utilizada pelo aplicativo. Bancos externos precisam de configuração própria.",
  },
  {
    id: "machine-csv",
    name: "CSV · Machine Downtime",
    family: "data",
    implementation: "real",
    status: "ready",
    capabilities: ["Bronze", "Prata", "Ouro"],
    detail:
      "Processamento local do dataset de demonstração, com dados originais, validação e indicadores calculados.",
  },
  ...(
    [
      ["excel", "Excel / planilhas", "data"],
      ["rest", "APIs REST", "data"],
      ["powerbi", "Power BI", "data"],
      ["databricks", "Databricks", "data"],
      ["erp", "ERP", "industrial"],
      ["mes", "MES", "industrial"],
      ["sap", "SAP", "industrial"],
      ["totvs", "TOTVS", "industrial"],
      ["whatsapp", "WhatsApp", "messaging"],
      ["slack", "Slack", "messaging"],
      ["telegram", "Telegram", "messaging"],
      ["discord", "Discord", "messaging"],
      ["github", "GitHub", "tools"],
      ["mcp", "MCP", "tools"],
      ["utcp", "UTCP", "tools"],
      ["bitwarden", "Bitwarden", "tools"],
      ["onepassword", "1Password", "tools"],
    ] as const
  ).map(([id, name, family]) => ({
    id,
    name,
    family,
    implementation: "mock" as const,
    status: "simulated" as const,
    capabilities: ["Catálogo de demonstração"],
    detail: "Sem conexão externa. Dados e operações deste conector são simulados.",
  })),
  {
    id: "a2a",
    name: "A2A",
    family: "agents",
    implementation: "partial",
    status: "not-configured",
    capabilities: ["Descoberta de agentes"],
    detail:
      "O adaptador atual descobre agentes configurados; execução remota de tarefas ainda não está integrada.",
  },
  {
    id: "auto-ontology",
    name: "Auto Ontology",
    family: "agents",
    implementation: "partial",
    status: "not-configured",
    capabilities: ["Verificação de disponibilidade"],
    detail: "Ainda não indexa as fontes nem aplica ontologias ao fluxo operacional.",
  },
  {
    id: "billion-context",
    name: "billion-context",
    family: "agents",
    implementation: "partial",
    status: "not-configured",
    capabilities: ["Ferramenta do OpenCode"],
    detail:
      "Disponível no ambiente de desenvolvimento; não participa da execução de agentes do aplicativo.",
  },
];
