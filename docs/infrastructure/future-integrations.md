# Future integration boundaries

Mocks in `src/preview/mock-johnbot.ts` and demo seeds remain unchanged. There is no live
backend or Redis dependency. Add the first concrete endpoint before introducing client
factories, repositories, cache adapters or infrastructure services.

- Browser: UI state, interaction and public data only. Never ship API secrets or Redis URLs
  through `NEXT_PUBLIC_*`, URLs, local storage or client imports. Keep current mock contracts
  and cancellation behavior while replacing one operation at a time.
- Server: authenticated Route Handlers or Server Actions own credentials and authorization.
  Validate request data and external responses with the already installed Zod. Schema
  failures must become explicit handled errors; never silently substitute production mocks.
- HTTP: Axios is the planned transport for the upcoming integration. Install it with the first
  concrete endpoint, keeping credentials and authenticated upstream calls on the server.
  Configure cancellation/timeouts and map non-2xx errors at that boundary; validate responses
  with the installed Zod before returning application data. Axios does not automatically use
  Next fetch caching. Use native `fetch` specifically where Next fetch cache semantics are
  required, or wrap an Axios operation explicitly with `unstable_cache`, supported by the
  installed Next guide for non-fetch functions. Define keys, freshness and invalidation first;
  never implicitly share authenticated responses across users or tenants.
- Next cache: this app does not enable Cache Components. The installed Next 16.4.5 guide
  `node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md` says
  fetch is not cached by default. Opt in per operation only after defining freshness and
  mutation invalidation. Keep authenticated responses uncached unless keys include the
  tenant/user and every authorization-relevant input. Never cache secrets or failures.
- Redis: add only when a measured need requires a shared cache, distributed coordination
  or rate limits. Keep it server-only. Define key namespace, tenant isolation, TTL, payload
  version, eviction and outage behavior. Redis is distinct from Next request memoization,
  persistent fetch caches and the client router cache; a Redis write invalidates none of them.

Before replacing mocks, test authorization/tenant separation, invalid Zod input and upstream
responses, cancellation, non-2xx responses, timeout, mutation invalidation and Redis outages
when applicable. Current DOM tests already cover stale canceled responses and URL credential
exclusion; keep those assertions. No unused Axios/Zod wrapper or Redis container was added.

Local guides consulted: Next config `output.md`, caching introduction, and the guide above.
Static export remains the local build; standalone server output is selected only for Docker.
A real server integration must review that export boundary before adding server-only APIs.