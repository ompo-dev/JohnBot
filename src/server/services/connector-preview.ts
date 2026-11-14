import { connectorPreviewSchema } from "../../contracts/connector-preview";
import { canAccess } from "../../lib/operations-model";
import { ApiError } from "../errors";
import { readOperations } from "./operations";

/** Sandboxed connector adapters use the same persisted demo state as dashboards and notebooks. */
export async function readConnectorPreview(sessionId: string, connectorId: string) {
  const state = await readOperations(sessionId);
  const connector = state.connectors.find((connector) => connector.id === connectorId);
  if (!connector) throw new ApiError(404, "not_found", "Conector não encontrado.");
  if (!canAccess(state, state.viewerId, "read", `connector:${connectorId}`))
    throw new ApiError(403, "unauthorized", "Sem acesso ao conector.");
  const local = ["postgres", "machine-csv"].includes(connectorId);
  const resources: {
    id: string;
    name: string;
    columns: string[];
    rows: (string | number | boolean | null)[][];
  }[] = [];
  if (local || connector.family === "data" || connector.family === "industrial") {
    if (canAccess(state, state.viewerId, "read", "table:machine-downtime"))
      resources.push({
        id: "machine-downtime",
        name: local ? "Machine Downtime · Ouro calculado" : "Amostra simulada de produção",
        columns: ["Máquina", "Registros", "Falhas", "Taxa de falha"],
        rows: state.dataset.machines
          .slice(0, 100)
          .map((machine) => [
            machine.group,
            machine.records,
            machine.failures,
            machine.failure_rate,
          ]),
      });
  } else if (connector.family === "messaging") {
    resources.push({
      id: "delivery-preview",
      name: "Prévia de entrega · nenhuma mensagem enviada",
      columns: ["Canal", "Destinatário", "Evento", "Entrega externa"],
      rows: [
        [
          connector.name,
          state.people.find((person) => person.id === state.viewerId)?.name ?? state.viewerId,
          "Resumo operacional de demonstração",
          false,
        ],
      ],
    });
  } else
    resources.push({
      id: "capabilities",
      name: "Capacidades declaradas · sem execução externa",
      columns: ["Capacidade", "Implementação"],
      rows: connector.capabilities.map((capability) => [capability, connector.implementation]),
    });
  return connectorPreviewSchema.parse({
    connectorId,
    mode: local ? "local" : "mock",
    source: local
      ? "Projeção do PostgreSQL e dataset local; sem banco externo"
      : "Adaptador de demonstração; nenhuma chamada externa",
    observedAt: new Date().toISOString(),
    resources,
  });
}
