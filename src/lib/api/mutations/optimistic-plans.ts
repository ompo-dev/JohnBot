import { dataStore } from "../../../stores/data-store";
import { seedPreferencesData } from "../../../contracts/preferences-data";
import { workflowListSchema, workflowDetailSchema } from "../../../contracts/workflows-data";
import { defaultProviderModel } from "../../../contracts/ipc";
import { agentSchema } from "../../../contracts/workspace-data";
import { optimisticOperations } from "./operations";
interface Plan {
  key: string;
  update: (current: unknown) => unknown;
  confirm: (result: unknown, current: unknown) => unknown;
}
const object = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
export function optimisticPlans(command: string, payload: unknown): Plan[] {
  if (command === "dashboards.compose") return [{ key: "/api/operations", update: (current) => current, confirm: (result) => result }];
  if (command === "operations.change") return [{ key: "/api/operations",
    update: (current) => optimisticOperations(current, payload), confirm: (result) => result }];
  const input = object(payload);
  if (command === "agents.change-message" && input.action === "reaction") return [{
    key: `/api/agents?domain=conversation&agentId=${encodeURIComponent(String(input.agentId))}`,
    update: (current) => {
      const value = object(current), snapshot = object(value.snapshot);
      return { ...value, snapshot: { ...snapshot, revision: Number(snapshot.revision ?? 0) + 1,
        messages: (Array.isArray(snapshot.messages) ? snapshot.messages : []).map((raw) => {
          const message = object(raw);
          if (message.id !== input.messageId) return raw;
          return { ...message, reaction: input.emoji ?? null, reactions: [
            ...(Array.isArray(message.reactions) ? message.reactions : []).filter((reaction) => object(object(reaction).actor).kind !== "user"),
            ...(input.emoji ? [{ emoji: input.emoji, actor: { kind: "user" } }] : []),
          ] };
        }),
      } };
    }, confirm: (result) => result,
  }];
  if (command === "workspace.sidebar") return [{ key: "/api/workspace?resource=sidebar",
    update: (current) => {
      const value = object(current);
      if (input.kind === "seed-pins" && object(value.pins).updatedAt) return current;
      return { layout: { ...object(input.layout ?? value.layout), revision: Number(input.expectedRevision) + 1 },
        pins: input.pins ? { ...object(input.pins), updatedAt: new Date().toISOString() } : value.pins };
    }, confirm: (result) => result,
  }];
  if (command === "workspace.memory") return [{ key: `/api/workspace?resource=memories&agentId=${encodeURIComponent(String(input.agentId))}`,
    update: (current) => {
      const rows = Array.isArray(current) ? current : [];
      if (input.action === "clear") return [];
      if (input.action === "delete") return rows.filter((row) => object(row).id !== input.memoryId);
      const at = new Date().toISOString();
      if (input.action === "create") return [...rows, { id: input.memoryId, agentId: input.agentId,
        text: input.text, origin: "manual", sourceTurnId: null, createdAt: at, updatedAt: at }];
      return rows.map((row) => object(row).id === input.memoryId ? { ...object(row), text: input.text, updatedAt: at } : row);
    }, confirm: (result) => result,
  }];
  if (["agents.create", "agents.update", "agents.delete"].includes(command)) {
    const id = String(command === "agents.delete" ? payload : command === "agents.update" ? input.agentId : input.id);
    const draft = command === "agents.create" ? agentSchema.parse({
      id, name: input.name, title: "", description: input.description ?? "", notifications: true,
      provider: input.provider ?? "codex", model: input.model ?? defaultProviderModel("codex"),
      reasoningEffort: input.reasoningEffort ?? "low", threadId: null, workspacePath: "", preview: "",
      updatedAt: null, avatarSeed: input.avatarSeed, avatarHue: input.avatarHue, avatarUrl: null,
    }) : input.agent;
    return [{ key: "/api/agents?domain=agents",
      update: (current) => {
        const rows = Array.isArray(current) ? current : [];
        return command === "agents.delete" ? rows.filter((row) => object(row).id !== id)
          : command === "agents.create" ? [...rows, draft] : rows.map((row) => object(row).id === id ? draft : row);
      },
      confirm: (result, current) => {
        const rows = Array.isArray(current) ? current : [];
        if (command === "agents.delete") return rows.filter((row) => object(row).id !== id);
        if (command === "agents.create") return [...rows.filter((row) => object(row).id !== id), result];
        // The roster keeps the position of an edited agent; only a create appends.
        return rows.some((row) => object(row).id === id)
          ? rows.map((row) => (object(row).id === id ? result : row))
          : [...rows, result];
      },
    }];
  }
  if (command === "agents.send-message") {
    const id = String(input.clientMessageId), agentId = String(input.agentId);
    const createdAt = new Date().toISOString();
    return [{ key: `/api/agents?domain=conversation&agentId=${encodeURIComponent(agentId)}`,
      update: (current) => {
        const value = object(current), snapshot = object(value.snapshot), queue = object(value.queue);
        const messages = Array.isArray(snapshot.messages) ? snapshot.messages : [];
        if (messages.some((item) => object(item).id === id)) return current;
        const deliveries = Array.isArray(queue.deliveries) ? queue.deliveries : [];
        return { ...value, snapshot: { ...snapshot, revision: Number(snapshot.revision ?? 0) + 1,
          messages: [...messages, { id, author: "user", source: "user", text: input.text, status: "completed", createdAt, replyToMessageId: input.replyToMessageId ?? null }] },
          queue: { agentId, deliveries: [...deliveries, { id, messageId: id, recipientAgentId: agentId,
            sender: { kind: "user" }, text: input.text, attachments: [], replyToMessageId: input.replyToMessageId ?? null,
            status: "queued", position: deliveries.filter((item) => object(item).status === "queued").length + 1, turnId: null, error: null, createdAt }] } };
      }, confirm: (result) => object(result).conversation,
    }];
  }
  const settings: Record<string, string> = {
    "settings.set-language": "language",
    "settings.set-logo-color": "logoColor",
    "settings.set-appearance": "appearance",
    "settings.set-interface-size": "interfaceSize",
  };
  if (settings[command]) {
    const field = settings[command];
    return [
      {
        key: "/api/settings",
        update: (current) =>
          current === undefined
            ? current
            : { ...object(current), [field]: { ...object(object(current)[field]), ...input } },
        confirm: (result) => result,
      },
    ];
  }
  const preferences: Record<string, string> = {
    "preferences.set-analytics": "analytics",
    "preferences.set-busy-message-mode": "busyMessageMode",
    "preferences.set-agent-defaults": "agentDefaults",
    "preferences.set-remote-session-reuse": "remoteSessionReuse",
  };
  if (preferences[command]) {
    const field = preferences[command];
    return [
      {
        key: "/api/preferences",
        update: (current) => ({
          ...object(current ?? seedPreferencesData()),
          [field]: field === "analytics" ? { enabled: input.enabled } : input,
        }),
        confirm: (result) => object(result).preferences,
      },
    ];
  }
  if (command === "account.update-name")
    return [
      {
        key: "/api/account/state",
        update: (current) =>
          object(current).status === "signed_in"
            ? { ...object(current), user: { ...object(object(current).user), name: input.name } }
            : current,
        confirm: (result) => result,
      },
    ];
  if (command === "account.logout")
    return [
      {
        key: "/api/account/state",
        update: () => ({ status: "signed_out" }),
        confirm: (result) => result,
      },
    ];
  if (command === "account.update-avatar")
    return [
      {
        key: "/api/account/state",
        update: (current) =>
          object(current).status === "signed_in"
            ? {
                ...object(current),
                user: {
                  ...object(object(current).user),
                  avatarUrl: input.image
                    ? `data:${String(object(input.image).mimeType)};base64,${String(object(input.image).bytesBase64)}`
                    : null,
                },
              }
            : current,
        confirm: (result) => result,
      },
    ];
  if (command === "account.revoke-session")
    return [
      {
        key: "/api/account/sessions",
        update: (current) => ({
          sessions: Array.isArray(object(current).sessions)
            ? (object(current).sessions as Record<string, unknown>[]).filter(
                (row) => row.sessionId !== input.sessionId,
              )
            : [],
        }),
        confirm: (result) => result,
      },
    ];
  if (command === "marketplace.submit") {
    const preview = object(input.preview);
    const id = crypto.randomUUID();
    const routines = Array.isArray(preview.routines) ? preview.routines : [];
    const pending = {
      ...preview,
      id,
      listingId: input.listingId ?? `listing-${String(input.agentId)}`,
      version: 1,
      status: "pending",
      rejectionNote: null,
      skillCount: Array.isArray(preview.skills) ? preview.skills.length : 0,
      routineCount: routines.length,
      activeRoutineCount: routines.filter((routine) => object(routine).active).length,
      createdAt: new Date().toISOString(),
    };
    return [
      {
        key: "/api/marketplace/submissions",
        update: (current) => [pending, ...(Array.isArray(current) ? current : [])],
        confirm: (result, current) => [
          result,
          ...(Array.isArray(current) ? current.filter((row) => object(row).id !== id) : []),
        ],
      },
    ];
  }
  if (command === "agents.persist-conversation")
    return [
      {
        key: `/api/agents?domain=conversation&agentId=${encodeURIComponent(String(input.agentId))}`,
        update: (current) => ({
          ...object(current),
          snapshot: input.snapshot,
          readState: input.readState,
          queue: input.queue,
          version: input.expectedVersion,
        }),
        confirm: (result) => result,
      },
    ];
  if (command.startsWith("workflows.")) {
    const body = input.payload;
    const detail = object(body);
    const workflowId = command === "workflows.delete" ? body : detail.workflowId;
    const temporaryId = String(detail.id ?? crypto.randomUUID());
    const plans = Object.keys(dataStore.getState().entries)
      .filter((key) => key.startsWith("/api/workflows?"))
      .flatMap((key): Plan[] => {
        const params = new URL(key, "http://local").searchParams;
        if ((params.get("serverId") ?? "local") !== (input.serverId ?? "local")) return [];
        const op = params.get("op") ?? "list";
        if (op === "list") {
          const change = (current: unknown, result?: unknown) => {
            const parsed = workflowListSchema.safeParse(current);
            if (!parsed.success) return current;
            if (command === "workflows.delete")
              return parsed.data.filter((row) => row.id !== workflowId);
            if (command === "workflows.create") {
              const confirmed = workflowDetailSchema.safeParse(result);
              const summary = confirmed.success
                ? confirmed.data.summary
                : {
                    id: temporaryId,
                    title: String(detail.title),
                    updatedAt: new Date().toISOString(),
                    steps: 0,
                    lastRun: null,
                  };
              return [...parsed.data.filter((row) => row.id !== temporaryId), summary];
            }
            if (command === "workflows.rename")
              return parsed.data.map((row) =>
                row.id === workflowId
                  ? { ...row, ...object(result), title: String(detail.title) }
                  : row,
              );
            return current;
          };
          return [
            {
              key,
              update: (current) => change(current),
              confirm: (result, current) => change(current, result),
            },
          ];
        }
        if (
          op === "get" &&
          params.get("workflowId") === workflowId &&
          command === "workflows.save-graph"
        )
          return [
            {
              key,
              update: (current) => ({ ...object(current), graph: detail.graph }),
              confirm: (result, current) =>
                object(result).ok === true
                  ? { ...object(current), graph: detail.graph, revision: object(result).revision }
                  : current,
            },
          ];
        return [];
      });
    if (command === "workflows.create") {
      const graph = detail.graph ?? { nodes: [], edges: [], strokes: [] };
      const temporary = {
        summary: {
          id: temporaryId,
          title: String(detail.title),
          steps: 0,
          updatedAt: new Date().toISOString(),
          lastRun: null,
        },
        graph,
        revision: 0,
        triggers: [],
      };
      plans.push({
        key: `/api/workflows?${new URLSearchParams({ op: "get", serverId: String(input.serverId ?? "local"), workflowId: temporaryId })}`,
        update: () => temporary,
        confirm: (result) => result,
      });
    }
    return plans;
  }
  return [];
}
export const commandScope = (command: string, payload: unknown) => {
  const input = object(payload);
  return command.startsWith("agents.")
    ? `agents:${String(input.agentId ?? "roster")}`
    : command.startsWith("workflows.")
      ? `workflows:${String(input.serverId ?? "local")}`
      : (command.split(".")[0] ?? command);
};
