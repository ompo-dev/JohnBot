import { FLEET_ATTACHMENT_TEXT, FLEET_FILE_BYTES, type FleetAttachmentInput } from "@johnbot/contracts/fleet";
import { sourceText } from "@johnbot/i18n/source";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { encodeFileBytes, readTelemetryFile } from "./telemetry-file";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/** The selected PDF stays in a local worker. Only text extraction runs. */
export async function readAttachmentFile(file: File, signal: AbortSignal): Promise<FleetAttachmentInput> {
  if (file.size > FLEET_FILE_BYTES) throw new Error(sourceText("error.fleet.fileSize"));
  if (!/\.pdf$/iu.test(file.name)) return readTelemetryFile(file);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength > FLEET_FILE_BYTES) throw new Error(sourceText("error.fleet.fileSize"));
  const task = getDocument({
    data: bytes.slice(),
    useWorkerFetch: false,
    useWasm: false,
    disableFontFace: true,
    useSystemFonts: false,
    stopAtErrors: true,
  });
  const abort = () => {
    void task.destroy();
  };
  signal.addEventListener("abort", abort, { once: true });
  const deadline = setTimeout(abort, 30_000);
  try {
    if (signal.aborted) throw new Error(sourceText("error.fleet.pdf"));
    const document = await task.promise;
    let text = "",
      truncated = false;
    for (let number = 1; number <= Math.min(document.numPages, 2000); number++) {
      if (signal.aborted) throw new Error(sourceText("error.fleet.pdf"));
      const page = await document.getPage(number);
      try {
        const content = await page.getTextContent();
        for (const item of content.items) {
          if ("str" in item) text += item.str + (item.hasEOL ? "\n" : " ");
          if (text.length >= FLEET_ATTACHMENT_TEXT) {
            truncated = true;
            break;
          }
        }
        text += "\n";
      } finally {
        page.cleanup();
      }
      if (truncated) break;
    }
    truncated ||= document.numPages > 2000;
    if (!text.trim()) throw new Error(sourceText("error.fleet.pdf"));
    return {
      filename: file.name,
      content: encodeFileBytes(bytes),
      encoding: "base64",
      extractedText: text.slice(0, FLEET_ATTACHMENT_TEXT),
      pages: document.numPages,
      textTruncated: truncated,
    };
  } finally {
    clearTimeout(deadline);
    signal.removeEventListener("abort", abort);
    await task.destroy();
  }
}
