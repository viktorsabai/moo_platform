# MOO — E2E Gap Backlog и план доведения до пилота

## Целевой результат

Тестовая ветка `test` должна позволять владельцу ресторана настроить заведение и каталог, а гостю — открыть Mini App через Telegram, увидеть актуальное меню, собрать обычный заказ или подписку, выбрать доставку/самовывоз, оплатить или передать заказ на ручную проверку, получить статусы и увидеть результат в истории. Все owner-изменения должны быть tenant-safe, отражаться у гостя и оставлять понятный audit trail.

## Статус по сквозным процессам

| Процесс | Что уже есть | Что не хватает до E2E pilot |
|---|---|---|
| Telegram entry/auth | initData validation, NextAuth/password fallback, owner roles | test bot Web App URL, staging env smoke, negative auth cases |
| Restaurant onboarding | register/switch/context, owner setup screens | guided first-run checklist, publish readiness gate, empty-state recovery |
| Guest menu | categories, dishes, options, modifiers, store, favorites, sync polling | full mutation smoke, option edge cases, refresh UX verification, cache invalidation proof |
| Cart | persistent cart, trusted server pricing, stale-cart 409 | automatic diff apply, explicit remove/replace flow, delivery/pickup reset rules |
| Checkout | delivery address, delivery quote, pickup data, payment hooks | end-to-end payment setup, pickup acceptance, idempotent retries, error recovery |
| Orders | guest history/detail, owner order actions, status flow | staging matrix, notification proof, SLA escalation, cancellation/refund policy |
| Subscription build | days/slots/dishes, quotes, draft persistence, catalog version | full purchase/payment flow, price recalculation, draft repair instead of only reset, delivery economics |
| Subscription operations | owner plans/config/deliveries/clients/leads | complete lifecycle: pause, skip, reschedule, cancel, charge/retry, delivery execution |
| Owner settings | venue, delivery zones, payment methods, team, Telegram/QR | grouped IA, publish state, validation, preview-as-guest, audit history |
| Menu operations | dishes/categories/options/modifiers/store variants and sync emitter | bulk import/export roundtrip, image failures, inventory semantics, publish/readiness checks |
| Analytics | activity events, admin stats, visits page | event taxonomy, revenue/margin/subscription KPIs, date/timezone correctness, export |
| Marketing | banners, campaigns, promo validation, leads | audience rules, budget/period limits, attribution, redemption metrics, safe scheduling |
| UX/UI | unified graphic minimalism, review and initial notices | native Telegram shell, mobile overlays, loading/error/empty states, owner task IA, accessibility |
| Recovery/ops | client error/debug logs, sync event journal | alerting, backup/restore drill, migration runbook, observability dashboard |

## Implementation epics

### E1. Test environment and release safety — P0

The test bot `@topka_demo_bot` must open the stable Vercel branch URL, use a separate staging database and never point test writes to production. Add a visible build/version endpoint, environment banner for test only, migration checklist and seed fixture reset procedure.

### E2. Restaurant onboarding and publish readiness — P0

The owner needs a guided setup: restaurant profile, timezone/currency, opening hours, fulfillment mode, payment method, delivery zones, at least one category and dish. The owner cannot accidentally publish a guest catalog with missing critical settings. Acceptance requires a first-run checklist and a preview-as-guest action.

### E3. Guest catalog synchronization — P0

Complete emitter coverage for all guest-visible catalog entities, including option groups/values, modifiers, store categories/products/variants and image/availability changes. Add staging smoke tests for state version, event cursor, tenant isolation and cache refresh.

### E4. Core order flow delivery/pickup — P0

Cover menu → cart → fulfillment selection → quote/address or pickup slot → payment/manual review → order creation → owner acceptance → guest status → completion. Add idempotency key, stale-cart repair, pickup-specific validation and consistent totals across client/server/payment.

### E5. Payments and order recovery — P0

Complete one pilot payment method first, document manual payment fallback, make webhook processing idempotent and reconcile payment status with order status. Add failed/expired/duplicate payment recovery and owner-visible reason codes.

### E6. Subscription customer flow — P0

Cover plan selection → schedule days/slots → dish/options → quote → delivery/pickup → payment → active subscription → next delivery → skip/pause/reschedule/cancel. The customer must see price, cadence, delivery fee, next charge and renewal conditions before confirmation.

### E7. Subscription economics and owner planning — P0/P1

Owner needs per-plan cost sheet, selling price, gross margin, delivery cost, payment fee, expected contribution and break-even subscriber count. Add quote validation, margin warnings, scenario comparison and immutable snapshot of economics at purchase time.

### E8. Owner operations and settings — P0

Reorganize the cabinet around today’s work: restaurant status, new orders, subscription deliveries, leads, alerts and quick actions. Settings need clear sections, inline validation, unsaved-change protection, publish confirmation and preview-as-guest.

### E9. Menu management and inventory semantics — P0/P1

Define the difference between hidden, unavailable, out-of-stock and archived. Add bulk import/export validation, preview, rollback/error report, variant stock behavior and safe image handling. Every owner mutation must publish a sync event after successful persistence.

### E10. Notifications and staff workflow — P1

Specify Telegram notifications for new order, payment, status change, subscription delivery and lead. Add per-role routing, mute windows, retry status and notification registry health.

### E11. Analytics and visits — P1

Create an event taxonomy for app open, menu view, dish view, add-to-cart, checkout start, order created, payment success, subscription start, campaign view and redemption. Add unique visitors, funnel conversion, order revenue, AOV, subscription MRR/active count, churn, repeat rate and margin views with restaurant/timezone filters.

### E12. Campaigns, promos and attribution — P1

Make campaigns configurable by period, audience, channel, restaurant, minimum order, usage cap and stacking rule. Add preview, draft/publish/archive states, validation, redemption ledger and campaign performance metrics. Avoid discounts that can make an order negative-margin without explicit warning.

### E13. UX/UI food-tech refresh — P1

Keep the graphic minimalism but improve native Telegram behavior: clear shell hierarchy, non-overlapping sticky cart/header/nav, explicit restaurant open state and next-open time, stronger checkout total/primary action, readable subscription builder, owner task inbox and consistent loading/error/empty states.

### E14. Reliability, security and pilot operations — P0

Add E2E smoke runner, cross-tenant negative tests, migration runbook, backup/restore drill, webhook replay protection, rate limits for auth/payment/lead endpoints and release checklist. Production promotion requires all P0 acceptance scenarios green.

## First coding sequence

The next code slices should be delivered in this order:

1. Add a test-only environment/version banner and a pilot health endpoint.
2. Add checkout idempotency and pickup-specific validation.
3. Add subscription lifecycle actions and purchase snapshot validation.
4. Add owner subscription economics and margin calculations.
5. Add onboarding publish-readiness checklist and preview-as-guest.
6. Add analytics taxonomy and owner KPI response contract.
7. Apply the UX refresh to the highest-friction screens.

## Definition of Done for a vertical slice

A slice is done only when its API, database invariants, owner UI, guest UI, Telegram notification behavior, sync behavior, error/recovery state, tenant isolation and test deployment behavior are all covered. A local build passing alone is not sufficient.

## Device test protocol

The user should test every test deployment through `@topka_demo_bot`, not a normal browser tab. Each slice will include a short checklist with one owner action, one guest action, one sync assertion and one recovery assertion. Only after the checklist passes will the changes remain eligible for promotion from `test` to `main`.
