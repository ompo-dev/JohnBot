import { z } from "zod";
import { dashboardWidgetSchema } from "./operations";
import { DASHBOARD_BUILDER_ID } from "./dashboard-builder";

export const dashboardComposeSchema = z
  .object({
    expectedRevision: z.number().int().nonnegative(),
    agentId: z
      .string()
      .regex(/^[\w:.-]{1,128}$/u)
      .default(DASHBOARD_BUILDER_ID),
    dashboardId: z
      .string()
      .regex(/^[\w:.-]{1,128}$/u)
      .nullish(),
    title: z.string().trim().min(1).max(200).optional(),
    objective: z.string().trim().min(1).max(2000),
  })
  .strict();

/** Agents select data-bound widgets. They never send executable UI, HTML or SQL. */
export const dashboardCompositionSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    widgets: dashboardWidgetSchema.array().max(8).default([]),
    program: z.string().trim().min(1).max(64_000).optional(),
    summary: z.string().trim().min(1).max(4000).optional(),
  })
  .strict()
  .refine(
    (value) => Boolean(value.program) || value.widgets.length > 0,
    "A dashboard needs a program or legacy widgets.",
  )
  .refine(
    (value) =>
      value.widgets.every((widget) =>
        widget.source === "downtime"
          ? widget.kind === "chart" || widget.kind === "table"
          : widget.source === "quality"
            ? widget.kind === "metric"
            : widget.kind === "table",
      ),
    "Unsupported data/widget combination.",
  );
