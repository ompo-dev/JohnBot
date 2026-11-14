import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
const external = process.env.JOHNBOT_TEST_BASE_URL;
const port = 3211;
const base = external ?? `http://127.0.0.1:${port}`;
let server: ChildProcess | undefined;
try {
  if (!external)
    server = spawn(
      process.execPath,
      ["node_modules/next/dist/bin/next", "start", "-p", String(port)],
      { stdio: "inherit", env: { ...process.env, NODE_ENV: "production" } },
    );
  const deadline = Date.now() + 90_000;
  for (;;) {
    try {
      const response = await fetch(`${base}/api/app-info`, { signal: AbortSignal.timeout(3000) });
      if (response.ok) break;
    } catch {
      /* Wait for this test server. */
    }
    if (Date.now() > deadline || server?.exitCode != null)
      throw new Error(`Test server unavailable: ${base}`);
    await delay(250);
  }
  for (const suite of ["agents", "workflows", "marketplace", "preferences", "jobs"]) {
    await new Promise<void>((resolve, reject) => {
      const test = spawn(process.execPath, [`tests/integration/${suite}-data.test.ts`], {
        stdio: "inherit",
        env: { ...process.env, JOHNBOT_TEST_BASE_URL: base },
      });
      const timeout = setTimeout(() => {
        test.kill();
        reject(new Error(`${suite} timed out`));
      }, 120_000);
      test.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      test.on("exit", (code) => {
        clearTimeout(timeout);
        code === 0 ? resolve() : reject(new Error(`${suite} exited ${code}`));
      });
    });
  }
} finally {
  server?.kill();
}
