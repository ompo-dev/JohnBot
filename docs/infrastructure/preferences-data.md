# Session preferences data

The HTTP client now passes through Zustand. Optimistic preference layers notify the native runtime before network confirmation; failures restore confirmed values. Late GETs and old rollbacks cannot overwrite newer edits. See [data flow](jobs-and-data-flow.md).

`/api/preferences` stores user choices per demo session in PostgreSQL through Prisma. Writes use the existing Redis command idempotency flow and the `preferences` domain's conditional revision update.

The hybrid API bridge syncs these JSON preferences:

- Product analytics opt-in (`getAnalyticsPreference`, `setAnalyticsPreference`). The region-specific first-run default remains local (`getAnalyticsDefault`).
- Busy message mode (`getBusyMessageModePreference`, `setBusyMessageModePreference`).
- Agent defaults (`getAgentDefaults`, `setAgentDefaults`). The original setter runs after persistence so the app's agent event is emitted.
- Remote session reuse (`getRemoteSessionReusePreference`, `setRemoteSessionReusePreference`).

The first concurrent preference reads share a bootstrap request. Remote values are applied through the original local setters so mock runtime behavior and events follow server state after reload. Later reads apply changed values; deep equality skips duplicate setter calls, and per-field mutation versions prevent an older in-flight read from replacing a newer local write.

`chosen` remains accepted by the analytics setter to preserve its IPC signature. It is not needed to store the effective value in the demo session.

There is no migration from preferences already stored by the native desktop app into this session store. This slice does not synchronize values into other processes or across separate session cookies; current-window setter calls still invoke the original local setter. A production account-backed store and startup reconciliation are required for cross-device persistence and native runtime coherence.

The following remain local because they describe this computer or its native runtime: launch/background/awake behavior and quit guard; external-link app and browser selection; remote network route; language, appearance, logo color and interface scale; native startup, window and driver choices; permission grants; and local alert, sound, update, and analytics-install settings. Agent memory limit remains controlled by server administration.

The HTTP integration check uses separate cookie jars and covers schema fixtures, invalid input, idempotent replay/conflict, persistence and session isolation. Run it against the running rebuilt Docker server with `bun tests/integration/preferences-data.test.ts` (or set `JOHNBOT_TEST_BASE_URL`).
