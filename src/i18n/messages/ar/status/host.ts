import type { PartialTranslation } from "../../../message";
import type { messages as source } from "../../en/status/host";

export const messages = {
  "status.host.registered": "تم تسجيل johnBot هذا للوصول عبر WebRTC.",
  "status.host.keyRotated": "تغيّر مفتاح الخادم. تبقى الأجهزة المقترنة مقترنة.",
  "status.host.identityUpdated": "تم تحديث هوية الخادم.",
  "status.host.starting": "جارٍ تشغيل مضيف WebRTC…",
  "status.host.ready": "johnBot هذا جاهز لاتصالات WebRTC.",
  "status.host.signalLost": "لا يمكن للأجهزة الأخرى الوصول إلى johnBot هذا الآن. سيتصل مرة أخرى.",
  "status.host.stopping": "جارٍ جعل johnBot هذا خاصًا…",
  "status.host.private": "johnBot هذا خاص.",
  "status.host.removed": "أُزيل johnBot هذا من حسابك. انشره مرة أخرى لمشاركته.",
} as const satisfies PartialTranslation<typeof source>;
