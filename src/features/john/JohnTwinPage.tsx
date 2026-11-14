// A página John Twin reutiliza os componentes reais do app, sem criar nenhum:
// a Sidebar da tela de agentes (o mesmo componente, com as pastas por setor e
// as entidades do twin — pessoas por cargos — no lugar dos agentes), o
// DiagramView das Rotinas (cabeçalho, lente de setores, canvas, composer) e o
// painel de configurações do agente em aba, como na tela de agentes.
// A árvore abre preguiçosa: começa no cargo de quem olha e cada clique abre um
// nível abaixo — por cargos ou por pessoas, trocando no seletor do cabeçalho.
import type { AgentProfile } from "@johnbot/ui/data";
import type { ChannelSummary } from "@johnbot/contracts/ipc";
import { DiagramView } from "@johnbot/features/diagrams/DiagramView";
import type { Diagram, DiagramChatMessage, DiagramNode } from "@johnbot/features/diagrams/diagram-model";
import { SidePanelHeader } from "@johnbot/features/conversation/SidePanel";
import { Sidebar } from "@johnbot/features/sidebar/Sidebar";
import { SidebarMobileAppCard } from "@johnbot/features/sidebar/SidebarMobileAppCard";
import type { SidebarProps } from "@johnbot/features/sidebar/sidebar-types";
import PersonSettingsPanel from "./PersonSettingsPanel";
import { SidebarUpdateIsland } from "../updates/SidebarUpdateIsland";
import { Show, createMemo, createSignal, onSettled } from "solid-js";
import { cn } from "../../lib/cn";
import { chatHistoryKeys } from "../../chat-history";
import { usePlatform } from "../../platform";
import { KIND_LABEL, type TwinKind, type TwinNode } from "../../john/john-data";
import {
  entityOverrideOf,
  expandedIds,
  edges,
  loadTwin,
  nodes,
  registrosOf,
  selectedNode,
  selectedNodeId,
  setExpandedIds,
  setSelectedNodeId,
  setViewMode,
  toggleExpanded,
  twinError,
  viewMode,
  type TwinViewMode,
} from "../../john/john-store";
import { useAgents } from "../agents/agents-context";
import { useLayout } from "../../layout";
import { useNavigation } from "../../navigation";
import { WorkspaceLeftPanelResizer } from "../../WorkspaceLeftPanelResizer";
import { useServerActions } from "../servers/server-actions";
import { useServers } from "../servers/servers-context";
import { useSettings } from "../settings/settings-context";
import { useStore } from "zustand";
import { twinStore } from "../../stores/twin-store";
import { dataStore } from "../../stores/data-store";
import { useEffect } from "react";
import type { AvatarHue } from "@johnbot/contracts/ipc";

const KIND_HUE: Record<TwinKind, AvatarHue> = {
  department: 210,
  person: 150,
  role: 190,
  machine: 30,
  system: 260,
  project: 320,
  client: 280,
  contract: 350,
};
const PERSON_HUES: readonly AvatarHue[] = [0, 30, 55, 185, 215, 245, 320];
const TWIN_EXECUTIVE_SECTOR_ID = "twin-executive";
const TWIN_SIDEBAR_AGENT_PREFIX = "twin-person";

