import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const root = JSON.parse(readFileSync("package.json", "utf8"));
const worker = JSON.parse(readFileSync("infra/worker/package.json", "utf8"));
for (const [name, version] of Object.entries({
  ...worker.dependencies,
  ...worker.devDependencies,
})) {
  let expected = root.dependencies[name] ?? root.devDependencies[name];
  if (expected === "catalog:") expected = root.workspaces.catalog[name];
  assert.equal(version, expected, `Worker dependency drift: ${name}`);
}
console.log("PASS: worker dependencies match the application's pinned versions");
