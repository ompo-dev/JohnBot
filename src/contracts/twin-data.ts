import { z } from "zod";

/** The John Twin as the server sends it: the factory, its links and its notebooks. */
export const twinNodeSchema = z
  .object({
    id: z.string().min(1).max(64),
    kind: z.enum(["department", "person", "role", "machine", "system", "project", "client", "contract"]),
    name: z.string().min(1).max(200),
    detail: z.string().max(4000),
    dept: z.string().max(64).nullish(),
    status: z.string().max(64).nullish(),
  })
  .strict();

export const twinEdgeSchema = z
  .object({
    from: z.string().min(1).max(64),
    to: z.string().min(1).max(64),
    label: z.string().max(80).nullish(),
  })
  .strict();

export const twinNotebookEntrySchema = z
  .object({
    id: z.string().min(1).max(64),
    date: z.string().min(1).max(64),
    author: z.string().min(1).max(200),
    text: z.string().min(1).max(8000),
    tags: z.array(z.string().max(80)).max(40),
    links: z.array(z.string().max(200)).max(200),
  })
  .strict();

export const twinNotebookSchema = z
  .object({
    id: z.string().min(1).max(64),
    title: z.string().min(1).max(200),
    ownerKind: z.enum(["person", "department", "equipment", "project", "client", "agent", "case"]),
    ownerId: z.string().min(1).max(64),
    visibility: z.array(z.string().max(120)).max(40),
    entries: z.array(twinNotebookEntrySchema).max(5000),
  })
  .strict();

export const twinAccessExceptionSchema = z
  .object({
    id: z.string().min(1).max(64),
    personId: z.string().min(1).max(64),
    scope: z.string().min(1).max(120),
    reason: z.string().min(1).max(500),
    expiresAt: z.string().max(64).nullish(),
  })
  .strict();

export const twinDataSchema = z
  .object({
    nodes: z.array(twinNodeSchema).max(5000),
    edges: z.array(twinEdgeSchema).max(20000),
    notebooks: z.array(twinNotebookSchema).max(1000),
    accessExceptions: z.array(twinAccessExceptionSchema).max(2000),
  })
  .strict();

export type TwinData = z.infer<typeof twinDataSchema>;
