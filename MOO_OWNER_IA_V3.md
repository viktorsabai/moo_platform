# MOO Owner IA v3 — Restaurant Operating System

## Core decision

The owner area is reorganized around **workspaces**, not database objects. The launch surface is a command center. A workspace owns an operational outcome and may contain several existing screens internally.

## Launch workspace

| Order | Surface | Purpose | Primary action |
|---:|---|---|---|
| 1 | Service status strip | Shows open/paused/closed state, active service mode and guest visibility. | `Открыть гостевой вид` |
| 2 | Today command center | Unifies new orders, active orders, subscription requests, catering leads and readiness blockers. | `Разобрать сейчас` |
| 3 | Business pulse | Shows revenue, orders, AOV, cancellations, recurring share and lead value with period selector. | `Открыть аналитику` |
| 4 | Decision cards | Up to three contextual recommendations with one direct action each. | Context-dependent |
| 5 | Workspace rail | Entry cards for Operations, Storefront, Subscriptions, Growth, Catering, Analytics and Team. | `Открыть` |

The launch workspace must not contain raw configuration forms, long resource lists or a generic profile directory.

## Workspace routes

| Workspace | Route | Existing content migrated into it |
|---|---|---|
| Operations | `/admin/operations` | `/admin/orders`, owner inbox, order SLA and exception states |
| Storefront | `/admin/storefront` | `/admin/venue`, `/admin/menu`, `/admin/banners`, menu/store content |
| Subscriptions | `/admin/subscriptions` | plans, clients, requests, deliveries, subscription economics |
| Growth | `/admin/growth` | campaigns, attribution, contribution report, marketing notifications |
| Catering | `/admin/catering` | leads, request detail, response state and follow-up |
| Analytics | `/admin/analytics` | stats, visits, campaign contribution, exports |
| Team | `/admin/team` | members, roles, Telegram routing and notification preferences |
| Settings | `/admin/settings` | venue, delivery, payments, integrations and advanced technical controls |

Existing URLs remain as compatibility routes during the migration, but new links should point to workspaces. No workspace should repeat the same card or route in multiple primary sections.

## Visibility rules

| Information type | Default | Interaction |
|---|---|---|
| Urgent operational item | Open in Today | Tap opens the exact item with recommended action. |
| Healthy domain | Compact summary card | Tap opens workspace. |
| Optional domain without data | Hidden from Today, visible in workspace rail | Workspace explains how to activate it. |
| Advanced configuration | Never on launch | Accessible from workspace overflow or Settings. |
| Technical diagnostics | Settings only | Never shown as a business task. |
| AI recommendation | Contextual decision card | Never presented as a generic chat-first experience. |

## Remove and consolidate matrix

| Current pattern | Decision | New home |
|---|---|---|
| Owner inbox + order card + subscription request card | Merge operational queue | Operations / Today |
| Venue + Telegram + team + notification preferences | Split by job | Storefront, Team, Settings |
| Home banners + publication settings + guest preview | Merge | Storefront |
| Menu + store products + options + modifiers | Merge as menu catalog | Storefront → Menu |
| Subscription clients + plans + requests + delivery calendar | Merge lifecycle | Subscriptions |
| Campaigns + campaign report + marketing notifications | Merge growth loop | Growth |
| Catering and generic service leads | Merge pipeline | Catering |
| Visits and KPI | Merge analytical story | Analytics |
| Copilot | Remove from global center | Appears inside decision cards and workspace actions |
| Repeated back-to-profile links | Remove | Shared workspace header + breadcrumbs |
| Raw counts without action | Remove | Replace with state + next action |

## Workspace page contract

Every workspace must begin with a header containing breadcrumb, title, one-line job statement and one primary action. The first card is a current-state summary. The second is the active work queue. Configuration lives behind a clearly named `Настроить` action. Empty state copy must explain business value and offer the shortest activation path.

## Owner navigation

On mobile/WebView, use a compact five-item rail: `Сегодня`, `Операции`, `Витрина`, `Рост`, `Ещё`. `Ещё` opens Subscriptions, Catering, Analytics, Team and Settings as large workspace cards. On wider desktop layouts, show the same hierarchy as a left rail with the current workspace highlighted.

## Release slice

The first implementation slice should build the new launch shell and workspace rail, migrate Today and Business Pulse into it, and add route entry points for Operations, Storefront and Growth. It should not attempt to rewrite every domain in one commit. The result must visibly change the owner experience: the owner lands in a command center and enters workspaces by business job.
