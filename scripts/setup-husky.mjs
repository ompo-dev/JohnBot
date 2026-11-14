import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const gitAvailable = spawnSync("git", ["--version"], { stdio: "ignore" }).status === 0;
const gitDirectory = gitAvailable
  ? spawnSync("git", ["rev-parse", "--git-dir"], { stdio: "ignore" }).status === 0
  : false;

if (!gitAvailable || !gitDirectory) {
  console.log("Husky: Git is unavailable here; skipping hook installation.");
  process.exit(0);
}

const result = spawnSync(process.execPath, [resolve("node_modules/husky/bin.js")], {
  stdio: "inherit",
});
process.exit(result.status ?? 1);
