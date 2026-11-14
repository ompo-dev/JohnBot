// The bridge calls behind an agent's Folders row, the Folders page and the chat's folder drop. Only
// the local server has them: the Team API does not carry an agent's folders.

import type { AgentFolderCalls } from "@johnbot/features/conversation/AgentFolders";

/** Read on each call: tests and stories replace `window.johnbot` per case. */
export function agentFolderCalls(): AgentFolderCalls {
  return {
    list: (agentId) => window.johnbot.agent.listAgentFolders(agentId),
    choose: (agentId, replace) =>
      window.johnbot.agent.chooseAgentFolder(replace === undefined ? { agentId } : { agentId, replace }),
    add: (agentId, path) => window.johnbot.agent.addAgentFolder({ agentId, path }),
    remove: (agentId, path) => window.johnbot.agent.removeAgentFolder({ agentId, path }),
    drop: (agentId, folder) => window.johnbot.agent.addDroppedAgentFolder(agentId, folder),
    exclude: (agentId) => window.johnbot.agent.chooseAgentExclusion(agentId),
    addExclusion: (agentId, path) => window.johnbot.agent.addAgentExclusion({ agentId, path }),
    include: (agentId, path) => window.johnbot.agent.removeAgentExclusion({ agentId, path }),
  };
}
