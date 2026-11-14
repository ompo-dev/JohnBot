import type { PartialTranslation } from "../../message";
import type { messages as source } from "../en/startup";

export const messages = {
  "startup.failedTitle": "johnBot не удалось запустить",
  "startup.failedBody":
    "{message}\n\nЛокальные данные не сброшены и не перезаписаны. Шаги восстановления — в руководстве по устранению неполадок.",
  "startup.archiveChangedTitle": "Файлы johnBot изменены",
  "startup.archiveChangedBody":
    "Другая программа изменила файл johnBot app.asar. Сейчас johnBot работает, но после выхода он больше не запустится.\n\nЧтобы исправить это, установите johnBot заново. Ваши локальные данные сохранятся.",
  "startup.archiveChangedDownload": "Скачать johnBot",
  "startup.newerDataUpdatingTitle": "Обновление johnBot",
  "startup.newerDataUpdatingBody":
    "Более новая версия johnBot сохранила ваши данные. johnBot устанавливает последнюю версию и затем откроется снова.\n\nВаши локальные данные не были сброшены или перезаписаны.",
  "startup.newerDataTitle": "Установите последнюю версию johnBot",
  "startup.newerDataBody":
    "Более новая версия johnBot сохранила ваши данные, и эта версия ({version}) не может их открыть. Установите последнюю версию, чтобы открыть данные.\n\nВаши локальные данные не были сброшены или перезаписаны.",
  "startup.newerDataDownload": "Скачать johnBot",
  "startup.newerDataGuide": "Открыть руководство",
  "startup.newerDataQuit": "Выйти",
} as const satisfies PartialTranslation<typeof source>;
