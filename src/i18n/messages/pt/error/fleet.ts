import { defineMessages } from "../../../message";

export const messages = defineMessages("error.fleet", {
  "error.fleet.fileSize": "O arquivo de telemetria deve ter no máximo 5 MiB.",
  "error.fleet.format": "A importação de telemetria exige um arquivo CSV ou JSON válido.",
  "error.fleet.columns": "O arquivo de telemetria tem colunas ausentes ou ambíguas.",
  "error.fleet.empty": "O arquivo de telemetria não tem leituras válidas.",
  "error.fleet.spreadsheet": "O arquivo XLSX é inválido ou contém dados de células incompatíveis.",
  "error.fleet.archive": "A planilha excede o limite de 40 MiB de dados expandidos ou 1.000 entradas no arquivo.",
  "error.fleet.attachment": "Use CSV, XLSX, JSON, PDF com texto, TXT ou Markdown.",
  "error.fleet.document": "O documento não contém texto UTF-8 legível ou é inválido.",
  "error.fleet.pdf": "O PDF não contém texto extraído. Documentos digitalizados precisam de OCR antes da análise.",
});
