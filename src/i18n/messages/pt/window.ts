import type { PartialTranslation } from "../../message";
import type { messages as source } from "../en/window";

export const messages = {
  "window.localHostTitle": "Computador anfitrião local do johnBot",
  "window.localClientTitle": "Cliente local do johnBot",
  "window.computerUsePermissionTitle": "Ativar Uso do computador",
} as const satisfies PartialTranslation<typeof source>;
