import { externalIntegrationsStatusSchema } from "../../src/contracts/external-integrations";
import { parseA2AEndpointConfigs } from "../../src/server/config/env";

function expectThrow(callback: () => unknown): void {
  let thrown = false;
  try {
    callback();
  } catch {
    thrown = true;
  }
  if (!thrown) throw new Error("Expected validation to reject input.");
}

const endpoints = parseA2AEndpointConfigs('[{"id":"planner","url":"https://planner.example.com"}]');
if (endpoints.length !== 1 || endpoints[0]?.id !== "planner")
  throw new Error("Valid A2A endpoint was rejected.");

expectThrow(() => parseA2AEndpointConfigs('[{"id":"planner","url":"http://planner.example.com"}]'));
expectThrow(() =>
  parseA2AEndpointConfigs(
    '[{"id":"planner","url":"https://one.example.com"},{"id":"planner","url":"https://two.example.com"}]',
  ),
);
expectThrow(() => parseA2AEndpointConfigs("not-json"));

const result = externalIntegrationsStatusSchema.parse({
  a2a: [
    {
      id: "planner",
      url: "https://planner.example.com",
      status: "ready",
      name: "Planner",
      description: null,
      version: "1.0",
    },
  ],
  autoOntology: { configured: false, status: "disabled" },
});
if ("token" in result.a2a[0]) throw new Error("External integration status leaked a token.");

console.log("PASS: external integrations accept unique HTTPS A2A endpoints and expose no token");
