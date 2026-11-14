import type { PartialTranslation } from "../../../message";
import type { messages as source } from "../../en/status/host";

export const messages = {
  "status.host.registered": "Deze johnBot is geregistreerd voor WebRTC-toegang.",
  "status.host.keyRotated": "Serversleutel gewijzigd. Gekoppelde apparaten blijven gekoppeld.",
  "status.host.identityUpdated": "Serveridentiteit bijgewerkt.",
  "status.host.starting": "WebRTC-host starten…",
  "status.host.ready": "Deze johnBot is klaar voor WebRTC-verbindingen.",
  "status.host.signalLost": "Andere apparaten kunnen deze johnBot nu niet bereiken. Hij maakt opnieuw verbinding.",
  "status.host.stopping": "Deze johnBot privé maken…",
  "status.host.private": "Deze johnBot is privé.",
  "status.host.removed": "Deze johnBot is uit je account verwijderd. Publiceer hem opnieuw om hem te delen.",
} as const satisfies PartialTranslation<typeof source>;
