import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const roots = ["src", "scripts", "tests", "stories", "tools"];
const extensions = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".json", ".jsonc"]);
let fileCount = 0;

function countFiles(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && entry.name !== ".next" && entry.name !== "out") {
        countFiles(path);
      }
    } else if (extensions.has(entry.name.slice(entry.name.lastIndexOf(".")))) {
      fileCount += 1;
    }
  }
}

for (const root of roots) countFiles(root);

if (fileCount === 0) {
  console.error("Biome lint scope is empty; refusing to pass silently.");
  process.exit(1);
}

console.log(`Biome lint scope: ${fileCount} files across ${roots.join(", ")}`);
const result = spawnSync(
  process.execPath,
  ["node_modules/@biomejs/biome/bin/biome", "lint", ...roots, ...process.argv.slice(2)],
  { stdio: "inherit" },
);
process.exit(result.status ?? 1);
