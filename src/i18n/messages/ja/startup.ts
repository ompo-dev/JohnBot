import type { PartialTranslation } from "../../message";
import type { messages as source } from "../en/startup";

export const messages = {
  "startup.failedTitle": "johnBot を起動できませんでした",
  "startup.failedBody":
    "{message}\n\nお使いのデータは初期化も上書きもされていません。復旧の手順はトラブルシューティングガイドをご覧ください。",
  "startup.archiveChangedTitle": "johnBot のファイルが変更されました",
  "startup.archiveChangedBody":
    "別のプログラムが johnBot のファイル app.asar を変更しました。johnBot は今は動作していますが、終了すると次は起動しません。\n\n修復するには、johnBot をもう一度インストールしてください。ローカルのデータはそのまま残ります。",
  "startup.archiveChangedDownload": "johnBot をダウンロード",
  "startup.newerDataUpdatingTitle": "johnBot を更新しています",
  "startup.newerDataUpdatingBody":
    "新しいバージョンの johnBot がデータを保存しました。johnBot は最新バージョンをインストールしてから、もう一度開きます。\n\nローカルデータはリセットも上書きもされていません。",
  "startup.newerDataTitle": "最新の johnBot をインストールしてください",
  "startup.newerDataBody":
    "新しいバージョンの johnBot がデータを保存したため、このバージョン ({version}) では開けません。データを開くには最新バージョンをインストールしてください。\n\nローカルデータはリセットも上書きもされていません。",
  "startup.newerDataDownload": "johnBot をダウンロード",
  "startup.newerDataGuide": "ガイドを開く",
  "startup.newerDataQuit": "終了",
} as const satisfies PartialTranslation<typeof source>;
