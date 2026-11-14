# Marketplace data transport

## Coverage

- `marketplaceAgents.list`, `get`, and `getListing` use authenticated JSON routes and Zod response validation.
- `listMine` reads the session-scoped `marketplace` domain. `submit` is an idempotent allowlisted command and writes with `updateDomain` CAS.
- `submit` takes an owned local `agentId`, not a catalog listing ID. The bridge captures the native `marketplaceAgents.preview(agentId)` method and sends its bounded, explicitly typed metadata. The server checks the preview ID and derives pending submission counts from its skills and routines. Newly created local agents work through the same preview signature. Without a preview, only `STORY_AGENT_SUMMARIES` agents are accepted, using `DEMO_OPTIONS.routines` and an empty skill list because no local skill snapshot was supplied.
- Supplied preview metadata is demo input, not proof of external ownership or authorization. Submissions stay pending in the current tenant's demo domain; no external listing or publication is created.
- Catalog list supports bounded search, category, featured, verification, cursor, and limit filters. The Next cache key and tag include the session ID; list data is revalidated after its TTL.
- Query booleans accept only `true` and `false`. `verified=false` selects unverified agents; `featured=false` retains the native all-agents behavior. Cursors must be nonnegative decimal safe integers.
- Catalog/details and initial submissions still use the existing preview fixtures as seed data. No upstream marketplace service is configured, so these routes do not claim external data or publication.
- `agentTemplates.publish/unpublish`, `acpRegistry`, catalog installs, skills, apps, credentials, and executable installation stay local. In particular, publish is not replaced with a fake remote share URL.

## Integration

1. The main-owned `src/lib/api/bridges/create-hybrid.ts` calls `installMarketplaceData(mock)`.
2. The main-owned `src/server/commands/index.ts` merges `MARKETPLACE_DATA_COMMANDS`; `/api/commands/[command]` executes it with the idempotent runner.
3. Rebuild the server, then run `bun tests/integration/domains.ts`. Set `JOHNBOT_TEST_BASE_URL` to use another test server.

`bun tests/integration/marketplace-data.test.ts --local-only` checks fixtures, query validation, and the native preview bridge without HTTP. The full suite submits `chief`, a newly created agent's preview, and the known-agent fallback; it checks replay, payload conflicts, preview mismatch, counts, pagination, verification filters, and isolated cookie jars.

## Method coverage

| Method | Transport |
| --- | --- |
| `marketplaceAgents.list` | HTTP GET, filters/search/pagination |
| `marketplaceAgents.get` | HTTP GET catalog detail |
| `marketplaceAgents.getListing` | HTTP GET listing view |
| `marketplaceAgents.listMine` | HTTP GET tenant submissions |
| `marketplaceAgents.submit` | Idempotent command, tenant JSON write |
| `marketplaceAgents.install` | Local mock/host |
| `agentTemplates.*` | Local mock/host |
| `acpRegistry.*` | Local executable/host |

No credentials or connector state crosses into the marketplace data domain.
