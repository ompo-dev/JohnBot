import { Transpiler } from "bun";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, posix } from "node:path";

const rendererRoots = [
  "src/hooks/",
  "src/stores/",
  "src/lib/api/",
  "src/components/",
  "src/features/",
  "src/templates/",
  "src/middlewares/",
  "src/providers/",
  "src/preview/",
];
const fixtures = new Set(["src/preview/fixtures.ts", "src/preview/demo-seed.ts"]);
const browserPackage = /^(react|react-dom|solid-js|nuqs)(\/|$)/;
const serverPackage = /^(pg|redis|ioredis|bullmq|@prisma\/|node:|next\/(server|headers|cache))/;
export const isCore = (file) =>
  /^(src\/(server|workers|stores|lib\/api)\/|src\/hooks\/use-data-query\.ts$)/.test(file);
export function dependencyViolation(source, target, specifier) {
  const renderer =
    rendererRoots.some((prefix) => source.startsWith(prefix)) || source === "src/app/ClientApp.tsx";
  if (target?.startsWith("src/workers/") && target.endsWith(".worker.ts"))
    return "execute worker entrypoints as processes; import job modules instead";
  if (target && /^(tests|scripts)\//.test(target))
    return "production code cannot import tests or CLI scripts";
  if (renderer && target && /^src\/(server|workers)\//.test(target))
    return "browser code cannot import server or worker modules";
  if (/^src\/server\/(services|repositories)\//.test(source) && /^next(\/|$)/.test(specifier))
    return "domain services and repositories cannot load Next request/cache APIs";
  if (source.startsWith("src/server/cache/") && target?.startsWith("src/server/commands/"))
    return "cache readers cannot depend on command execution";
  if (/^src\/(stores|lib\/api)\//.test(source) && serverPackage.test(specifier))
    return "browser data layer cannot load server packages";
  if (
    source.startsWith("src/stores/") &&
    ((target &&
      /^(src\/(hooks|lib\/api|app|features|components|preview|workers|server)\/)/.test(target)) ||
      browserPackage.test(specifier))
  )
    return "stores cannot depend on transport, UI or React hooks";
  if (
    source.startsWith("src/server/") &&
    ((target &&
      rendererRoots.some((prefix) => target.startsWith(prefix)) &&
      !fixtures.has(target)) ||
      browserPackage.test(specifier))
  )
    return "server modules cannot load the renderer or mock runtime";
  if (
    fixtures.has(source) &&
    ((target &&
      rendererRoots.some((prefix) => target.startsWith(prefix)) &&
      !fixtures.has(target)) ||
      browserPackage.test(specifier))
  )
    return "server-compatible fixtures must remain pure data";
  if (
    /^src\/(workers|server\/jobs)\//.test(source) &&
    (/^next(\/|$)/.test(specifier) ||
      (target &&
        (rendererRoots.some((prefix) => target.startsWith(prefix)) ||
          target.startsWith("src/server/http/"))))
  )
    return "workers and jobs cannot depend on the renderer or Next request context";
  return null;
}
export function findCycle(graph) {
  const complete = new Set(),
    active = new Set(),
    stack = [];
  function visit(file) {
    if (active.has(file)) return [...stack.slice(stack.indexOf(file)), file];
    if (complete.has(file)) return null;
    active.add(file);
    stack.push(file);
    for (const next of graph.get(file) ?? []) {
      const cycle = visit(next);
      if (cycle) return cycle;
    }
    stack.pop();
    active.delete(file);
    complete.add(file);
    return null;
  }
  for (const file of graph.keys()) {
    const cycle = visit(file);
    if (cycle) return cycle;
  }
  return null;
}
function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return entry.name === "generated" ? [] : walk(file);
    return /\.(ts|tsx)$/.test(file) && !file.endsWith(".d.ts") ? [file] : [];
  });
}
function main() {
  const paths = JSON.parse(readFileSync("tsconfig.json", "utf8")).compilerOptions.paths;
  const violations = [],
    graph = new Map(),
    workers = [],
    importsByFile = new Map();
  const files = walk("src");
  function resolve(source, specifier) {
    let base;
    if (specifier.startsWith("."))
      base = posix.normalize(posix.join(posix.dirname(source), specifier));
    else {
      const alias = Object.keys(paths)
        .sort((a, b) => b.length - a.length)
        .find((key) =>
          key.endsWith("/*") ? specifier.startsWith(key.slice(0, -1)) : key === specifier,
        );
      if (!alias) return null;
      const template = paths[alias][0];
      base = template
        .replace("*", alias.endsWith("/*") ? specifier.slice(alias.length - 1) : "")
        .replace(/^\.\//, "");
    }
    return (
      [
        base,
        ...[".ts", ".tsx", ".js", ".json", "/index.ts", "/index.tsx"].map(
          (suffix) => base + suffix,
        ),
      ].find((file) => existsSync(file) && extname(file)) ?? null
    );
  }
  for (const file of files) {
    const body = readFileSync(file, "utf8");
    const imports = new Transpiler({ loader: file.endsWith(".tsx") ? "tsx" : "ts" }).scanImports(
      body,
    );
    const edges = [];
    for (const item of imports) {
      const target = resolve(file, item.path);
      if (isCore(file) && item.path.startsWith(".") && !target)
        violations.push(`${file}: unresolved import ${item.path}`);
      const violation = dependencyViolation(file, target, item.path);
      if (violation) violations.push(`${file} -> ${item.path}: ${violation}`);
      if (target) edges.push(target);
    }
    importsByFile.set(file, imports);
    graph.set(file, edges);
    if (file.startsWith("src/workers/")) workers.push(file);
  }
  // Inspect the complete dependency tree of entrypoints, not only direct imports.
  for (const entry of workers) {
    const pending = [entry],
      visited = new Set();
    while (pending.length) {
      const file = pending.pop();
      if (visited.has(file)) continue;
      visited.add(file);
      for (const item of importsByFile.get(file) ?? [])
        if (/^next(\/|$)/.test(item.path) || browserPackage.test(item.path))
          violations.push(`${entry} reaches ${item.path} through ${file}`);
      pending.push(...(graph.get(file) ?? []));
    }
  }
  const core = new Map(
    [...graph]
      .filter(([file]) => isCore(file))
      .map(([file, edges]) => [file, edges.filter(isCore)]),
  );
  const cycle = findCycle(core);
  if (cycle) violations.push(`Data-layer import cycle: ${cycle.join(" -> ")}`);
  if (violations.length) {
    for (const violation of violations) console.error(violation);
    process.exitCode = 1;
  } else
    console.log(
      `PASS architecture: ${files.length} modules; browser/server/store/worker boundaries and core import cycles checked.`,
    );
}
if (import.meta.main) main();
