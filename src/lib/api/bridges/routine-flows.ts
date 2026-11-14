import { z } from "zod";
import type { WorkflowDetail, WorkflowGraph, RoutineFlowLink } from "../../../contracts/ipc";
import { workflowDetailSchema } from "../../../contracts/workflows-data";
import { unifiedRoutineCanvasSchema } from "../../../contracts/unified-routines";
import { routineCanvasLinks } from "../../routine-canvas";
import type { MockjohnBotControls } from "../../../preview/mock-johnbot";
import { getData, runCommand } from "../client";

/** The existing routine overview and its step tools edit one canonical graph, with separate overview positions. */
export function installRoutineFlowsData(mock: MockjohnBotControls) {
  const api = mock.api.routineFlows;
  const original = { ...api };
  const remote = (serverId?: string) => serverId && serverId !== "local";
  const details = () =>
    getData("/api/workflows?op=routine-graphs&serverId=local", workflowDetailSchema.array());
  const notify = (agentId: string) =>
    mock.emitAgentEvent({ type: "routine-flows-changed", agentId });
  async function save(detail: WorkflowDetail, graph: WorkflowGraph) {
    const result = await mock.api.workflows.saveGraph({
      workflowId: detail.summary.id,
      baseRevision: detail.revision,
      graph,
    });
    if (!result.ok) throw new Error("A rotina mudou em outro cliente. Recarregue antes de editar.");
  }
  async function linkFor(id: string) {
    for (const detail of await details()) {
      const match = routineCanvasLinks(detail).find((entry) => entry.link.id === id);
      if (match) return { detail, ...match };
    }
    throw new Error("Conexão da rotina não encontrada.");
  }
  api.canvas = (agentId, serverId) =>
    remote(serverId)
      ? original.canvas(agentId, serverId)
      : getData(
          `/api/workflows?${new URLSearchParams({ op: "routine-canvas", serverId: "local", agentId })}`,
          unifiedRoutineCanvasSchema,
        );
  api.savePosition = async (input, serverId) => {
    if (remote(serverId)) return original.savePosition(input, serverId);
    await runCommand(
      "routines.position",
      { agentId: input.agentId, nodeKey: input.nodeKey, position: { x: input.x, y: input.y } },
      z.null(),
    );
    notify(input.agentId);
  };
  api.removePosition = async (input, serverId) => {
    if (remote(serverId)) return original.removePosition(input, serverId);
    await runCommand("routines.position", { ...input, position: null }, z.null());
    notify(input.agentId);
  };
  api.connect = async (input, serverId) => {
    if (remote(serverId)) return original.connect(input, serverId);
    const detail = await mock.api.workflows.get(input.routineId);
    const graph = structuredClone(detail.graph);
    const agentNode = (agentId: string) => {
      let node = graph.nodes.find(
        (node) => node.kind === "agent" && node.fields.agentId === agentId,
      );
      if (!node) {
        node = {
          id: crypto.randomUUID(),
          kind: "agent",
          at: { x: graph.nodes.length * 320, y: 0 },
          fields: { agentId, task: "" },
        };
        graph.nodes.push(node);
      }
      return node;
    };
    const from = agentNode(input.fromAgentId),
      to = agentNode(input.toAgentId);
    if (input.instruction !== undefined) to.fields.task = input.instruction;
    if (!graph.edges.some((edge) => edge.from === from.id && edge.to === to.id))
      graph.edges.push({ id: crypto.randomUUID(), from: from.id, to: to.id, type: "text" });
    await save(detail, graph);
    const next = routineCanvasLinks({ ...detail, graph }).find(
      (entry) =>
        entry.link.fromAgentId === input.fromAgentId && entry.link.toAgentId === input.toAgentId,
    );
    if (!next) throw new Error("Não foi possível confirmar a conexão.");
    notify(input.fromAgentId);
    notify(input.toAgentId);
    return next.link;
  };
  api.disconnect = async (input, serverId) => {
    if (remote(serverId)) return original.disconnect(input, serverId);
    const match = await linkFor(input.linkId);
    if (match.edgeIds.length !== 1)
      throw new Error("Edite as conexões das etapas em Editar etapas.");
    const graph = {
      ...match.detail.graph,
      edges: match.detail.graph.edges.filter((edge) => edge.id !== match.edgeIds[0]),
    };
    await save(match.detail, graph);
    notify(match.link.fromAgentId);
    notify(match.link.toAgentId);
  };
  api.updateLink = async (input, serverId) => {
    if (remote(serverId)) return original.updateLink(input, serverId);
    const match = await linkFor(input.linkId);
    const graph = structuredClone(match.detail.graph);
    const node = graph.nodes.find((node) => node.id === match.targetNodeId)!;
    node.fields.task = input.instruction;
    await save(match.detail, graph);
    notify(match.link.fromAgentId);
    notify(match.link.toAgentId);
    return { ...match.link, instruction: input.instruction } satisfies RoutineFlowLink;
  };
}
