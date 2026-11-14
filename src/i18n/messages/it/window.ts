import type { PartialTranslation } from "../../message";
import type { messages as source } from "../en/window";

export const messages = {
  "window.localHostTitle": "johnBot — host locale",
  "window.localClientTitle": "johnBot — client locale",
  "window.computerUsePermissionTitle": "Attiva il Controllo del computer",
} as const satisfies PartialTranslation<typeof source>;
