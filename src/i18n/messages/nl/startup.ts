import type { PartialTranslation } from "../../message";
import type { messages as source } from "../en/startup";

export const messages = {
  "startup.failedTitle": "johnBot kan niet starten",
  "startup.failedBody":
    "{message}\n\nJe lokale gegevens zijn niet gereset of overschreven. Bekijk de handleiding voor probleemoplossing voor herstelstappen.",
  "startup.archiveChangedTitle": "johnBot-bestanden zijn gewijzigd",
  "startup.archiveChangedBody":
    "Een ander programma heeft het johnBot-bestand app.asar gewijzigd. johnBot werkt nu, maar opent niet meer nadat je het afsluit.\n\nInstalleer johnBot opnieuw om het te herstellen. Je lokale gegevens blijven bewaard.",
  "startup.archiveChangedDownload": "johnBot downloaden",
  "startup.newerDataUpdatingTitle": "johnBot wordt bijgewerkt",
  "startup.newerDataUpdatingBody":
    "Een nieuwere versie van johnBot heeft je gegevens opgeslagen. johnBot installeert de nieuwste versie en opent daarna opnieuw.\n\nJe lokale gegevens zijn niet gereset of overschreven.",
  "startup.newerDataTitle": "Installeer de nieuwste johnBot",
  "startup.newerDataBody":
    "Een nieuwere versie van johnBot heeft je gegevens opgeslagen, en deze versie ({version}) kan ze niet openen. Installeer de nieuwste versie om je gegevens te openen.\n\nJe lokale gegevens zijn niet gereset of overschreven.",
  "startup.newerDataDownload": "johnBot downloaden",
  "startup.newerDataGuide": "Gids openen",
  "startup.newerDataQuit": "Stoppen",
} as const satisfies PartialTranslation<typeof source>;
