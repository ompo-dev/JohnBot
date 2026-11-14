import { loadEnvConfig } from "@next/env";
import { closeDatabase } from "../../src/server/database/client";
import { closeRedis } from "../../src/server/cache/redis";
import { importRedisRecords } from "../../src/server/repositories/redis-import";

loadEnvConfig(process.cwd());
try {
  const result = await importRedisRecords();
  console.log(
    `Redis import: ${result.imported} created, ${result.skipped} existing rows preserved.`,
  );
} finally {
  await Promise.all([closeDatabase(), closeRedis()]);
}
