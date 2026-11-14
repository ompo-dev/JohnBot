import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { serverEnv } from "../config/env";

export const SESSION_COOKIE = "johnbot_session";

const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{16,128}$/u;

export interface Session {
  sessionId: string;
  isNew: boolean;
}

/**
 * Reads the tenant session cookie. A request without a valid cookie gets a new
 * random id; the caller attaches it to the response so the next request reuses
 * the same isolated snapshot.
 */
export async function readSession(): Promise<Session> {
  const store = await cookies();
  const existing = store.get(SESSION_COOKIE)?.value;
  if (existing && SESSION_ID_PATTERN.test(existing)) return { sessionId: existing, isNew: false };
  return { sessionId: crypto.randomUUID(), isNew: true };
}

export function attachSessionCookie(response: NextResponse, session: Session): NextResponse {
  if (!session.isNew) return response;
  response.cookies.set(SESSION_COOKIE, session.sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: serverEnv().cookieSecure,
    path: "/",
    maxAge: serverEnv().sessionTtlSeconds,
  });
  return response;
}
