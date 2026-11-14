import { DefaultAgentCardResolver } from "@a2a-js/sdk/client";
import type { A2AEndpointConfig } from "../config/env";

export interface A2AAgentCardSummary {
  id: string;
  url: string;
  status: "ready" | "unavailable";
  name: string | null;
  description: string | null;
  version: string | null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

/** A2A addresses are operator configuration, still constrained before every server-side request. */
function endpointFetch(endpoint: A2AEndpointConfig): typeof fetch {
  return async (input, init) => {
    const target = new URL(typeof input === "string" ? input : input.url);
    if (target.protocol !== "https:" || target.origin !== new URL(endpoint.url).origin)
      throw new Error("A2A discovery target is not allowed.");
    const headers = new Headers(init?.headers);
    if (endpoint.token) headers.set("authorization", `Bearer ${endpoint.token}`);
    return fetch(input, {
      ...init,
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
  };
}

export async function inspectA2AEndpoint(
  endpoint: A2AEndpointConfig,
): Promise<A2AAgentCardSummary> {
  try {
    const resolver = new DefaultAgentCardResolver({ fetchImpl: endpointFetch(endpoint) });
    const card = await resolver.resolve(endpoint.url);
    return {
      id: endpoint.id,
      url: endpoint.url,
      status: "ready",
      name: text(card.name),
      description: text(card.description),
      version: text(card.version),
    };
  } catch {
    return {
      id: endpoint.id,
      url: endpoint.url,
      status: "unavailable",
      name: null,
      description: null,
      version: null,
    };
  }
}
