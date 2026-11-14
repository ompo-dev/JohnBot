import { z } from "zod";

export const a2aEndpointStatusSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  status: z.enum(["ready", "unavailable"]),
  name: z.string().nullable(),
  description: z.string().nullable(),
  version: z.string().nullable(),
});

export const ontologyStatusSchema = z.object({
  configured: z.boolean(),
  status: z.enum(["disabled", "ready", "unavailable"]),
});

export const externalIntegrationsStatusSchema = z.object({
  a2a: z.array(a2aEndpointStatusSchema),
  autoOntology: ontologyStatusSchema,
});

export type ExternalIntegrationsStatus = z.infer<typeof externalIntegrationsStatusSchema>;
