import assert from "node:assert/strict";
import { dependencyViolation, findCycle } from "../../scripts/check-architecture.mjs";
assert.ok(
  dependencyViolation(
    "src/lib/api/client.ts",
    "src/server/database/client.ts",
    "../../server/database/client",
  ),
);
assert.ok(
  dependencyViolation(
    "src/stores/data-store.ts",
    "src/hooks/use-data-query.ts",
    "../hooks/use-data-query",
  ),
);
assert.ok(dependencyViolation("src/server/jobs/processor.ts", null, "next/cache"));
assert.ok(dependencyViolation("src/server/services/agents.ts", null, "next/cache"));
assert.ok(dependencyViolation("src/server/cache/workflows.ts", "src/server/commands/workflows.ts", "../commands/workflows"));
assert.ok(
  dependencyViolation(
    "src/server/jobs/processor.ts",
    "src/workers/background.worker.ts",
    "../../workers/background.worker",
  ),
);
assert.ok(
  dependencyViolation(
    "src/server/services/agents.ts",
    "src/preview/mock-johnbot.ts",
    "../../preview/mock-johnbot",
  ),
);
assert.equal(
  dependencyViolation(
    "src/server/services/agents.ts",
    "src/preview/demo-seed.ts",
    "../../preview/demo-seed",
  ),
  null,
);
assert.equal(
  dependencyViolation(
    "src/workers/background.worker.ts",
    "src/server/jobs/processor.ts",
    "../server/jobs/processor",
  ),
  null,
);
assert.deepEqual(
  findCycle(
    new Map([
      ["a", ["b"]],
      ["b", ["a"]],
    ]),
  ),
  ["a", "b", "a"],
);
assert.equal(
  findCycle(
    new Map([
      ["a", ["b"]],
      ["b", []],
    ]),
  ),
  null,
);
console.log(
  "PASS: architecture rules reject illegal dependencies and cycles while accepting intended layers",
);
