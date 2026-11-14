import type { johnBotDesktopApi, ServerSummary } from "@johnbot/contracts/ipc";

/**
 * What the servers domain reaches in main: the server list and selection, the account changes, the local host, the
 * settings of one server, the name, logo and update of a joined server's host, and the remote desktop
 * setup of a server.
 */
export interface ServersPort {
  agent: Pick<
    johnBotDesktopApi["agent"],
    | "getStatus"
    | "listAgents"
    | "listConversationReads"
    | "listHiddenAgents"
    | "listMcpServers"
    | "listModels"
    | "removeMcpServer"
    | "saveMcpServer"
    | "setMcpServerEnabled"
    | "testMcpServer"
    | "signInMcpServer"
    | "mcpSignInPage"
    | "mcpSignInRelay"
    | "openMcpSignInRelay"
    | "completeMcpSignInRelay"
    | "cancelMcpSignIn"
    | "signOutMcpServer"
    | "listMcpSignIns"
    | "mcpSignInApp"
    | "saveMcpSignInApp"
    | "removeMcpSignInApp"
  >;
  events: johnBotDesktopApi["events"];
  auth: Pick<johnBotDesktopApi["auth"], "onEvent">;
  browser: Pick<johnBotDesktopApi["browser"], "setVisible">;
  hostAdmin: Pick<
    johnBotDesktopApi["hostAdmin"],
    "cancelUpdate" | "getUpdateStatus" | "startUpdate" | "updateIdentity"
  >;
  hostedServers: Pick<johnBotDesktopApi["hostedServers"], "list" | "restart" | "wake">;
  host: Pick<
    johnBotDesktopApi["host"],
    | "configure"
    | "getStatus"
    | "onEvent"
    | "recheckScreenRecording"
    | "rotateIdentityKey"
    | "start"
    | "stop"
    | "updateIdentity"
  >;
  notifications: Pick<johnBotDesktopApi["notifications"], "onOpened">;
  remoteDesktop: Pick<
    johnBotDesktopApi["remoteDesktop"],
    "checkSetup" | "connect" | "disconnect" | "list" | "openSetup" | "test"
  >;
  servers: Pick<
    johnBotDesktopApi["servers"],
    | "getPresenceFor"
    | "join"
    | "list"
    | "onEvent"
    | "onPresence"
    | "refreshIdentity"
    | "remove"
    | "reorder"
    | "retryConnection"
    | "select"
    | "setMuted"
    | "setNotificationLevel"
  >;
}

/** Read on each call: tests and stories replace `window.johnbot` per case. */
export function serversPort(): ServersPort {
  return window.johnbot;
}

/**
 * The member and invite calls for one server. This computer answers them for the local server
 * through `host`; a remote server answers them through `servers`, addressed by its id.
 */
export type ServerAdminPort = Pick<
  johnBotDesktopApi["host"],
  "getPresence" | "listMembers" | "listInvites" | "createInvite" | "updateMember" | "removeMember" | "revokeInvite"
>;

export function serverAdminPort(server: Pick<ServerSummary, "id" | "kind">): ServerAdminPort {
  if (server.kind === "local") return window.johnbot.host;
  const serverId = server.id;
  return {
    getPresence: () => window.johnbot.servers.getPresenceFor(serverId),
    listMembers: () => window.johnbot.servers.listMembers(serverId),
    listInvites: () => window.johnbot.servers.listInvites(serverId),
    createInvite: (input) => window.johnbot.servers.createInvite(input, serverId),
    updateMember: (input) => window.johnbot.servers.updateMember(input, serverId),
    removeMember: (memberId) => window.johnbot.servers.removeMember(memberId, serverId),
    revokeInvite: (inviteId) => window.johnbot.servers.revokeInvite(inviteId, serverId),
  };
}

/** The server main marks active. A test teardown can remove the bridge while a join is pending. */
export async function activeServerId(): Promise<string> {
  if (!window.johnbot) return "local";
  return (await window.johnbot.servers.list()).find((item) => item.active)?.id ?? "local";
}
