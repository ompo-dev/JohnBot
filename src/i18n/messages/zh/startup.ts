import type { PartialTranslation } from "../../message";
import type { messages as source } from "../en/startup";

export const messages = {
  // The one native error box: the app could not start, so no renderer exists to show it.
  "startup.failedTitle": "johnBot 无法启动",
  "startup.failedBody": "{message}\n\n你的本地数据没有被重置或覆盖。请查看故障排查指南了解恢复步骤。",
  "startup.archiveChangedTitle": "johnBot 文件已被更改",
  "startup.archiveChangedBody":
    "另一个程序更改了 johnBot 的文件 app.asar。johnBot 现在仍在运行，但退出后将无法再次打开。\n\n要修复 johnBot，请重新安装。你的本地数据会保留。",
  "startup.archiveChangedDownload": "下载 johnBot",
  "startup.newerDataUpdatingTitle": "正在更新 johnBot",
  "startup.newerDataUpdatingBody":
    "较新版本的 johnBot 保存了你的数据。johnBot 将安装最新版本，然后重新打开。\n\n你的本地数据未被重置或覆盖。",
  "startup.newerDataTitle": "请安装最新版 johnBot",
  "startup.newerDataBody":
    "较新版本的 johnBot 保存了你的数据，此版本（{version}）无法打开这些数据。请安装最新版本以打开你的数据。\n\n你的本地数据未被重置或覆盖。",
  "startup.newerDataDownload": "下载 johnBot",
  "startup.newerDataGuide": "打开指南",
  "startup.newerDataQuit": "退出",
} as const satisfies PartialTranslation<typeof source>;
