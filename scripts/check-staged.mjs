import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";

const supported = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".json", ".jsonc"]);
function git(args) {
  const result = spawnSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr || "git failed");
  return result.stdout;
}
const files = git(["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"])
  .split("\0")
  .filter((file) => supported.has(extname(file).toLowerCase()));
const snapshot = mkdtempSync(join(tmpdir(), "johnbot-index-"));
let status = 0;
try {
  copyFileSync("biome.jsonc", join(snapshot, "biome.jsonc"));
  for (const file of files) {
    // Validate index content; never fix or restage partially staged user files.
    const target = join(snapshot, file);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, git(["show", `:${file}`]));
  }
  if (files.length) {
    const result = spawnSync(
      process.execPath,
      [resolve("node_modules/@biomejs/biome/bin/biome"), "lint", "--vcs-enabled=false", ...files],
      {
        cwd: snapshot,
        stdio: "inherit",
      },
    );
    status = result.status ?? 1;
  }
  console.log(`Husky: checked ${files.length} staged file(s).`);
} finally {
  rmSync(snapshot, { recursive: true, force: true });
}
process.exit(status);
