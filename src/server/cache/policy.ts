/** Only revisions that can affect this projection belong in its cache key. */
export function queryDomains(resource: string): string[] | undefined {
  if (resource === "operations") return ["operations-v1"];
  if (resource.startsWith("/api/workspace")) {
    const url = new URL(resource, "http://local");
    return url.searchParams.get("resource") === "sidebar" ? ["sidebar"] : ["agents", `memories:${url.searchParams.get("agentId")}`];
  }
  if (resource === "session" || resource.startsWith("usage:")) return ["session"];
  if (resource === "preferences") return ["preferences"];
  if (resource.includes('"workflow"')) return ["workflows-v1"];
  if (resource.startsWith("workflow-runs:")) return [resource];
  if (resource.includes("marketplace")) return ["marketplace", "marketplace-catalog"];
  if (resource.startsWith("/api/agents")) {
    const url = new URL(resource, "http://local");
    const domain = url.searchParams.get("domain") ?? "conversation";
    const agentId = url.searchParams.get("agentId");
    if (domain === "conversation" || domain === "queue") return agentId ? ["agents", `conversation:${agentId}`] : ["agents"];
    if (domain === "models") return ["agent-models"];
    if (domain === "status") return ["agent-status"];
    if (domain === "agents") return ["agents"];
    // The read-marker listing aggregates all conversations of the roster.
  }
  return undefined;
}
export function queryRevalidateSeconds(resource: string): number {
  if (resource.startsWith("jobs:")) return 2;
  return resource.startsWith("/api/agents") && /conversation|queue|reads/.test(resource) ? 5 : 30;
}
