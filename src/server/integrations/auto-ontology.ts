import { serverEnv } from "../config/env";

export async function autoOntologyStatus(): Promise<{
  configured: boolean;
  status: "disabled" | "ready" | "unavailable";
}> {
  const { autoOntologyUrl, autoOntologyToken } = serverEnv();
  if (!autoOntologyUrl) return { configured: false, status: "disabled" };
  try {
    const headers = autoOntologyToken
      ? { authorization: `Bearer ${autoOntologyToken}` }
      : undefined;
    const response = await fetch(`${autoOntologyUrl}/api/health`, {
      headers,
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });
    return { configured: true, status: response.ok ? "ready" : "unavailable" };
  } catch {
    return { configured: true, status: "unavailable" };
  }
}
