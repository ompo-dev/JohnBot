import { defineMessages } from "../../../message";

export const messages = defineMessages("error.fleet", {
  "error.fleet.fileSize": "The telemetry file must contain no more than 5 MiB.",
  "error.fleet.format": "Telemetry import requires a valid CSV or JSON file.",
  "error.fleet.columns": "The telemetry file has missing or ambiguous columns.",
  "error.fleet.empty": "The telemetry file has no valid readings.",
  "error.fleet.spreadsheet": "The XLSX file is invalid or has unsupported cell data.",
  "error.fleet.archive": "The workbook exceeds the limit of 40 MiB of expanded data or 1,000 archive entries.",
  "error.fleet.attachment": "Use CSV, XLSX, JSON, a text PDF, TXT or Markdown.",
  "error.fleet.document": "The document has no readable UTF-8 text or is invalid.",
  "error.fleet.pdf": "The PDF has no extracted text. Scanned documents require OCR before analysis.",
});
