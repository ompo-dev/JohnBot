// Estado do John Twin: a visão (cargos ou pessoas), os nós abertos, a entidade
// selecionada e as edições feitas no painel de configurações. O dataset vem do
// PostgreSQL (`/api/twin`), por Axios/Zod e pela store compartilhada.
import { twinField } from "../stores/twin-store";
import { twinDataSchema } from "../contracts/twin-data";
import { getData } from "../lib/api/client";
import type { TwinEdge, TwinNode } from "./john-data";

/** O recorte da árvore: pela estrutura de cargos ou pelas pessoas. */
export type TwinViewMode = "cargos" | "pessoa";
const [viewMode, setViewMode] = twinField("viewMode");
const [data, setData] = twinField("data");
export const [twinError, setTwinError] = twinField("error");

/** Os nós que o usuário abriu; cada um revela um nível de filhos no canvas e na sidebar.
 * A árvore começa toda aberta: o canvas mostra a organização inteira, como as Rotinas mostram o fluxo inteiro. */
const [expandedIds, setExpandedIds] = twinField("expandedIds");

/** Abre ou fecha um nó da árvore. */
function toggleExpanded(id: string): void {
  setExpandedIds((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
}

const [selectedNodeId, setSelectedNodeId] = twinField("selectedNodeId");

/** Edições do painel de configurações da entidade (nome, título, descrição), por id. */
interface EntityOverride {
  name?: string;
  title?: string;
  detail?: string;
}
const [entityOverrides, setEntityOverrides] = twinField("entityOverrides");

/** Aplica no que o usuário salvou no painel de configurações da entidade. */
export function applyEntityOverride(id: string, patch: EntityOverride): void {
  setEntityOverrides((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
}

export function entityOverrideOf(id: string): EntityOverride | undefined {
  return entityOverrides()[id];
}

const nodes = (): TwinNode[] => {
  const overrides = entityOverrides();
  return data().nodes.map((node) => {
    const patch = overrides[node.id];
    return patch
      ? { ...node, name: patch.name ?? node.name, detail: patch.detail ?? node.detail }
      : node;
  });
};
const edges = (): TwinEdge[] => {
  const nodeIds = new Set(nodes().map((node) => node.id));
  return data().edges.filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to));
};

const selectedNode = (): TwinNode | undefined =>
  nodes().find((node) => node.id === selectedNodeId());

/** Os John Notebooks são uma ferramenta interna (registros, rastreamento, telemetria);
 *  aqui eles só aparecem como contagem de registros ligados à entidade. */
function registrosOf(id: string): number {
  return data().notebooks.reduce(
    (total, notebook) =>
      notebook.ownerId === id
        ? total + notebook.entries.length
        : total + notebook.entries.filter((entry) => entry.links.includes(id)).length,
    0,
  );
}

/**
 * Lê a fábrica do PostgreSQL. Falhas ficam explícitas e não reinstalam arrays locais antigos.
 */
export async function loadTwin(): Promise<boolean> {
  try {
    const parsed = { data: await getData("/api/twin", twinDataSchema, { force: true }) };
    setTwinError(null);
    const knownIds = new Set(data().nodes.map((node) => node.id));
    const openIds = expandedIds();
    setData({
      nodes: parsed.data.nodes.map((node) => ({
        id: node.id,
        kind: node.kind,
        name: node.name,
        detail: node.detail,
        ...(node.dept ? { dept: node.dept } : {}),
        ...(node.status ? { status: node.status } : {}),
      })),
      edges: parsed.data.edges.map((edge) => ({
        from: edge.from,
        to: edge.to,
        ...(edge.label ? { label: edge.label } : {}),
      })),
      notebooks: parsed.data.notebooks.map((notebook) => ({
        id: notebook.id,
        title: notebook.title,
        ownerKind: notebook.ownerKind,
        ownerId: notebook.ownerId,
        visibility: notebook.visibility,
        entries: notebook.entries.map((entry) => ({
          id: entry.id,
          date: entry.date,
          author: entry.author,
          text: entry.text,
          tags: entry.tags,
          links: entry.links,
        })),
      })),
    });
    setExpandedIds(new Set(parsed.data.nodes.filter((node) => openIds.has(node.id) || !knownIds.has(node.id)).map((node) => node.id)));
    return true;
  } catch (error) {
    setTwinError(error instanceof Error ? error.message : "Não foi possível carregar o John Twin.");
    return false;
  }
}

export {
  edges,
  expandedIds,
  nodes,
  registrosOf,
  selectedNode,
  selectedNodeId,
  setExpandedIds,
  setSelectedNodeId,
  setViewMode,
  toggleExpanded,
  viewMode,
};
