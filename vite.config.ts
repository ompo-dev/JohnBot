import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import solidPlugin from "@solidjs/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [solidPlugin(), tailwindcss({ optimize: false })],
  optimizeDeps: {
    include: ["@norbert_bodziony/bloub"],
  },
  resolve: {
    dedupe: ["solid-js", "@solidjs/web"],
    alias: [
      { find: /^@johnbot\/features\/(.*)/, replacement: path.resolve(__dirname, "src/features/$1") },
      { find: "@johnbot/features", replacement: path.resolve(__dirname, "src/features") },
      { find: /^@johnbot\/ui\/features\/(.*)/, replacement: path.resolve(__dirname, "src/features/$1") },
      { find: /^@johnbot\/ui\/(.*)/, replacement: path.resolve(__dirname, "src/components/$1") },
      { find: "@johnbot/ui", replacement: path.resolve(__dirname, "src/components") },
      { find: /^@johnbot\/contracts\/(.*)/, replacement: path.resolve(__dirname, "src/contracts/$1") },
      { find: "@johnbot/contracts", replacement: path.resolve(__dirname, "src/contracts") },
      { find: /^@johnbot\/brand\/(.*)/, replacement: path.resolve(__dirname, "src/brand/$1") },
      { find: "@johnbot/brand", replacement: path.resolve(__dirname, "src/brand") },
      { find: /^@johnbot\/i18n\/(.*)/, replacement: path.resolve(__dirname, "src/i18n/$1") },
      { find: "@johnbot/i18n", replacement: path.resolve(__dirname, "src/i18n") },
      { find: /^@johnbot\/logging\/(.*)/, replacement: path.resolve(__dirname, "src/logging/$1") },
      { find: "@johnbot/logging", replacement: path.resolve(__dirname, "src/logging") },
      { find: /^@johnbot\/team-client\/(.*)/, replacement: path.resolve(__dirname, "src/team-client/$1") },
      { find: "@johnbot/team-client", replacement: path.resolve(__dirname, "src/team-client") },
      { find: /^@johnbot\/telemetry\/(.*)/, replacement: path.resolve(__dirname, "src/telemetry/$1") },
      { find: "@johnbot/telemetry", replacement: path.resolve(__dirname, "src/telemetry") },
      { find: /^@johnbot\/user-errors\/(.*)/, replacement: path.resolve(__dirname, "src/user-errors/$1") },
      { find: "@johnbot/user-errors", replacement: path.resolve(__dirname, "src/user-errors") },
    ],
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    target: "es2022",
  },
});
