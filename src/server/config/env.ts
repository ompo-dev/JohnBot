import { z } from "zod";

// Server-only configuration. This module must never be imported from a Client
// Component: it would ship the Redis address and cookie policy into the browser.

const serverEnvSchema = z.object({
  JOHNBOT_DATA_MODE: z.enum(["postgres", "demo"]).default("postgres"),
  DATABASE_URL: z
    .string()
    .regex(/^postgres(?:ql)?:\/\//u)
    .optional(),
  REDIS_URL: z
    .string()
    .min(1)
    .regex(/^rediss?:\/\//u, "REDIS_URL must be a redis:// or rediss:// URL."),
  JOHNBOT_COOKIE_SECURE: z.enum(["0", "1"]).optional(),
  JOHNBOT_SESSION_TTL_SECONDS: z.coerce.number().int().min(300).max(31_536_000).optional(),
  JOHNBOT_A2A_ENDPOINTS: z.string().optional(),
  JOHNBOT_AUTO_ONTOLOGY_URL: z.string().url().optional(),
  JOHNBOT_AUTO_ONTOLOGY_TOKEN: z.string().min(1).optional(),
  JOHNBOT_DASHBOARD_MODEL: z.string().min(1).optional(),
  JOHNBOT_DASHBOARD_API_KEY: z.string().min(1).optional(),
  JOHNBOT_DASHBOARD_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
});

const a2aEndpointSchema = z
  .object({
    id: z
      .string()
      .trim()
      .regex(/^[a-z][a-z0-9-]{0,63}$/u),
    url: z
      .string()
      .url()
      .refine((value) => new URL(value).protocol === "https:", "A2A endpoints must use HTTPS."),
    token: z.string().min(1).optional(),
  })
  .strict();

export type A2AEndpointConfig = z.infer<typeof a2aEndpointSchema>;

export function parseA2AEndpointConfigs(value: string | undefined): A2AEndpointConfig[] {
  if (!value?.trim()) return [];
  let decoded: unknown;
  try {
    decoded = JSON.parse(value);
  } catch {
    throw new Error("JOHNBOT_A2A_ENDPOINTS must be valid JSON.");
  }
  const endpoints = z.array(a2aEndpointSchema).max(20).parse(decoded);
  if (new Set(endpoints.map((endpoint) => endpoint.id)).size !== endpoints.length)
    throw new Error("JOHNBOT_A2A_ENDPOINTS contains duplicate endpoint IDs.");
  return endpoints;
}

function approvedOntologyUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("JOHNBOT_AUTO_ONTOLOGY_URL must use HTTPS.");
  return url.toString().replace(/\/$/u, "");
}

export interface ServerEnv {
  dataMode: "postgres" | "demo";
  databaseUrl?: string;
  redisUrl: string;
  cookieSecure: boolean;
  sessionTtlSeconds: number;
  a2aEndpoints: readonly A2AEndpointConfig[];
  autoOntologyUrl?: string;
  autoOntologyToken?: string;
  dashboardModel?: string;
  dashboardApiKey?: string;
  dashboardBaseUrl: string;
}

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverEnvSchema.parse({
    JOHNBOT_DATA_MODE: process.env.JOHNBOT_DATA_MODE,
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
    JOHNBOT_COOKIE_SECURE: process.env.JOHNBOT_COOKIE_SECURE,
    JOHNBOT_SESSION_TTL_SECONDS: process.env.JOHNBOT_SESSION_TTL_SECONDS,
    JOHNBOT_A2A_ENDPOINTS: process.env.JOHNBOT_A2A_ENDPOINTS,
    JOHNBOT_AUTO_ONTOLOGY_URL: process.env.JOHNBOT_AUTO_ONTOLOGY_URL,
    JOHNBOT_AUTO_ONTOLOGY_TOKEN: process.env.JOHNBOT_AUTO_ONTOLOGY_TOKEN,
    JOHNBOT_DASHBOARD_MODEL: process.env.JOHNBOT_DASHBOARD_MODEL || undefined,
    JOHNBOT_DASHBOARD_API_KEY: process.env.JOHNBOT_DASHBOARD_API_KEY || undefined,
    JOHNBOT_DASHBOARD_BASE_URL: process.env.JOHNBOT_DASHBOARD_BASE_URL || undefined,
  });
  cached = {
    dataMode: parsed.JOHNBOT_DATA_MODE,
    databaseUrl: parsed.DATABASE_URL,
    redisUrl: parsed.REDIS_URL,
    cookieSecure: parsed.JOHNBOT_COOKIE_SECURE === "1",
    sessionTtlSeconds: parsed.JOHNBOT_SESSION_TTL_SECONDS ?? 2_592_000,
    a2aEndpoints: parseA2AEndpointConfigs(parsed.JOHNBOT_A2A_ENDPOINTS),
    autoOntologyUrl: approvedOntologyUrl(parsed.JOHNBOT_AUTO_ONTOLOGY_URL),
    autoOntologyToken: parsed.JOHNBOT_AUTO_ONTOLOGY_TOKEN,
    dashboardModel: parsed.JOHNBOT_DASHBOARD_MODEL,
    dashboardApiKey: parsed.JOHNBOT_DASHBOARD_API_KEY,
    dashboardBaseUrl: parsed.JOHNBOT_DASHBOARD_BASE_URL.replace(/\/$/u, ""),
  };
  return cached;
}

/** Tests and development reloads can drop the memoized environment. */
export function resetServerEnvForTests(): void {
  cached = undefined;
}
