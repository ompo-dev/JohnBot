import { defineMessages } from "../../message";

export const messages = defineMessages("startup", {
  // The one native error box: the app could not start, so no renderer exists to show it.
  "startup.failedTitle": "johnBot couldn’t start",
  "startup.failedBody":
    "{message}\n\nYour local data was not reset or overwritten. See the troubleshooting guide for recovery steps.",
  // Shown while johnBot runs, when another program changed `app.asar`: the next start would fail with no message.
  "startup.archiveChangedTitle": "johnBot files were changed",
  "startup.archiveChangedBody":
    "Another program changed the johnBot file app.asar. johnBot runs now, but it will not open after you quit it.\n\nTo repair johnBot, install it again. Your local data stays.",
  "startup.archiveChangedDownload": "Download johnBot",
  // An older johnBot started over data that a newer one migrated: it installs the latest release.
  "startup.newerDataUpdatingTitle": "Updating johnBot",
  "startup.newerDataUpdatingBody":
    "A newer version of johnBot saved your data. johnBot installs the latest version and then opens again.\n\nYour local data was not reset or overwritten.",
  "startup.newerDataTitle": "Install the latest johnBot",
  "startup.newerDataBody":
    "A newer version of johnBot saved your data, and this version ({version}) cannot open it. Install the latest version to open your data.\n\nYour local data was not reset or overwritten.",
  "startup.newerDataDownload": "Download johnBot",
  "startup.newerDataGuide": "Open guide",
  "startup.newerDataQuit": "Quit",
});
