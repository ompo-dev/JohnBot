import type { PartialTranslation } from "../../message";
import type { messages as source } from "../en/startup";

export const messages = {
  "startup.failedTitle": "johnBot başlatılamadı",
  "startup.failedBody":
    "{message}\n\nYerel verileriniz sıfırlanmadı veya üzerine yazılmadı. Kurtarma adımları için sorun giderme kılavuzuna bakın.",
  "startup.archiveChangedTitle": "johnBot dosyaları değiştirildi",
  "startup.archiveChangedBody":
    "Başka bir program johnBot’un app.asar dosyasını değiştirdi. johnBot şu an çalışıyor, ancak kapattıktan sonra açılmayacak.\n\nOnarmak için johnBot’u yeniden yükleyin. Yerel verileriniz korunur.",
  "startup.archiveChangedDownload": "johnBot’u indir",
  "startup.newerDataUpdatingTitle": "johnBot güncelleniyor",
  "startup.newerDataUpdatingBody":
    "johnBot’un daha yeni bir sürümü verilerinizi kaydetti. johnBot en son sürümü yüklüyor ve ardından yeniden açılacak.\n\nYerel verileriniz sıfırlanmadı veya üzerine yazılmadı.",
  "startup.newerDataTitle": "En son johnBot’u yükleyin",
  "startup.newerDataBody":
    "johnBot’un daha yeni bir sürümü verilerinizi kaydetti ve bu sürüm ({version}) onları açamıyor. Verilerinizi açmak için en son sürümü yükleyin.\n\nYerel verileriniz sıfırlanmadı veya üzerine yazılmadı.",
  "startup.newerDataDownload": "johnBot’u indir",
  "startup.newerDataGuide": "Kılavuzu aç",
  "startup.newerDataQuit": "Çık",
} as const satisfies PartialTranslation<typeof source>;
