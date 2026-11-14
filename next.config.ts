import type { NextConfig } from "next";

// The default build is a Next server: it serves the App Router pages and the
// `/api/*` route handlers, including the Redis-backed data layer. Two explicit
// opt-ins keep the other targets working:
//
//   NEXT_STANDALONE=1   Docker runtime (`.next/standalone`, served by `node server.js`).
//   NEXT_STATIC_EXPORT=1 Desktop/static preview (`out/`, served by `bun run preview`).
//
// Building both at once is a configuration mistake: a static export cannot serve
// the route handlers this project now needs.
const standalone = process.env.NEXT_STANDALONE === "1";
const staticExport = process.env.NEXT_STATIC_EXPORT === "1";

if (standalone && staticExport) {
  throw new Error("Set only one of NEXT_STANDALONE=1 and NEXT_STATIC_EXPORT=1.");
}

const nextConfig: NextConfig = {
  devIndicators: false,
  // Keep Docker builds bounded while database and queue workers share the host.
  experimental: { cpus: 2 },
  output: staticExport ? "export" : standalone ? "standalone" : undefined,
  distDir: staticExport ? "out" : ".next",
  productionBrowserSourceMaps: true,
  images: {
    unoptimized: true,
  },
  // Redis is a Node package with optional native bindings; keep it out of the
  // bundler and load it from node_modules at runtime.
  serverExternalPackages: ["redis", "pg", "@prisma/adapter-pg"],
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {
    resolveAlias: {
      "@solidjs/web": "./src/lib/solid-web-compat.ts",
      "solid-js/web": "./src/lib/solid-web-compat.ts",
      "solid-js/store": "./src/lib/solid-store-compat.ts",
      "solid-js": "./src/lib/solid-react-compat.tsx",
      "@kobalte/core/alert-dialog": "./src/lib/kobalte-compat.tsx",
      "@kobalte/core/badge": "./src/lib/kobalte-compat.tsx",
      "@kobalte/core/button": "./src/lib/kobalte-compat.tsx",
      "@kobalte/core/combobox": "./src/lib/kobalte-compat.tsx",
      "@kobalte/core/context-menu": "./src/lib/kobalte-context-menu-compat.tsx",
      "@kobalte/core/dialog": "./src/lib/kobalte-compat.tsx",
      "@kobalte/core/dropdown-menu": "./src/lib/kobalte-dropdown-menu-compat.tsx",
      "@kobalte/core/listbox": "./src/lib/kobalte-compat.tsx",
      "@kobalte/core/polymorphic": "./src/lib/kobalte-compat.tsx",
      "@kobalte/core/popover": "./src/lib/kobalte-popover-compat.tsx",
      "@kobalte/core/progress": "./src/lib/kobalte-compat.tsx",
      "@kobalte/core/radio-group": "./src/lib/kobalte-radio-group-compat.tsx",
      "@kobalte/core/select": "./src/lib/kobalte-select-compat.tsx",
      "@kobalte/core/slider": "./src/lib/kobalte-compat.tsx",
      "@kobalte/core/switch": "./src/lib/kobalte-compat.tsx",
      "@kobalte/core/tabs": "./src/lib/kobalte-tabs-compat.tsx",
      "@kobalte/core/tooltip": "./src/lib/kobalte-tooltip-compat.tsx",
      "@kobalte/core": "./src/lib/kobalte-compat.tsx",
      "@norbert_bodziony/bloub": "./src/lib/bloub-compat.tsx",
      "@johnbot/features": "./src/features",
      "@johnbot/ui": "./src/components",
      "@johnbot/contracts": "./src/contracts",
      "@johnbot/brand": "./src/brand",
      "@johnbot/i18n": "./src/i18n",
      "@johnbot/logging": "./src/logging",
      "@johnbot/team-client": "./src/team-client",
      "@johnbot/telemetry": "./src/telemetry",
      "@johnbot/user-errors": "./src/user-errors",
    },
  },
};

export default nextConfig;
