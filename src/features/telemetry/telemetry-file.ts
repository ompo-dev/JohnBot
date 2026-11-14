import { FLEET_FILE_BYTES, type FleetPrepareInput } from "@johnbot/contracts/fleet";

export async function readTelemetryFile(file: File): Promise<FleetPrepareInput> {
  if (file.size > FLEET_FILE_BYTES) throw new Error("File too large.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength > FLEET_FILE_BYTES) throw new Error("File too large.");
  if (/\.xlsx$/iu.test(file.name)) {
    return { filename: file.name, content: encodeFileBytes(bytes), encoding: "base64" };
  }
  return { filename: file.name, content: new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes) };
}

export function encodeFileBytes(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
}
