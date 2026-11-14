import axios from "axios";
import type { z } from "zod";
import {
  dashboardComposeSchema,
  dashboardCompositionSchema,
} from "../../contracts/dashboard-compose";
import { dashboardSchema } from "../../contracts/operations";
import { canAccess, operationsProjection, proposeDashboard } from "../../lib/operations-model";
import { DASHBOARD_DATA_SHAPES } from "../../lib/dashboard-data";
import { serverEnv } from "../config/env";
import { ApiError } from "../errors";
import { readOperations, changeOperations } from "./operations";
import { requireAgent } from "./workspace";
import { readAgents } from "./agents";
import { readStore } from "./workflows";
import { DASHBOARD_BUILDER_ID, DASHBOARD_BUILDER_NAME } from "../../contracts/dashboard-builder";
import {
  dashboardLibraryPrompt,
  validateDashboardProgram,
} from "../../contracts/dashboard-library";

export async function composeDashboard(
  sessionId: string,
  input: z.infer<typeof dashboardComposeSchema>,
) {
  const raw = await readOperations(sessionId);
  if (raw.revision !== input.expectedRevision)
    throw new ApiError(409, "conflict", "O workspace mudou. Recarregue antes de pedir o painel.");
  const state = operationsProjection(raw),
    person = state.people.find((item) => item.id === state.viewerId)!;
  const previous = input.dashboardId
    ? state.dashboards.find((item) => item.id === input.dashboardId)
    : undefined;
  if (input.dashboardId && !previous)
    throw new ApiError(404, "not_found", "Dashboard não encontrado para esta pessoa.");
  const agent =
    input.agentId === DASHBOARD_BUILDER_ID
      ? { id: DASHBOARD_BUILDER_ID, name: DASHBOARD_BUILDER_NAME, hiddenAt: null }
      : await requireAgent(sessionId, input.agentId);
  if (agent.hiddenAt)
    throw new ApiError(409, "conflict", "Restaure o agente antes de pedir um painel.");
  const config = serverEnv();
  const now = new Date().toISOString();
  let dashboard = {
    ...proposeDashboard(person, previous?.objective ?? input.objective),
    id: previous?.id ?? `dashboard:${crypto.randomUUID()}`,
    title: input.title ?? previous?.title ?? `Dashboard de ${person.name}`,
    messages: previous?.messages ?? [],
  };
  let summary =
    "Prévia simulada criada com os dados disponíveis. Configure um modelo para compor livremente pela biblioteca OpenUI.";
  if (config.dashboardModel && config.dashboardApiKey) {
    const [roster, routineRecords] = await Promise.all([readAgents(sessionId), readStore(sessionId, "local")]);
    const response = await axios
      .post(
        `${config.dashboardBaseUrl}/chat/completions`,
        {
          model: config.dashboardModel,
          stream: false,
          messages: [
            {
              role: "system",
              content: `${dashboardLibraryPrompt}\nVocê é ${DASHBOARD_BUILDER_NAME}, um especialista permanente em interfaces JohnBot. Use a biblioteca completa de componentes para compor um dashboard modular e interativo, não uma lista fixa de widgets. Vincule dados a Query("dashboardData", {source:...}) e ações registradas de rotinas/agentes. Nunca invente métricas ou execute JS/HTML. Não há duração de parada no CSV; use frequência de falhas. O programa anterior e o histórico abaixo são contexto para uma edição, preserve o que não foi pedido. TRANSPORTE: devolva um único JSON {"title":"nome do dashboard","program":"programa OpenUI Lang completo","summary":"resumo curto das alterações"}. O campo program contém OpenUI Lang, não JSON de componentes nem Markdown. Use bindings/queries em vez de embutir cópias dos dados.`,
            },
            {
              role: "user",
              content: JSON.stringify({
                objective: input.objective,
                person,
                agents: roster.filter((entry) => state.agentIds.includes(entry.id) && !entry.hiddenAt).map(({id, name, title}) => ({id, name, title})),
                routines: routineRecords.map((entry) => entry.detail.summary).filter((entry) => canAccess(state, state.viewerId, "read", `routine:${entry.id}`)).map(({id, title, steps}) => ({id, title, steps})),
                dataShapes: DASHBOARD_DATA_SHAPES,
                previousProgram: previous?.program ?? null,
                history: (previous?.messages ?? []).slice(-8).map((message) => ({ author: message.author, text: message.text.slice(0, 1000) })),
                dataset: state.dataset,
                actions: state.actions.slice(0, 10),
                notebooks: state.notebooks.slice(0, 10).map((book) => ({
                  title: book.title,
                  entries: book.entries.length,
                })),
              }),
            },
          ],
          response_format: { type: "json_object" },
          max_tokens: 6000,
          reasoning_effort: "low",
        },
        {
          timeout: 90_000,
          maxRedirects: 0,
          headers: { Authorization: `Bearer ${config.dashboardApiKey}` },
        },
      )
      .catch(() => {
        throw new ApiError(
          502,
          "upstream_unavailable",
          "O modelo não conseguiu montar o painel. O painel anterior foi preservado.",
        );
      });
    let composition: z.infer<typeof dashboardCompositionSchema>;
    try {
      composition = dashboardCompositionSchema.parse(
        JSON.parse(response.data?.choices?.[0]?.message?.content ?? ""),
      );
      if (composition.program) validateDashboardProgram(composition.program);
      else if (input.agentId === DASHBOARD_BUILDER_ID)
        throw new Error("O construtor deve produzir OpenUI Lang.");
    } catch {
      throw new ApiError(
        502,
        "upstream_unavailable",
        "O agente retornou uma definição de painel inválida. O painel anterior foi preservado.",
      );
    }
    if (new Set(composition.widgets.map((widget) => widget.id)).size !== composition.widgets.length)
      throw new ApiError(
        502,
        "upstream_unavailable",
        "O agente retornou módulos duplicados. O painel anterior foi preservado.",
      );
    dashboard = dashboardSchema.parse({
      ...dashboard,
      widgets: composition.widgets,
      ...(composition.program ? { program: composition.program } : {}),
      title: input.title ?? composition.title,
      origin: "agent",
      producerAgentId: agent.id,
    });
    summary =
      composition.summary ?? "Dashboard atualizado com os componentes e vínculos solicitados.";
  } else if (config.dashboardModel || config.dashboardApiKey) {
    throw new ApiError(
      503,
      "upstream_unavailable",
      "Configure modelo e chave do gerador de dashboards.",
    );
  } else if (previous?.program) {
    throw new ApiError(503, "upstream_unavailable", "Conecte o construtor de dashboards para editar este painel. O painel atual foi preservado.");
  }
  dashboard = dashboardSchema.parse({
    ...dashboard,
    messages: [
      ...(previous?.messages ?? []).slice(-98),
      { id: crypto.randomUUID(), author: "user", text: input.objective, createdAt: now },
      {
        id: crypto.randomUUID(),
        author: "agent",
        text: summary,
        createdAt: new Date().toISOString(),
      },
    ],
  });
  return changeOperations(
    sessionId,
    { expectedRevision: input.expectedRevision, change: { type: "dashboard", dashboard } },
    dashboard.origin === "agent" ? agent.id : undefined,
  );
}
