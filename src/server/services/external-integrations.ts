import type { ExternalIntegrationsStatus } from "../../contracts/external-integrations";
import { serverEnv } from "../config/env";
import { inspectA2AEndpoint } from "../integrations/a2a-client";
import { autoOntologyStatus } from "../integrations/auto-ontology";

/** Discovery is read-only. Creating remote tasks remains disabled until command and worker support exist. */
export async function readExternalIntegrations(): Promise<ExternalIntegrationsStatus> {
  const environment = serverEnv();
  const [a2a, autoOntology] = await Promise.all([
    Promise.all(environment.a2aEndpoints.map(inspectA2AEndpoint)),
    autoOntologyStatus(),
  ]);
  return { a2a, autoOntology };
}
