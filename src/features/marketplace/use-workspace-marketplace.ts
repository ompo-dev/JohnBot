import { useMemo, useRef } from "react";
import { useOperations } from "../../hooks/use-operations";
import { canAccess } from "../../lib/operations-model";
import type { Operations } from "../../contracts/operations";
import type { MarketplaceApp, MarketplaceModel } from "./marketplace-model";

/** Preserve native connector controllers; add the authorized factory catalog to the same store. */
export function mergeWorkspaceApps(apps: readonly MarketplaceApp[], connectors: Operations["connectors"]): MarketplaceApp[] {
  const ids = new Set(apps.map((app) => app.id));
  return [...apps, ...connectors.filter((connector) => !ids.has(connector.id)).map((connector): MarketplaceApp => ({
    kind:"workspace", id:connector.id, name:connector.name, tagline:connector.detail,
    category:connector.family === "data" ? "data-analytics" : connector.family === "tools" ? "coding" : "automation",
    status:connector.installed ? "connected" : "idle", connector,
  }))];
}

export function useWorkspaceMarketplaceModel(model: MarketplaceModel): MarketplaceModel {
  const operations = useOperations();
  const current = useRef({model,operations});
  current.current = {model,operations};
  return useMemo(() => new Proxy({} as MarketplaceModel, {
    get(_target, key) {
      if (key === "apps") return () => mergeWorkspaceApps(current.current.model.apps(), current.current.operations.data?.connectors ?? []);
      if (key === "workspaceInstallation") return {
        saving: current.current.operations.saving,
        error: current.current.operations.error,
        canInstall: Boolean(current.current.operations.data && canAccess(current.current.operations.data, current.current.operations.data.viewerId, "admin", "organization:settings")),
        viewerId: current.current.operations.data?.viewerId ?? "",
        revision: current.current.operations.data?.revision ?? 0,
        set: (connectorId: string, installed: boolean) => current.current.operations.change({type:"connector-installation",connectorId,installed}),
      };
      return Reflect.get(current.current.model, key);
    },
  }), []);
}
