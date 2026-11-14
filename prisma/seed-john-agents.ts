/**
 * Initialize one new workspace with the John Deere factory roster and sidebar sectors.
 * Run with `JOHNBOT_FACTORY_SESSION_ID=<session> bun prisma/seed-john-agents.ts`.
 */
import { closeDatabase, getDatabase } from "../src/server/database/client";
import { JOHN_DEERE_AGENTS, johnDeereSidebar } from "../src/server/demo/john-deere";
import { jsonPayload } from "../src/server/repositories/domain-store";

const sessionId = process.env.JOHNBOT_FACTORY_SESSION_ID?.trim();

if (!sessionId) {
  throw new Error("JOHNBOT_FACTORY_SESSION_ID is required; existing workspaces are never overwritten.");
}

const database = getDatabase();
try {
  const result = await database.domainRecord.createMany({
    data: [
      { sessionId, domain: "agents", payload: jsonPayload(JOHN_DEERE_AGENTS), revision: 0 },
      { sessionId, domain: "sidebar", payload: jsonPayload(johnDeereSidebar()), revision: 0 },
    ],
    skipDuplicates: true,
  });
  console.log(`factory workspace ${sessionId}: ${result.count} domain record(s) created; existing records unchanged`);
} finally {
  await closeDatabase();
}
