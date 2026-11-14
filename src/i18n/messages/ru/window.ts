import type { PartialTranslation } from "../../message";
import type { messages as source } from "../en/window";

export const messages = {
  "window.localHostTitle": "johnBot: локальный хост",
  "window.localClientTitle": "johnBot: локальный клиент",
  "window.computerUsePermissionTitle": "Включите управление компьютером",
} as const satisfies PartialTranslation<typeof source>;
