import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const temp = mkdtempSync(join(tmpdir(), "johnbot-hook-"));
function run(args, expected = 0) {
  const result = spawnSync("git", args, { cwd: temp, encoding: "utf8" });
  assert.equal(result.status, expected, result.stdout + result.stderr);
  return result;
}
try {
  run(["init"]);
  run(["config", "user.name", "Hook Test"]);
  run(["config", "user.email", "hook@example.invalid"]);
  mkdirSync(join(temp, "scripts"));
  cpSync(join(root, "scripts/check-staged.mjs"), join(temp, "scripts/check-staged.mjs"));
  cpSync(join(root, "biome.jsonc"), join(temp, "biome.jsonc"));
  cpSync(join(root, ".husky"), join(temp, ".husky"), { recursive: true });
  symlinkSync(
    join(root, "node_modules"),
    join(temp, "node_modules"),
    process.platform === "win32" ? "junction" : "dir",
  );
  const setup = spawnSync(process.execPath, [join(root, "scripts/setup-husky.mjs")], {
    cwd: temp,
    encoding: "utf8",
  });
  assert.equal(setup.status, 0, setup.stderr);
  const probe = join(temp, "scripts/probe.js");
  const bad = "const value = ;\n";
  const good = "console.log('valid');\n";
  writeFileSync(probe, bad);
  run(["add", "scripts/probe.js"]);
  writeFileSync(probe, good);
  const rejected = run(["commit", "-m", "must reject staged syntax error"], 1);
  assert.match(rejected.stdout + rejected.stderr, /pre-commit script failed/i);
  assert.equal(readFileSync(probe, "utf8"), good);
  run(["add", "scripts/probe.js"]);
  writeFileSync(probe, bad);
  run(["commit", "-m", "accept clean index with dirty working tree"]);
  assert.equal(readFileSync(probe, "utf8"), bad);
  assert.equal(run(["show", "HEAD:scripts/probe.js"]).stdout, good);
  const noGit = mkdtempSync(join(tmpdir(), "johnbot-no-git-"));
  try {
    const skipped = spawnSync(process.execPath, [join(root, "scripts/setup-husky.mjs")], {
      cwd: noGit,
      encoding: "utf8",
    });
    assert.equal(skipped.status, 0, skipped.stderr);
    assert.match(skipped.stdout, /skipping hook installation/);
  } finally {
    rmSync(noGit, { recursive: true, force: true });
  }
  console.log("Hook rejection, clean commit, partial-stage preservation and no-Git setup passed.");
} finally {
  rmSync(temp, { recursive: true, force: true });
}
