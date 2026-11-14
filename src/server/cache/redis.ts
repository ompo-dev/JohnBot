import { createClient, type RedisClientType } from "redis";
import { serverEnv } from "../config/env";
import { storageUnavailable } from "../errors";

let client: RedisClientType | undefined;
let connecting: Promise<RedisClientType> | undefined;

async function connect(): Promise<RedisClientType> {
  const next = createClient({
    url: serverEnv().redisUrl,
    socket: {
      connectTimeout: 3_000,
      reconnectStrategy: (retries) => (retries >= 2 ? false : Math.min(200 * 2 ** retries, 1_000)),
    },
  });
  // The client otherwise crashes the process on an error emitted after connect.
  next.on("error", () => undefined);
  try {
    await next.connect();
    await next.ping();
    client = next;
    return next;
  } catch (error) {
    try {
      if (next.isOpen) await next.disconnect();
    } catch {
      // The client is already unusable.
    }
    throw storageUnavailable(error);
  }
}

export async function getRedis(): Promise<RedisClientType> {
  if (client?.isReady) return client;
  if (!connecting) {
    connecting = connect().finally(() => {
      connecting = undefined;
    });
  }
  try {
    return await connecting;
  } catch (error) {
    throw storageUnavailable(error);
  }
}

export async function closeRedis(): Promise<void> {
  const current = client;
  client = undefined;
  if (current?.isOpen) await current.disconnect();
}
