import type { PartialTranslation } from "../../message";
import type { messages as source } from "../en/menu";

export const messages = {
  "menu.stopAllAgents": "Остановить всех агентов",
  "menu.checkForUpdates": "Проверить обновления…",
  "menu.preferences": "Настройки…",
  "menu.actualSize": "Фактический размер",
  "menu.zoomIn": "Увеличить",
  "menu.zoomOut": "Уменьшить",
  "menu.copyLink": "Скопировать ссылку",
  "menu.copyImage": "Скопировать изображение",
  "menu.quit": "Выйти из johnBot",
  "menu.quitConfirmTitle": "Выйти из johnBot?",
  "menu.quitConfirmBody": "Агенты и автозадачи остановятся, пока вы снова не откроете johnBot.",
  "menu.quitConfirm": "Выйти",
  "menu.quitHint": "Удерживайте ⌘Q или нажмите дважды, чтобы выйти",
  "menu.trayOpen": "Открыть johnBot",
  "menu.trayQuit": "Выйти из johnBot",
  "menu.trayTooltip": "johnBot",
  "menu.undo": "Отменить",
  "menu.redo": "Повторить",
  "menu.cut": "Вырезать",
  "menu.copy": "Копировать",
  "menu.paste": "Вставить",
  "menu.pasteAndMatchStyle": "Вставить в том же стиле",
  "menu.delete": "Удалить",
  "menu.selectAll": "Выделить все",
} as const satisfies PartialTranslation<typeof source>;
