# MOO realtime synchronization spec

## Goal

Synchronize guest-visible menu and subscription catalog/config changes from owner cabinet to the guest Telegram Mini App with tenant isolation, monotonic versions, resumable event cursor and safe fallback when a client is offline.

## Architecture options

| Approach | Tradeoffs | Cost | Setup complexity |
|---|---|---:|---:|
| Database sync state + short polling | Works with current Next.js/Prisma deployment; no long-lived connection; near-real-time latency depends on interval | Low | Low |
| Database sync state + SSE endpoint | Lower client latency and fewer requests; long-lived connections are fragile on serverless/Vercel and require connection lifecycle/timeout handling | Medium | Medium |
| External realtime broker (Supabase/Firebase/Ably/Pusher) | Strong push semantics and presence; adds vendor, credentials, operational dependency and cost | Medium–high | High |

**Chosen first implementation:** database sync state plus append-only events and a lightweight version endpoint. It is the safest fit for the current repository and deployment assumptions. The client can poll every 3–5 seconds while visible and immediately refresh on `visibilitychange`. SSE/broker can be added later without changing the event contract.

## Data model

`RestaurantContentSyncState` is one row per restaurant. It owns monotonic `menuVersion`, `subscriptionVersion`, `lastEventId` and timestamps.

`RestaurantContentSyncEvent` is append-only. Each event has restaurant scope, domain (`MENU` or `SUBSCRIPTION`), action (`UPSERT`, `DELETE`, `PUBLISH`, `CONFIG_CHANGED`), version, entity type/id and a compact JSON payload. Guest endpoints do not expose private owner payloads; events are used only for freshness and diagnostics.

## Publish semantics

Every owner write that changes guest-visible menu data publishes one MENU event. This includes categories, dishes, dish options/modifiers and availability. Every owner write that changes guest-visible subscription catalog data publishes one SUBSCRIPTION event. This includes subscription config and plan templates.

Publishing is idempotent at the request level through a generated event ID. The state version increments transactionally with event creation. Existing `updatedAt`-based `/api/menu/version` remains a compatibility fallback, while the new sync state becomes the canonical freshness signal.

## Client contract

`GET /api/sync/state` returns:

```json
{
  "ok": true,
  "restaurantId": "...",
  "menuVersion": 12,
  "subscriptionVersion": 5,
  "lastEventId": "...",
  "serverTime": "..."
}
```

Optional `GET /api/sync/events?after=<eventId>&domains=MENU,SUBSCRIPTION` returns bounded public freshness events. The guest client never trusts a restaurant ID from arbitrary client headers in forced single-tenant mode.

## Consistency rules

A guest compares versions before replacing cache. If the version increased, it refetches the relevant canonical endpoint and replaces the cache atomically. If the event cursor is missing or too old, the client falls back to a full refetch. The UI must show a subtle refreshing state and never render a half-updated menu.

A menu mutation that disables a dish must invalidate existing cart/subscription drafts at read/checkout time; it must not silently mutate an already paid order or an active subscription record. Existing subscription items are snapshots of a customer's choice and should remain stable unless the owner explicitly changes the live plan policy.

## Security

Owner publish helpers accept an already-resolved restaurant context and must be called only after `requireRestaurantAdmin`. Guest sync state is scoped through `getConsumerRestaurantId`. Event payloads contain no customer PII, payment data or private owner fields.

## First implementation slice

1. Add Prisma sync state/event models and migration.
2. Add `publishRestaurantContentChange` helper with transaction and domain-specific version increment.
3. Add `/api/sync/state` and `/api/sync/events` routes.
4. Wire menu dish/category/options mutation routes and subscription config/plans routes.
5. Add automated tests for tenant isolation, monotonic versions, event cursor and failed-write atomicity.
6. Wire guest polling/invalidation after backend contract is green.
