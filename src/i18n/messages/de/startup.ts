import type { PartialTranslation } from "../../message";
import type { messages as source } from "../en/startup";

export const messages = {
  "startup.failedTitle": "johnBot konnte nicht starten",
  "startup.failedBody":
    "{message}\n\nDeine lokalen Daten wurden weder zurückgesetzt noch überschrieben. Schritte zur Wiederherstellung findest du in der Anleitung zur Fehlerbehebung.",
  "startup.archiveChangedTitle": "johnBot-Dateien wurden geändert",
  "startup.archiveChangedBody":
    "Ein anderes Programm hat die johnBot-Datei app.asar geändert. johnBot läuft jetzt, startet aber nicht mehr, wenn du es beendest.\n\nInstalliere johnBot erneut, um es zu reparieren. Deine lokalen Daten bleiben erhalten.",
  "startup.archiveChangedDownload": "johnBot laden",
  "startup.newerDataUpdatingTitle": "johnBot wird aktualisiert",
  "startup.newerDataUpdatingBody":
    "Eine neuere Version von johnBot hat deine Daten gespeichert. johnBot installiert die neueste Version und startet dann neu.\n\nDeine lokalen Daten wurden nicht zurückgesetzt oder überschrieben.",
  "startup.newerDataTitle": "Neueste johnBot-Version installieren",
  "startup.newerDataBody":
    "Eine neuere Version von johnBot hat deine Daten gespeichert, und diese Version ({version}) kann sie nicht öffnen. Installiere die neueste Version, um deine Daten zu öffnen.\n\nDeine lokalen Daten wurden nicht zurückgesetzt oder überschrieben.",
  "startup.newerDataDownload": "johnBot laden",
  "startup.newerDataGuide": "Anleitung öffnen",
  "startup.newerDataQuit": "Beenden",
} as const satisfies PartialTranslation<typeof source>;
