# Sync smoke, owner confirmation and consistency status

## Implemented

- Owner menu mutations now expose `sync.state` and AdminMenuTab shows persistent published confirmation with `menuVersion`.
- Guest menu page shows a non-blocking `Меню обновлено — цены и доступность актуальны` message after realtime invalidation.
- Guest subscriptions page shows a non-blocking refresh message after subscription catalog/config invalidation.
- Order creation now returns HTTP 409 with `code: STALE_CART` and structured `changes` when a dish/variant disappeared, a modifier changed, or client snapshot price differs from trusted DB price.
- Checkout preserves delivery form state and shows changed item names/new prices with a link back to cart.
- Subscription builder drafts store `subscriptionVersion`; drafts older than current catalog version are cleared on resume and the user receives a clear re-build message.

## Quality gate

| Check | Result |
|---|---|
| `npm run type-check` | PASS; 0 TypeScript errors |
| `npm run lint` | PASS; existing non-blocking warnings only |
| `npm run build` | PASS; 46 static pages generated |
| `git diff --check` | PASS |

## Staging smoke status

The smoke matrix could not be executed against a real staging environment in this sandbox: no staging URL, `DATABASE_URL`, `NEXTAUTH_URL`, Telegram auth fixture, owner session/cookie, restaurant fixture ID or deployment environment variables are available. No fake PASS result was recorded.

Required inputs to run the matrix:

- `STAGING_BASE_URL`
- owner authenticated cookie or staging owner auth fixture
- guest Telegram `initData` fixture
- two restaurant IDs for cross-tenant negative tests
- fixture IDs or permission to create disposable categories, dishes, option groups/values, modifiers, store products and variants

## Matrix to run when staging access is supplied

| Area | Operations |
|---|---|
| Food menu | category create/update/delete; dish create/update/delete; option group/value create/update/hide/delete; dish option links replace; modifier replace/create/update/delete |
| Store menu | store category create/update/delete; product create/update/delete; variant create/update/delete with price/stock/isActive |
| Sync | verify `menuVersion` increments, event cursor increases, `/api/sync/events` returns the event and guest state is tenant-scoped |
| Consistency | change dish/variant price, hide item, remove modifier, retry checkout; expect 409 `STALE_CART` and structured diff |
| Subscription draft | save draft, change subscription-visible dish/price, reload builder; expect stale draft warning and no outdated checkout |
| Security | owner and guest attempts against second restaurant must return forbidden/not-found and never expose foreign events |
