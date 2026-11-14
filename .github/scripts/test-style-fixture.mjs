import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const temp = mkdtempSync(join(tmpdir(), "johnbot-styles-"));
try {
  for (const directory of ["scripts", "src/styles", ".github/fixtures"])
    mkdirSync(join(temp, directory), { recursive: true });
  for (const file of [
    "scripts/check-original-styles.mjs",
    "src/styles/legacy.css",
    ".github/fixtures/styles-baseline.css.gz",
  ])
    cpSync(join(root, file), join(temp, file));
  symlinkSync(
    join(root, "node_modules"),
    join(temp, "node_modules"),
    process.platform === "win32" ? "junction" : "dir",
  );
  const file = join(temp, "src/styles/legacy.css");
  const css = readFileSync(file, "utf8");
  const changed = css.replace(/box-sizing:\s*border-box;/, "");
  assert.notEqual(changed, css);
  writeFileSync(file, changed);
  const result = spawnSync(process.execPath, [join(temp, "scripts/check-original-styles.mjs")], {
    encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Original declarations missing or changed/);
  console.log(
    "Style fixture rejects removed declarations without an external reference repository.",
  );
} finally {
  rmSync(temp, { recursive: true, force: true });
}
