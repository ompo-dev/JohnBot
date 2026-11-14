import type { PartialTranslation } from "../../message";
import type { messages as source } from "../en/startup";

export const messages = {
  "startup.failedTitle": "johnBot לא הצליח להיפתח",
  "startup.failedBody":
    "{message}\n\nהנתונים המקומיים שלך לא אופסו ולא נדרסו. בצעדי השחזור שבמדריך לפתרון בעיות אפשר לקרוא איך להמשיך.",
  "startup.archiveChangedTitle": "קובצי johnBot שונו",
  "startup.archiveChangedBody":
    "תוכנה אחרת שינתה את קובץ johnBot app.asar. johnBot פועל כעת, אך לא ייפתח לאחר היציאה ממנו.\n\nכדי לתקן את johnBot, יש להתקין אותו מחדש. הנתונים המקומיים נשמרים.",
  "startup.archiveChangedDownload": "הורדת johnBot",
  "startup.newerDataUpdatingTitle": "johnBot מתעדכן",
  "startup.newerDataUpdatingBody":
    "גרסה חדשה יותר של johnBot שמרה את הנתונים שלך. johnBot מתקין את הגרסה האחרונה ואז נפתח מחדש.\n\nהנתונים המקומיים שלך לא אופסו ולא נדרסו.",
  "startup.newerDataTitle": "התקנת johnBot העדכני ביותר",
  "startup.newerDataBody":
    "גרסה חדשה יותר של johnBot שמרה את הנתונים שלך, והגרסה הזו ({version}) אינה יכולה לפתוח אותם. יש להתקין את הגרסה האחרונה כדי לפתוח את הנתונים.\n\nהנתונים המקומיים שלך לא אופסו ולא נדרסו.",
  "startup.newerDataDownload": "הורדת johnBot",
  "startup.newerDataGuide": "פתיחת המדריך",
  "startup.newerDataQuit": "יציאה",
} as const satisfies PartialTranslation<typeof source>;
