// Builds one of the three supported targets without shell-specific env syntax.
// Usage: node scripts/build-mode.mjs server|standalone|static
//
// The static target cannot contain Route Handlers (Next rejects
// `force-dynamic` and POST handlers under `output: "export"`). It also predates
// the server data layer: the desktop/static preview keeps the local mock. The
// static build therefore sets NEXT_PUBLIC_DATA_STACK=local and moves the API
// tree aside for the duration of the build, restoring it in a `finally` block.
import { spawnSync } from "node:child_process";
import { existsSync, renameSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const mode = process.argv[2];
const env = { ...process.env, NEXT_TELEMETRY_DISABLED: "1" };
env.NEXT_DEPLOYMENT_ID = process.env.NEXT_DEPLOYMENT_ID ?? randomUUID();
delete env.NEXT_STANDALONE;
delete env.NEXT_STATIC_EXPORT;
delete env.NEXT_PUBLIC_DATA_STACK;

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const apiDir = join(projectRoot, "src/app/api");
const parkedApiDir = join(projectRoot, ".static-build-api");

function restoreParkedApi() {
  if (!existsSync(parkedApiDir)) return;
  if (existsSync(apiDir)) rmSync(parkedApiDir, { recursive: true, force: true });
  else renameSync(parkedApiDir, apiDir);
}

if (mode === "standalone") env.NEXT_STANDALONE = "1";
else if (mode === "static") {
  env.NEXT_STATIC_EXPORT = "1";
  env.NEXT_PUBLIC_DATA_STACK = "local";
} else if (mode !== "server") {
  console.error("Usage: node scripts/build-mode.mjs server|standalone|static");
  process.exit(1);
}

restoreParkedApi();
if (mode !== "static") {
  const generated = spawnSync(
    process.execPath,
    ["node_modules/prisma/build/index.js", "generate"],
    {
      stdio: "inherit",
      env,
    },
  );
  if (generated.status !== 0) process.exit(generated.status ?? 1);
}
if (mode === "static") renameSync(apiDir, parkedApiDir);

try {
  const result = spawnSync(process.execPath, ["node_modules/next/dist/bin/next", "build"], {
    stdio: "inherit",
    env,
  });
  process.exitCode = result.status ?? 1;
} finally {
  restoreParkedApi();
}
