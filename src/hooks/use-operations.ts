"use client";
import { useCallback, useEffect, useState } from "react";
import { operationsSchema, type OperationsChange } from "../contracts/operations";
import { getData, runCommand } from "../lib/api/client";
import { invalidateQueries } from "../stores/data-store";
import { useDataQuery } from "./use-data-query";

export function useOperations() {
  const query = useDataQuery("/api/operations", operationsSchema);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const reload = () => {
      if (document.visibilityState === "visible")
        void getData("/api/operations", operationsSchema, { force: true }).catch(() => undefined);
    };
    const channel =
      typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("johnbot:operations");
    if (channel)
      channel.onmessage = () => {
        invalidateQueries("/api/operations");
        reload();
      };
    window.addEventListener("focus", reload);
    document.addEventListener("visibilitychange", reload);
    const timer = window.setInterval(reload, 10_000);
    return () => {
      channel?.close();
      window.clearInterval(timer);
      window.removeEventListener("focus", reload);
      document.removeEventListener("visibilitychange", reload);
    };
  }, []);
  const change = useCallback(
    async (change: OperationsChange["change"]) => {
      if (!query.data || saving) return false;
      setSaving(true);
      setError(null);
      try {
        await runCommand(
          "operations.change",
          { expectedRevision: query.data.revision, change },
          operationsSchema,
        );
        const channel =
          typeof BroadcastChannel === "undefined"
            ? null
            : new BroadcastChannel("johnbot:operations");
        channel?.postMessage({ changed: true });
        channel?.close();
        return true;
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : "Falha ao salvar.");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [query.data, saving],
  );
  return { ...query, saving, error: error ?? query.error, change };
}
