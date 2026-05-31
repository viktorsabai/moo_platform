# UFO Delivery — Current Project State

Updated: 2026-04-30

This document fixes the current operational state of the project after the latest production changes.  
Scope: auth/login context, DB behavior, API exchange, owner cabinet, profile, banners, visits analytics, smart notifications, menu/store sync.

## 1) Runtime Model (Current)

- Deployment model: Next.js app router, server API routes, Prisma ORM, Telegram Mini App.
- Tenant model: single-tenant production behavior with forced/derived restaurant resolution.
- Primary client surfaces:
  - Guest app: `/`, `/menu`, `/cart`, `/checkout`, `/profile`, `/orders`, `/subscriptions`
  - Owner cabinet: `/admin/*`
- Transport:
  - Browser/MiniApp -> internal API (`/api/*`)
  - API -> Postgres via Prisma
  - API -> Telegram Bot API for outbound notifications/messages

## 2) Auth, Session, and Restaurant Context

### Key rules

- `getRestaurantContext()` resolves operator context (`userId`, `restaurantId`, roles).
- Single-tenant mode remains enabled, but now has safe fallback behavior:
  - if explicit `UFO_SINGLE_RESTAURANT_ID` is set, it is used as source of truth;
  - otherwise fallback checks pinned ID existence and then chooses a valid active restaurant.
- This prevents owner cabinet lockouts when stale pinned IDs do not exist in the current DB.

### Important files

- `src/lib/restaurant-context.ts`
- `src/lib/auth.ts`

### User-visible impact

- `/admin` no longer falls into random "Ошибка загрузки" due to missing old restaurant id.
- Session role + restaurant resolution is more resilient under DB switches.

## 3) Profile Address Persistence Fix

### Problem (fixed)

- Address on profile appeared briefly, then disappeared.

### Root cause

- Locally restored address was overwritten by empty `addressLabel` from `/api/profile/summary`.

### Current behavior

- Profile summary merge now keeps existing non-empty address and does not erase it with empty API value.

### File

- `src/app/profile/page.tsx`

## 4) Owner Cabinet UX Alignment

### Implemented

- Removed duplicate open/closed state line from the body card in owner dashboard (status remains in header only).

### File

- `src/app/admin/AdminDashboardSections.tsx`

## 5) Visits Analytics: Behavior and UX

### Implemented

- Smart visits page received UX/logic updates:
  - metric cards are clickable as fast filters;
  - guest list responds to selected focus filter;
  - graph changed from bars to line chart for readability;
  - better actor naming (uses metadata/name fallbacks, not only "guest");
  - reduced text noise for neutral cases.

### File

- `src/app/admin/visits/page.tsx`

## 6) Scenario Notifications from Visits (Owner-triggered)

### New capability

- Owner can send a scenario-based Telegram message directly from guest card.
- Mandatory confirmation before send to avoid accidental taps.

### Scenarios currently wired

- `abandoned_checkout`
- `abandoned_cart`
- `favorite_interest`
- `repeat_view`

### Files

- UI button: `src/app/admin/visits/ScenarioActionButton.tsx`
- API route: `src/app/api/admin/notifications/scenario/route.ts`
- Embedded usage in visits cards: `src/app/admin/visits/page.tsx`

### API contract (current)

- `POST /api/admin/notifications/scenario`
  - body: `{ telegramId, scenario, dishName? }`
  - guarded by owner/admin context
  - sends Telegram message with web_app CTA

## 7) Banners: Category-Native Targeting

### Problem (fixed)

- Banner creation expected owners to know manual links; category deep-linking was non-obvious.

### Implemented

- New banner target type: `menu_category`.
- Owner selects category from dropdown in banner form.
- Link auto-generated as `/menu?category=<slug>`.
- Save validation requires category selection for this target type.
- Editing existing category links auto-detects target type and selected category.

### Files

- `src/app/admin/banners/page.tsx`
- `src/app/menu/page.tsx` (reads query `category` and activates proper category chip)

## 8) Menu vs Store Pipeline Sync (Current Stage)

The full domain models remain different (dish modifiers vs store variants), but the owner flow was aligned in a practical way.

### Store categories

- Added missing create endpoint:
  - `POST /api/admin/store/categories`
- Added native create UI in Store tab.

### Store options via variants

- Added:
  - `POST /api/admin/store/variants` (create variant for product)
- Store card UI now supports:
  - inline variant name edit;
  - inline variant price edit;
  - quantity counter;
  - add variant block (`+ вариант`);
  - delete variant.

### Files

- API:
  - `src/app/api/admin/store/categories/route.ts`
  - `src/app/api/admin/store/variants/route.ts`
- UI:
  - `src/app/admin/AdminStoreTab.tsx`

## 9) Current API Exchange Map (Critical Paths)

### Guest App

- Menu data: `/api/categories`, `/api/dishes`
- Favorites: `/api/favorites`
- Orders: `/api/orders`
- Subscriptions: `/api/subscriptions`, `/api/subscriptions/[id]`
- Profile summary: `/api/profile/summary`
- Activity tracking: `/api/activity`
- Banners: `/api/banners`

### Owner Cabinet

- Dashboard: server data via `/admin` page loaders + internal Prisma reads
- Menu management:
  - `/api/admin/menu/categories`
  - `/api/admin/menu/dishes`
  - `/api/admin/menu/options`
- Store management:
  - `/api/admin/store/categories`
  - `/api/admin/store/products`
  - `/api/admin/store/variants`
- Banners:
  - `/api/admin/banners`
- Scenario messages:
  - `/api/admin/notifications/scenario`

### Telegram Exchange

- Inbound updates: `/api/telegram/webhook`
- Outbound send API wrapper:
  - `src/lib/telegram.ts` (`sendTelegramMessage`, `sendTelegramDocument`, etc.)
- Notification orchestration:
  - `src/lib/notifications.ts`

## 10) DB Entities Actively Used in Latest Changes

- `Restaurant`, `RestaurantMember`, `User`
- `HomeBanner`
- `Category`, `Dish`, `DishOptionValue` and menu option entities
- `StoreCategory`, `StoreProduct`, `StoreVariant`
- `UserActivityEvent`
- `BotIntegration`

## 11) Stability Notes

- Production lockouts due to stale restaurant pin were mitigated with safe fallback resolution.
- Profile address persistence bug is fixed by non-destructive summary merge.
- Scenario notifications currently are owner-triggered (manual), with tap confirmation.
- Store pipeline now supports category creation + richer variant editing; this is the first sync stage with menu UX patterns.

## 12) Next Recommended Step (Not yet implemented)

- Build a shared "options constructor" UI abstraction for both `menu` and `store` with separate API adapters.
- Add anti-spam controls and delivery analytics for scenario notifications:
  - cooldown per scenario/user
  - global daily cap
  - click/conversion tracking

