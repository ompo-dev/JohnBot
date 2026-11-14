import type { PartialTranslation } from "../../message";
import type { messages as source } from "../en/startup";

export const messages = {
  "startup.failedTitle": "Nie udało się uruchomić johnBot",
  "startup.failedBody":
    "{message}\n\nTwoje lokalne dane nie zostały zresetowane ani nadpisane. Kroki przywracania znajdziesz w przewodniku rozwiązywania problemów.",
  "startup.archiveChangedTitle": "Pliki johnBot zostały zmienione",
  "startup.archiveChangedBody":
    "Inny program zmienił plik app.asar johnBot. johnBot działa teraz, ale nie uruchomi się po zamknięciu.\n\nAby naprawić johnBot, zainstaluj go ponownie. Twoje lokalne dane zostaną zachowane.",
  "startup.archiveChangedDownload": "Pobierz johnBot",
  "startup.newerDataUpdatingTitle": "Aktualizowanie johnBot",
  "startup.newerDataUpdatingBody":
    "Nowsza wersja johnBot zapisała Twoje dane. johnBot instaluje najnowszą wersję, a potem uruchomi się ponownie.\n\nTwoje lokalne dane nie zostały zresetowane ani nadpisane.",
  "startup.newerDataTitle": "Zainstaluj najnowszy johnBot",
  "startup.newerDataBody":
    "Nowsza wersja johnBot zapisała Twoje dane, a ta wersja ({version}) nie może ich otworzyć. Zainstaluj najnowszą wersję, aby otworzyć swoje dane.\n\nTwoje lokalne dane nie zostały zresetowane ani nadpisane.",
  "startup.newerDataDownload": "Pobierz johnBot",
  "startup.newerDataGuide": "Otwórz przewodnik",
  "startup.newerDataQuit": "Zakończ",
} as const satisfies PartialTranslation<typeof source>;
