import type { PartialTranslation } from "../../message";
import type { messages as source } from "../en/startup";

export const messages = {
  "startup.failedTitle": "تعذّر بدء تشغيل johnBot",
  "startup.failedBody":
    "{message}\n\nلم تُعَد تعيين بياناتك المحلية ولم يُكتب فوقها. راجع دليل استكشاف الأخطاء وإصلاحها لمعرفة خطوات الاسترداد.",
  "startup.archiveChangedTitle": "تم تغيير ملفات johnBot",
  "startup.archiveChangedBody":
    "غيّر برنامج آخر ملف johnBot المسمى app.asar. يعمل johnBot الآن، لكنه لن يفتح بعد إنهائه.\n\nلإصلاح johnBot، ثبّته من جديد. تبقى بياناتك المحلية.",
  "startup.archiveChangedDownload": "تنزيل johnBot",
  "startup.newerDataUpdatingTitle": "جارٍ تحديث johnBot",
  "startup.newerDataUpdatingBody":
    "حفظ إصدار أحدث من johnBot بياناتك. يثبّت johnBot أحدث إصدار ثم يفتح مرة أخرى.\n\nلم تتم إعادة تعيين بياناتك المحلية أو الكتابة فوقها.",
  "startup.newerDataTitle": "ثبّت أحدث إصدار من johnBot",
  "startup.newerDataBody":
    "حفظ إصدار أحدث من johnBot بياناتك، ولا يستطيع هذا الإصدار ({version}) فتحها. ثبّت أحدث إصدار لفتح بياناتك.\n\nلم تتم إعادة تعيين بياناتك المحلية أو الكتابة فوقها.",
  "startup.newerDataDownload": "تنزيل johnBot",
  "startup.newerDataGuide": "فتح الدليل",
  "startup.newerDataQuit": "إنهاء",
} as const satisfies PartialTranslation<typeof source>;
