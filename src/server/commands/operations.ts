import { operationsChangeSchema, operationsSchema } from "../../contracts/operations";
import { changeOperations } from "../services/operations";
import type { RegisteredCommand } from "./types";
import { dashboardComposeSchema } from "../../contracts/dashboard-compose";
import { composeDashboard } from "../services/dashboard-compose";

export const OPERATIONS_COMMANDS: Record<string, RegisteredCommand> = {
  "dashboards.compose": {
    idempotent: true,
    payloadSchema: dashboardComposeSchema,
    resultSchema: operationsSchema,
    run: (context, payload) =>
      composeDashboard(context.sessionId, dashboardComposeSchema.parse(payload)),
  },
  "operations.change": {
    idempotent: true,
    payloadSchema: operationsChangeSchema,
    resultSchema: operationsSchema,
    run: (context, payload) =>
      changeOperations(context.sessionId, operationsChangeSchema.parse(payload)),
  },
};
