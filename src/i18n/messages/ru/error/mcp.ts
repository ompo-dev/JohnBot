import type { PartialTranslation } from "../../../message";
import type { messages as source } from "../../en/error/mcp";

export const messages = {
  "error.mcp.redirectByName": "Этот адрес недоступен по имени.",
  "error.mcp.redirectGetOnly": "Этот адрес отвечает только на GET.",
  "error.mcp.redirectNotSignIn": "Этот адрес не относится ко входу.",
  "error.mcp.redirectRefused": "Вход отклонён. Вернитесь в johnBot и повторите попытку.",
  "error.mcp.redirectNoSignIn": "Нет входа, который ждал бы этого. Возможно, он уже завершён.",
  "error.mcp.redirectSignedIn": "johnBot выполнил вход. Это окно можно закрыть.",
  "error.mcp.signInFileUnreadable": "Файл входа MCP не читается.",
  "error.mcp.signInFileTooLarge": "Файл входа MCP слишком большой.",
  "error.mcp.unsupported": "Этот сервер не поддерживает серверы MCP.",
  "error.mcp.signInOnHost": "Войти в сервер MCP можно только в johnBot на компьютере-хосте.",
  "error.mcp.signInAppUnsupported": "Этот сервер не поддерживает приложения входа. Обновите johnBot на хосте.",
  "error.mcp.redirectRelayed": "johnBot отправил вход на сервер. Это окно можно закрыть.",
  "error.mcp.relayEnded": "Этот вход завершён. Начните его снова.",
  "error.mcp.relayNoState":
    "Страница входа сервера не защищает свой обратный адрес, поэтому johnBot не открывает её на этом компьютере.",
  "error.mcp.relayAddressInvalid":
    "Это не тот адрес, которым завершается этот вход. Скопируйте полный адрес из браузера.",
} as const satisfies PartialTranslation<typeof source>;
