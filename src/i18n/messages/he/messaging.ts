import type { PartialTranslation } from "../../message";
import type { messages as source } from "../en/messaging";

export const messages = {
  "messaging.help.invalid_token":
    "Slack כבר לא מקבל את johnBot בסביבת העבודה הזאת. ייתכן שהוא הוסר. יש לחבר את סביבת העבודה מחדש.",
  "messaging.help.secret_storage_unavailable":
    "johnBot לא יכול לקרוא את האסימונים השמורים במחשב הזה. יש לנתק את סביבת העבודה ואז לחבר אותה מחדש.",
  "messaging.help.relay_unavailable":
    "johnBot לא יכול לקבל אירועי Slack במחשב הזה. יש להתחבר, לתת למחשב הזה שם בהגדרות השרת ולהשאיר את johnBot פתוח.",
  "messaging.discordHelp.invalid_token":
    "Discord כבר לא מקבל את johnBot בשרת ה-Discord הזה. ייתכן שהוא הוסר. יש לחבר את שרת ה-Discord מחדש.",
  "messaging.discordHelp.secret_storage_unavailable":
    "johnBot לא יכול לקרוא את האסימונים השמורים במחשב הזה. יש לנתק את שרת ה-Discord ואז לחבר אותו מחדש.",
  "messaging.discordHelp.relay_unavailable":
    "johnBot לא יכול לקבל אירועי Discord במחשב הזה. יש להתחבר, לתת למחשב הזה שם בהגדרות השרת ולהשאיר את johnBot פתוח.",
} as const satisfies PartialTranslation<typeof source>;
