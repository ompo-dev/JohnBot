import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

for (const file of readdirSync(import.meta.dirname)
  .filter((name) => /\.test\.(ts|mjs)$/.test(name))
  .sort()) {
  const path = join(import.meta.dirname, file);
  const runner = /\bdescribe\(/u.test(readFileSync(path, "utf8")) ? ["test", path] : [path];
  const result = spawnSync(process.execPath, runner, {
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
