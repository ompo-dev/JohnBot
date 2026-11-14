import { serve } from "bun";
import { join } from "path";
import { existsSync, statSync } from "fs";

const PORT = Number(process.env.PORT ?? 3000);
const root = join(import.meta.dir, "../out");

serve({
  port: PORT,
  fetch(req) {
    const url = new URL(req.url);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === "/") pathname = "/index.html";
    let filePath = join(root, pathname);
    if (existsSync(filePath) && statSync(filePath).isDirectory()) {
      filePath = join(filePath, "index.html");
    }
    if (!existsSync(filePath)) {
      filePath = join(root, "index.html");
    }
    return new Response(Bun.file(filePath));
  },
});

console.log(`[production] JohnBot running at http://localhost:${PORT}`);