function avatarHueFor(node: TwinNode): AvatarHue {
  if (node.kind !== "person") return KIND_HUE[node.kind];
  let hash = 0x811c9dc5;
  for (let index = 0; index < node.id.length; index += 1) {
    hash ^= node.id.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return PERSON_HUES[(hash >>> 0) % PERSON_HUES.length] ?? 150;
}

function sectorIdFor(departmentId: string | undefined, byId: ReadonlyMap<string, TwinNode>): string | undefined {
  let currentId = departmentId;
  while (currentId && currentId !== "org") {
    const current = byId.get(currentId);
    if (!current) return undefined;
    if (current.dept === "org") return current.id;
    currentId = current.dept;
  }
  return currentId === "org" ? TWIN_EXECUTIVE_SECTOR_ID : undefined;
}

interface TwinSidebarPerson {
  id: string;
  personId: string;
  sectorId: string;
  agent: AgentProfile;
}

interface TwinSidebarChannel {
  sectorId: string;
  channel: ChannelSummary;
}

/** A raiz da árvore em cada visão: o cargo de quem olha e a pessoa que o ocupa. */
const ROOT_BY_MODE: Record<TwinViewMode, string> = { cargos: "r-diretor", pessoa: "p-marina" };
/** O que cada visão mostra pendurado nos setores (as pessoas entram pelos seus vínculos). */
const MODE_KINDS: Record<TwinViewMode, ReadonlySet<TwinKind>> = {
  cargos: new Set<TwinKind>(["role", "machine", "system", "project", "client", "contract"]),
  pessoa: new Set<TwinKind>(["person"]),
};

/** O cargo que a pessoa ocupa: a aresta "ocupa" aponta para o cargo. */
const cargoOf = (id: string): string | undefined => {
  const edge = edges().find((candidate) => candidate.from === id && candidate.label === "ocupa");
  return edge ? nodes().find((node) => node.id === edge.to)?.name : undefined;
};

/** Horário mockado de cada pessoa, como a hora da última mensagem na tela de agentes. */
const TIME_BY_PERSON: Record<string, string> = {
  "p-marina": "19:38",
  "p-carlos": "15:34",
  "p-ana": "19 de ago.",
  "p-bruno": "18 de ago.",
  "p-davi": "17 de ago.",
};

/** Cada entidade entra no canvas como um nó de agente, que é o que o fluxo desenha. */
function entityAgent(node: TwinNode): AgentProfile {
  const override = entityOverrideOf(node.id);
  return {
    id: node.id,
    name: override?.name ?? node.name,
    title: override?.title ?? (node.kind === "person" ? (cargoOf(node.id) ?? KIND_LABEL[node.kind]) : KIND_LABEL[node.kind]),
    description: node.detail,
    notifications: false,
    provider: "codex",
    model: "gpt-5.6-luna",
    reasoningEffort: "medium",
    threadId: null,
    avatarSeed: node.id,
    avatarHue: avatarHueFor(node),
    avatarUrl: null,
    time: node.kind === "person" ? (TIME_BY_PERSON[node.id] ?? "19 de ago.") : "",
    preview: node.detail,
  };
}

/** O que a entidade faz e o que pode ver, no lugar da tarefa que o canvas mostra. */
function taskOf(node: TwinNode): string {
  const registros = registrosOf(node.id);
  const parts = [node.detail];
  if (node.kind === "person" || node.kind === "role") {
    const perms = ["vê telemetria das máquinas ligadas a si"];
    if (registros > 0) perms.push(`lê ${registros} registro(s) em cadernos internos`);
    parts.push(`Permissões: ${perms.join("; ")}.`);
  } else if (registros > 0) {
    parts.push(`Registros internos: ${registros} em cadernos.`);
  }
  return parts.join(" ");
}

/** Os filhos de um nó na visão corrente: os setores pendem da raiz, as entidades
 *  dos setores, e a pessoa pende o que ocupa ou participa. */
function childrenOf(id: string, mode: TwinViewMode, byId: Map<string, TwinNode>): string[] {
  if (id === ROOT_BY_MODE[mode]) {
    return nodes().filter((node) => node.kind === "department" && node.dept === "org").map((node) => node.id);
  }
  const node = byId.get(id);
  if (!node) return [];
  if (node.kind === "department") {
    return nodes()
      .filter((child) => child.dept === id && (child.kind === "department" || MODE_KINDS[mode].has(child.kind)))
      .map((child) => child.id);
  }
  if (node.kind === "person") {
    return edges().filter((edge) => edge.from === id && byId.has(edge.to)).map((edge) => edge.to);
  }
  return [];
}

interface JohnTwinPageProps {
  hostName: string;
  onBack: () => void;
}

export function JohnTwinPage(props: JohnTwinPageProps) {
  useStore(twinStore);
  const twinInvalidated = useStore(dataStore, (state) => state.entries["/api/twin"]?.invalidated === true);
  useEffect(() => { if (twinInvalidated) void loadTwin(); }, [twinInvalidated]);
  const agents = useAgents();
  const layout = useLayout();
  const servers = useServers();
  const serverActions = useServerActions();
  const platform = usePlatform();
  const { openAppSettings, setSkillsMarketplaceOpen } = useSettings();
  const { setGlobalSearchVisibility } = useNavigation();
  const [settingsWidth, setSettingsWidth] = createSignal(360);
  const [chat, setChat] = createSignal<DiagramChatMessage[]>([]);
  const [mobileAppDismissed, setMobileAppDismissed] = createSignal(
    window.localStorage.getItem("johnbot:mobile-app-card-dismissed") === "true",
  );
  onSettled(() => {
    void loadTwin();
  });

  /** A árvore visível: a raiz e, de cada nó aberto, um nível de filhos. */
  const visibleTree = createMemo(() => {
    const mode = viewMode();
    const byId = new Map(nodes().map((node) => [node.id, node]));
    const root = ROOT_BY_MODE[mode];
    const open = expandedIds();
    const parentOf = new Map<string, string>();
    const order: string[] = [root];
    const walk = (id: string) => {
      if (!open.has(id)) return;
      for (const childId of childrenOf(id, mode, byId)) {
          // Reporting links can return to the root; it must never become its own descendant.
          if (childId === root || parentOf.has(childId)) continue;
        parentOf.set(childId, id);
        order.push(childId);
        walk(childId);
      }
    };
    walk(root);
    return { root, order, parentOf, byId, mode };
  });

  /** O desenho da árvore invertida: cada nível em uma linha, o ramo centrado sobre os seus filhos. */
  const positions = createMemo<Record<string, { x: number; y: number }>>(() => {
    const tree = visibleTree();
    const open = expandedIds();
    const result: Record<string, { x: number; y: number }> = {};
    const nextColumn = { value: 0 };
    const place = (id: string, depth: number): { first: number; last: number } => {
      const children = open.has(id)
        ? childrenOf(id, tree.mode, tree.byId).filter((childId) => tree.parentOf.get(childId) === id)
        : [];
      let first: number;
      let last: number;
      if (children.length === 0) {
        first = last = nextColumn.value++;
      } else {
        const spans = children.map((childId) => place(childId, depth + 1));
        first = spans[0].first;
        last = spans[spans.length - 1].last;
      }
      result[id] = { x: ((first + last) / 2) * 300 - 132, y: depth * 190 };
      return { first, last };
    };
    place(tree.root, 0);
    return result;
  });

  const orgStub = createMemo<AgentProfile | undefined>(() => {
    const org = nodes().find((node) => node.id === "org");
    return org ? entityAgent(org) : undefined;
  });
  /** Todas as entidades, para o painel nomear os registros de cada uma. */
  const agentStubsAll = createMemo<AgentProfile[]>(() => nodes().filter((node) => node.kind !== "department").map(entityAgent));
  /** Os setores são pastas. Pessoas entram em todos os setores que cobrem seu departamento ou cargo. */
  const sidebarSectors = createMemo(() => {
    const byId = new Map(nodes().map((node) => [node.id, node]));
    const sectors = nodes()
      .filter((node) => node.kind === "department" && node.dept === "org")
      .map((node) => ({ id: node.id, name: node.name }));
    const hasExecutive = nodes().some(
      (node) => node.kind !== "department" && sectorIdFor(node.dept, byId) === TWIN_EXECUTIVE_SECTOR_ID,
    );
    return hasExecutive ? [{ id: TWIN_EXECUTIVE_SECTOR_ID, name: "Diretoria" }, ...sectors] : sectors;
  });
  const sidebarPeople = createMemo<TwinSidebarPerson[]>(() => {
    const byId = new Map(nodes().map((node) => [node.id, node]));
    return nodes()
      .filter((node) => node.kind === "person")
      .flatMap((person) => {
        const occupiedRoles = edges()
          .filter((edge) => edge.from === person.id && edge.label === "ocupa")
          .map((edge) => byId.get(edge.to))
          .filter((node): node is TwinNode => node?.kind === "role");
        const sectorIds = new Set(
          [sectorIdFor(person.dept, byId), ...edges().filter((edge) => edge.from === person.id && edge.label === "pertence").map((edge) => sectorIdFor(edge.to, byId)), ...occupiedRoles.map((role) => sectorIdFor(role.dept, byId))].filter(
            (sectorId): sectorId is string => Boolean(sectorId),
          ),
        );
        const base = entityAgent(person);
        const title = occupiedRoles.map((role) => role.name).join(" · ") || base.title;
        return [...sectorIds].map((sectorId) => ({
          id: `${TWIN_SIDEBAR_AGENT_PREFIX}:${person.id}:${sectorId}`,
          personId: person.id,
          sectorId,
          agent: { ...base, id: `${TWIN_SIDEBAR_AGENT_PREFIX}:${person.id}:${sectorId}`, title },
        }));
      });
  });
  /** Cargos viram canais dentro do setor correspondente; os membros são as pessoas vinculadas a eles. */
  const sidebarChannels = createMemo<TwinSidebarChannel[]>(() => {
    const byId = new Map(nodes().map((node) => [node.id, node]));
    const people = sidebarPeople();
    return nodes()
      .filter((node) => node.kind === "role")
      .flatMap((role) => {
        const sectorId = sectorIdFor(role.dept, byId);
        if (!sectorId) return [];
        const members = edges()
          .filter((edge) => edge.to === role.id && edge.label === "ocupa")
          .flatMap((edge) => people.find((person) => person.personId === edge.from && person.sectorId === sectorId) ?? [])
          .map((person) => ({ agentId: person.id }));
        const memberLabel = `${members.length} ${members.length === 1 ? "pessoa vinculada" : "pessoas vinculadas"}`;
        return [
          {
            sectorId,
            channel: {
              id: role.id,
              name: role.name,
              title: "Cargo",
              instructions: role.detail,
              members,
              leadAgentId: members[0]?.agentId ?? null,
              archived: false,
              revision: 0,
              createdAt: "2026-01-01T00:00:00.000Z",
              unreadCount: 0,
              activeTasks: 0,
              lastMessage: { authorName: "John Twin", text: memberLabel, at: "2026-01-01T00:00:00.000Z" },
            },
          },
        ];
      });
  });
  /** As entidades visíveis: o que o canvas e a sidebar mostram agora (os setores são rotinas, não agentes). */
  const visibleStubs = createMemo<AgentProfile[]>(() => {
    const tree = visibleTree();
    return tree.order
      .map((id) => tree.byId.get(id))
      .filter((node): node is TwinNode => Boolean(node) && node!.kind !== "department")
      .map(entityAgent);
  });

  /** O diagrama no formato do canvas das Rotinas: setores como rotinas, entidades como agentes. */
  const diagram = createMemo<Diagram>(() => {
    const tree = visibleTree();
    const next8 = new Date();
    next8.setHours(8, 0, 0, 0);
    if (next8.getTime() <= Date.now()) next8.setDate(next8.getDate() + 1);
    const routineNodes: DiagramNode[] = [];
    const agentNodes: DiagramNode[] = [];
    const edges: Diagram["edges"] = [];
    for (const id of tree.order) {
      const node = tree.byId.get(id);
      if (!node) continue;
      const position = positions()[id] ?? { x: 0, y: 0 };
      if (node.kind === "department") {
        routineNodes.push({
          kind: "routine",
          id,
          position,
          name: node.name,
          instruction: node.detail,
          schedule: { kind: "weekdays", time: "08:00" },
          active: true,
          upcomingRuns: [next8.toISOString()],
          recentRuns: [],
        });
      } else {
        agentNodes.push({ kind: "agent", id, position, agentId: id, task: taskOf(node) });
      }
      const parent = tree.parentOf.get(id);
      if (parent) edges.push({ id: `${parent}-${id}`, from: parent, to: id });
    }
    return {
      id: "john-twin",
      name: "John Twin",
      nodes: [...routineNodes, ...agentNodes],
      edges,
      lastRuns: [],
      updatedAt: new Date().toISOString(),
    };
  });

  /** Selecionar é abrir: o clique marca a entidade e revela um nível abaixo dela. */
  const selectEntity = (agentId: string | null) => {
    setSelectedNodeId(agentId);
    if (agentId) toggleExpanded(agentId);
  };

  const changeMode = (mode: string) => {
    setViewMode(mode as TwinViewMode);
    setExpandedIds(new Set(nodes().map((node) => node.id)));
    setSelectedNodeId(ROOT_BY_MODE[mode as TwinViewMode]);
  };

  const sendChat = (text: string) => {
    setChat((list) => [...list, { id: crypto.randomUUID(), author: "user", text, createdAt: new Date().toISOString() }]);
    window.setTimeout(
      () =>
        setChat((list) => [
          ...list,
          {
            id: crypto.randomUUID(),
            author: "agent",
            text: "Dados de demonstração: o grafo reflete a organização e as permissões de cada entidade.",
            createdAt: new Date().toISOString(),
          },
        ]),
      600,
    );
  };

  /** A sidebar da tela de agentes projetada do Twin: setores → cargos (canais) → pessoas. */
  const sidebarProps = createMemo<SidebarProps>(() => ({
    serverName: servers.activeServer()?.name ?? "Local",
    serverMenu: {
      ...serverActions.callbacks,
      servers: serverActions.orderedServers(),
      view: "menu",
      onViewChange: () => {},
      onSelect: (serverId: string) => serverActions.select(serverId),
      onAdd: serverActions.add,
      addCreatesServer: serverActions.addCreatesServer(),
    },
    chatHistory: {
      back: null,
      forward: null,
      keys: chatHistoryKeys(platform.appInfo()?.platform === "darwin"),
      onBack: () => {},
      onForward: () => {},
    },
    agents: sidebarPeople().map((person) => person.agent),
    channels: sidebarChannels().map(({ channel }) => channel),
    activeAgentId: sidebarPeople().find((person) => person.personId === selectedNodeId())?.id ?? "",
    activeChannelId: selectedNode()?.kind === "role" ? selectedNodeId() : null,
    people: [],
    directThreads: [],
    activeDirectMemberId: null,
    agentStates: {},
    agentMoods: {},
    layout: {
      revision: 1,
      sections: sidebarSectors(),
      order: ["people", "unassigned", ...sidebarSectors().map((sector) => sector.id)],
      agentAssignments: Object.fromEntries([
        ...sidebarPeople().map((person) => [person.id, person.sectorId]),
        ...sidebarChannels().map(({ sectorId, channel }) => [channel.id, sectorId]),
      ]),
      agentOrder: [...sidebarChannels().map(({ channel }) => channel.id), ...sidebarPeople().map((person) => person.id)],
    },
    collapsedSectionIds: [],
    onMutateLayout: async () => {},
    onToggleSection: () => {},
    layoutMutable: false,
    createMenuLabels: {
      menu: "Nova pessoa, cargo ou setor",
      agent: "Nova pessoa",
      channel: "Cargos",
      section: "Setores",
    },
    pinnedItems: [],
    peopleOrder: [],
    onPin: () => {},
    onUnpin: () => {},
    onReorderPinned: () => {},
    onReorderPeople: () => {},
    onSelectAgent: (agentId: string) => selectEntity(sidebarPeople().find((person) => person.id === agentId)?.personId ?? null),
    onSelectChannel: selectEntity,
    onSelectPerson: () => {},
    createSupported: false,
    onCreateAgent: () => {},
    onEditAgent: (agentId: string) => setSelectedNodeId(sidebarPeople().find((person) => person.id === agentId)?.personId ?? null),
    onDeleteAgent: async () => {},
    compact: layout.leftPanelCompact(),
    onExpand: layout.expandSidebar,
    onOpenSearch: () => setGlobalSearchVisibility(true),
    onOpenMarketplace: () => setSkillsMarketplaceOpen(true),
  }));

  return (
    <div
      className={cn("john-twin-pane side-panel-docked relative flex h-full min-w-0")}
      style={{ "--side-panel-width": `${settingsWidth()}px`, "--settings-panel-width": `${settingsWidth()}px` }}
    >
      <Show when={twinError()}><p role="alert" className="absolute inset-x-4 top-4 z-20 rounded-lg bg-red-950 p-3 text-sm text-white">{twinError()}</p></Show>
      <Sidebar
        {...sidebarProps()}
        footer={
          <>
            <Show when={!mobileAppDismissed()}>
              <SidebarMobileAppCard
                onOpenInstall={() => openAppSettings(null, "mobile-connect")}
                onDismiss={() => {
                  window.localStorage.setItem("johnbot:mobile-app-card-dismissed", "true");
                  setMobileAppDismissed(true);
                }}
              />
            </Show>
            <SidebarUpdateIsland />
          </>
        }
      />

      <WorkspaceLeftPanelResizer />

      <DiagramView
        diagram={diagram()}
        agents={visibleStubs()}
        owner={orgStub()}
        editable={false}
        inspector={false}
        showIdlePreview={false}
        showUnreachable={false}
        focusRoutineOnSelect={false}
        routineAllLabel="Todos os setores"
        routineLensLabel="Setor a mostrar"
        headerSelect={{
          value: viewMode(),
          options: [
            { value: "cargos", label: "Cargos" },
            { value: "pessoa", label: "Pessoa" },
          ],
          onChange: changeMode,
          ariaLabel: "Ver a organização por cargos ou por pessoa",
        }}
        selectedNodeId={selectedNodeId()}
        onSelectNodeChange={selectEntity}
        onMoveNode={() => {}}
        onConnect={() => false}
        onRemoveEdge={() => {}}
        onRemoveNode={() => {}}
        onRunRoutine={() => {}}
        assistant={
          agents.activeAgent()
            ? {
                agent: agents.activeAgent()!,
                messages: chat(),
                working: false,
                onSend: sendChat,
              }
            : undefined
        }
      />

      <Show when={selectedNode()}>
        <SidePanelHeader
          panes={["settings"]}
          selected="settings"
          available={["settings"]}
          maximized={false}
          settingsLabel={
            selectedNode()?.kind === "person"
              ? "Configurações da pessoa"
              : "Configurações da entidade"
          }
          onSelect={() => {}}
          onClose={() => setSelectedNodeId(null)}
          onToggleMaximized={() => {}}
          onCollapse={() => setSelectedNodeId(null)}
        />
      </Show>

      <Show when={selectedNode()} keyed>
        {(node) => (
           <PersonSettingsPanel node={node} onClose={() => setSelectedNodeId(null)} onWidthChange={setSettingsWidth} />
        )}
      </Show>
    </div>
  );
}
