"use client";
import { useEffect } from "react";
import { useStore } from "zustand";
import type { z } from "zod";
import { dataStore } from "../stores/data-store";
import { getData } from "../lib/api/client";
/** Components render the same Zustand value used by the existing runtime bridges. */
export function useDataQuery<T>(path: string, schema: z.ZodType<T>) {
  const entry = useStore(dataStore, (state) => state.entries[path]);
  const invalidated = entry?.invalidated;
  useEffect(() => {
    // getData owns freshness checks; an existing entry may already have exceeded its TTL.
    const controller = new AbortController();
    void getData(path, schema, { signal: controller.signal }).catch(() => undefined);
    return () => controller.abort();
  }, [path, schema, invalidated]);
  const parsed = schema.safeParse(entry?.data);
  return {
    data: parsed.success ? parsed.data : undefined,
    pending: entry?.pending ?? 0,
    error: entry?.error ?? null,
  };
}
