import { z } from "zod";

export const connectorPreviewSchema = z
  .object({
    connectorId: z.string(),
    mode: z.enum(["mock", "local"]),
    source: z.string(),
    observedAt: z.iso.datetime(),
    resources: z.array(
      z
        .object({
          id: z.string(),
          name: z.string(),
          columns: z.array(z.string()),
          rows: z.array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))).max(100),
        })
        .strict(),
    ),
  })
  .strict();
