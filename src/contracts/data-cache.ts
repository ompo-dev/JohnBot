/** Cache only snapshots/queries; streams, mutations and provider execution are never cached. */
export function queryTtlMs(path: string): number {
  if (path.startsWith("/api/agents") && /conversation|queue|reads/.test(path)) return 5_000;
  if (path.startsWith("/api/jobs")) return 2_000;
  if (path.startsWith("/api/app-info")) return 3_600_000;
  return 30_000;
}
export function commandQueryPrefixes(command: string): string[] {
  if (command.startsWith("dashboards.")) return ["/api/operations", "/api/twin", "/api/jobs"];
  if (command.startsWith("routines.")) return ["/api/workflows", "/api/jobs"];
  if (command.startsWith("operations.")) return ["/api/operations", "/api/connections", "/api/twin", "/api/jobs"];
  if (command.startsWith("workspace.")) return ["/api/workspace", "/api/jobs"];
  if (command.startsWith("settings.")) return ["/api/settings"];
  if (command.startsWith("preferences.")) return ["/api/preferences"];
  if (command.startsWith("workflows.")) return ["/api/workflows", "/api/operations", "/api/twin", "/api/jobs"];
  if (command.startsWith("agents.")) return ["/api/agents", "/api/jobs"];
  if (command.startsWith("marketplace.")) return ["/api/marketplace", "/api/jobs"];
  if (command.startsWith("jobs.")) return ["/api/jobs"];
  if (command.startsWith("account.")) return ["/api/account", "/api/usage"];
  return ["/api/"];
}
