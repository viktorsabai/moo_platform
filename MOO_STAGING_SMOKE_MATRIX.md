# Moo Platform — offline smoke matrix

## Preconditions

Use the Telegram client with `@topka_demo_bot`, a test restaurant with at least one available dish, one modifier group, one delivery zone, pickup enabled if it is in pilot scope, and one active subscription plan. Owner and guest accounts must be separate Telegram users.

| ID | Actor | Scenario | Expected result |
|---|---|---|---|
| S1 | Guest | Open Mini App from `@topka_demo_bot` | Correct restaurant opens; no fallback tenant data appears. |
| S2 | Guest | Browse menu, category, dish, modifier | Available price/content is visible; required modifier blocks incomplete add-to-cart. |
| S3 | Owner → Guest | Change dish price or availability and publish | Guest receives refresh/sync signal; stale cart returns `STALE_CART` with changed position details. |
| S4 | Guest | Delivery checkout with valid address | Delivery fee, minimum/window and server total are shown; order appears once. |
| S5 | Guest | Repeat submit/retry after network delay | Existing order is returned by `clientRequestId`; no duplicate order is created. |
| S6 | Guest | Pickup checkout | Order is created with `fulfillmentMethod = PICKUP`; owner sees «самовывоз» and no delivery fee. |
| S7 | Owner | Process order through allowed statuses | Only valid next action is available; owner list shows customer, items, total, payment and fulfilment. |
| S8 | Guest | Open order history/status | Timeline reflects server status and final state; Telegram failure does not remove order. |
| S9 | Guest | Create subscription draft | Price and included items reflect current menu; menu changes invalidate stale draft with explanation. |
| S10 | Owner → Guest | Pause/resume/cancel subscription | State changes are persisted, visible on both sides, and Telegram notification is attempted. |
| S11 | Owner | Review subscription economics | Cost, contribution, margin and warnings are visible; incomplete cost data is marked explicitly. |
| S12 | Owner | Open dashboard analytics | Visits, carts, orders, revenue and KPI period definitions are consistent with the response contract. |
| S13 | Owner | Create/publish campaign | Campaign status/visibility/limits are clear; redemption is recorded against the correct order. |
| S14 | Security | Supply another `restaurantId` in guest API payload | Forced single-tenant context ignores it; no cross-tenant data is returned. |

## Evidence to capture

Record the order ID, subscription ID, visible status, timestamp and screenshot for each failed scenario. For S3 and S5 also record the HTTP status/code (`409 STALE_CART` or idempotent existing order) from the browser network panel if available.

## Current automated/read-only checks

The `test` branch head is `61c7e7a`. Local type-check, lint and production build pass. The Vercel preview entrypoint opens successfully. Telegram-authenticated scenarios remain manual because the public browser URL cannot create valid Telegram `initData`.

## Added in the current epic batch

| ID | Actor | Scenario | Expected result |
|---|---|---|---|
| S15 | Guest | Open checkout while restaurant is closed | Checkout shows closed state and opening hours; CTA is disabled and no order request is accepted. |
| S16 | Guest | Attempt order against closed restaurant through a stale/open client | API returns `409 RESTAURANT_CLOSED`; no order is created. |
| S17 | Guest | Skip a future subscription delivery before the 12-hour cutoff | Delivery becomes `SKIPPED`, subscription remains intact, and the result is visible after refresh. |
| S18 | Guest | Reschedule a future subscription delivery | Future date is accepted only before cutoff; duplicate dates and past dates are rejected with a visible reason. |
