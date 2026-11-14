import type { PartialTranslation } from "../../message";
import type { messages as source } from "../en/messaging";

export const messages = {
  "messaging.help.invalid_token":
    "Slack はこのワークスペースで johnBot を受け付けなくなりました。アンインストールされた可能性があります。ワークスペースをもう一度接続してください。",
  "messaging.help.secret_storage_unavailable":
    "johnBot はこのコンピューターに保存されたトークンを読み取れません。ワークスペースの接続を解除してから、もう一度接続してください。",
  "messaging.help.relay_unavailable":
    "johnBot はこのコンピューターで Slack のイベントを受信できません。サインインし、サーバー設定でこのコンピューターに名前を付けて、johnBot を開いたままにしてください。",
  "messaging.discordHelp.invalid_token":
    "Discord はこの Discord サーバーで johnBot を受け付けなくなりました。削除された可能性があります。Discord サーバーをもう一度接続してください。",
  "messaging.discordHelp.secret_storage_unavailable":
    "johnBot はこのコンピューターに保存されたトークンを読み取れません。Discord サーバーの接続を解除してから、もう一度接続してください。",
  "messaging.discordHelp.relay_unavailable":
    "johnBot はこのコンピューターで Discord のイベントを受信できません。サインインし、サーバー設定でこのコンピューターに名前を付けて、johnBot を開いたままにしてください。",
} as const satisfies PartialTranslation<typeof source>;
