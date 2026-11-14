# Workflows data bridge

Creation accepts a stable client-generated ID for optimistic list/detail state. Graph save conflicts roll back the optimistic layer. Reads use SQL revision keys for Redis/Next consistency across replicas; the existing local simulator remains unchanged. See [jobs and data flow](jobs-and-data-flow.md).

The tenant scoped `workflows-v1` domain stores an exact server ID beside each server's workflow summaries, validated graphs, revisions, and up to 50 graph versions. It seeds each tenant/server from `DEMO_OPTIONS.workflows`. The cache key and invalidation tag include both the session and exact server ID. Missing server IDs default to `local`; supplied IDs are validated and never normalized.

## Integration required in shared files

`installWorkflowsData` and `WORKFLOWS_DATA_COMMANDS` are wired in the shared bridge and command map.

## Coverage

Implemented: workflow list/get/create/rename/delete/save graph, revision conflict response, periodic auto-version snapshots, versions list, and version graph reads. Graph structure uses the existing `isWorkflowGraph` validator; command inputs are strict Zod contracts. Mutations emit `workflows-changed` through the mock controls for existing UI subscribers.

Runs, step execution, decisions, webhooks, GitHub and chat integrations use a per-server local mock runner. The bridge synchronizes its workflow snapshots from persisted server data before each runtime operation, so creates, graph saves, renames and deletes are reflected. Run histories, webhook state and third party execution are still in-memory mock behavior; there is no real runner or provider connection. Mock controls can emit workflow events only for `local`, so background completion events from a non-local server runner do not reach that server's subscribers yet. Agent tasks are not part of this bridge.

The `workflows-v1` aggregate now persists in PostgreSQL through Prisma. The upgrade imports previous Redis records without overwriting existing SQL data; an empty tenant/server starts from the demo workflow fixtures. See [PostgreSQL migration](postgres-prisma.md).

## Check

Run `bun tests/integration/workflows-data.test.ts` with the rebuilt Next server available at `JOHNBOT_TEST_BASE_URL` (default `http://127.0.0.1:3000`). The HTTP suite checks demo seeding, two tenants × two server IDs, CRUD, revision conflicts and version reads. It owns separate cookie jars for tenants.
