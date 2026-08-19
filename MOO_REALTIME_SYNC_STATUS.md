# MOO realtime menu/subscription sync — implementation status

## Implemented

- Added `RestaurantContentSyncState` with monotonic `menuVersion` and `subscriptionVersion` per restaurant.
- Added append-only `RestaurantContentSyncEvent` journal with domain, action, version, entity metadata and cursor ID.
- Added Prisma migration `20260819070000_add_content_sync/migration.sql`.
- Added `src/lib/content-sync.ts` with transaction-safe publish, state read and bounded cursor event listing.
- Added guest endpoints:
  - `GET /api/sync/state`
  - `GET /api/sync/events?after=...&domain=MENU&domain=SUBSCRIPTION`
- Wired `MENU` events to dish and category create/update/delete operations.
- Wired `SUBSCRIPTION` events to subscription config and plan create/update/delete operations.
- Added `useContentSync` guest hook with visible-tab polling, visibility refresh, in-flight protection and domain callbacks.
- Connected menu and subscriptions guest pages to automatic invalidation and canonical refetch.

## Consistency model

Owner writes complete first; only successful writes publish an event. Publishing increments exactly one domain version and writes the event cursor in a transaction. Guest clients compare versions and refetch the canonical endpoint; they do not apply partial event payloads to the UI. Existing `updatedAt` menu versioning remains a fallback while the new sync state is introduced.

## Quality gate

| Check | Result |
|---|---|
| `prisma generate` | PASS |
| `prisma format` | PASS |
| `npm run type-check` | PASS; 0 TypeScript errors |
| `npm run lint` | PASS; existing warnings only |
| `npm run build` | PASS; Next.js compiled and generated pages |
| `git diff --check` | PASS |

## Staging verification still required

The sandbox does not contain the deployment `DATABASE_URL`, so the new migration has not been applied to a live database here. Before pilot use, apply the migration in staging and run a smoke test that creates/updates/deletes a dish, category, subscription config and plan, then verifies versions increase monotonically and guest endpoints return the new cursor. Also run negative tests for cross-tenant access and failed owner writes.

## Next slice

Cover menu option groups, option values, dish modifiers and store products with the same publisher. Add staging-backed integration tests and, if sub-second push is required after pilot validation, place SSE or an external realtime broker behind the same state/event contract rather than changing guest data semantics.
