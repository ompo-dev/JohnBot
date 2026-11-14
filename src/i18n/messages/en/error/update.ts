import { defineMessages } from "../../../message";

export const messages = defineMessages("error.update", {
  // Updater state the user reads.
  "error.update.unsupported": "Updates are available in installed desktop builds.",
  "error.update.notReady": "An update is not ready to install.",
  "error.update.restartFailed": "johnBot could not restart to install the update.",
  "error.update.downloadStalled": "The update download stopped responding. Try again.",
  "error.update.installFailed": "Could not install the update. Quit and reopen johnBot, then try again.",
  "error.update.downloadFailed": "Could not download the update. Try again.",
  "error.update.checkFailed": "Could not check for updates. Try again.",
  "error.update.checkStalled": "The update check stopped responding. Try again.",
  "error.update.checkOffline": "Could not reach the update service. Check your internet connection, then try again.",
  "error.update.checkUnavailable":
    "The update service did not answer. johnBot tries again on its own in a few minutes.",
  "error.update.checkNoRelease":
    "No published update was found for this platform. johnBot tries again on its own in a few minutes.",
  "error.update.managedByNix": "Nix installs updates for this copy of johnBot. Update it with Nix.",
  "error.update.managedByHost":
    "Updates on this Mac are installed by the host. The update stays ready until the host's maintenance runs.",
  "error.update.siblingSession":
    "Another johnBot session is still running from this application. Stop johnBot in every other macOS user account first, then install the update again.",
  "error.update.siblingSessionSameAccount":
    "Another johnBot process is still running in this user account. Quit it, then install the update again.",
  "error.update.siblingCheckFailed": "Could not verify other johnBot sessions. Try again before installing.",
  "error.update.readOnlyLocation":
    "johnBot cannot install updates from this location. Quit johnBot. In Finder, drag johnBot into the Applications folder (if it is already there, drag it out and back in). Then open johnBot and install the update again.",
  // A joined server's admin reads these from the host.
  "error.update.remoteDisabled": "Updates from server admins are turned off on this computer.",
  "error.update.restartStarted": "johnBot is already restarting to install the update.",
  "error.update.alreadyRestarting": "johnBot is already restarting.",
});
