import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import { serverEnv } from "../config/env";
import { storageUnavailable } from "../errors";

const globals = globalThis as typeof globalThis & { johnbotDatabase?: PrismaClient };

export function getDatabase(): PrismaClient {
  if (!globals.johnbotDatabase) {
    const connectionString = serverEnv().databaseUrl;
    if (!connectionString) throw storageUnavailable();
    const adapter = new PrismaPg({
      connectionString,
      max: 10,
      connectionTimeoutMillis: 3000,
      idleTimeoutMillis: 10000,
      statement_timeout: 10000,
    });
    globals.johnbotDatabase = new PrismaClient({ adapter });
  }
  return globals.johnbotDatabase;
}

export async function closeDatabase(): Promise<void> {
  const database = globals.johnbotDatabase;
  delete globals.johnbotDatabase;
  await database?.$disconnect();
}
