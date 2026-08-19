# MOO Owner IA v2

## Design direction

Owner ЛК строится вокруг **card-first operational workspace**. Большая карточка отвечает за один бизнес-домен, внутри неё есть только короткий summary и быстрые actions. Подробные настройки открываются отдельным экраном или раскрытием конкретной строки; все домены не должны быть одновременно раскрыты по умолчанию.

## Top-level order

| Layer | Purpose | Default state |
|---|---|---|
| Today | Срочные задачи, readiness и быстрый переход в гостевой вид | Always visible |
| KPI | Заказы, выручка, AOV, cancellations и период | Always visible |
| Venue | Режим заведения, команда, Telegram | Expanded |
| Guest storefront | Главная, меню и товары, catering/banner surface | Expanded |
| Operations | Заказы и текущая работа | Expanded |
| Subscriptions | Customers, plans, subscription requests | Collapsed |
| Requests | Catering and inbound leads | Collapsed |
| Analytics | Visits, guests, economics | Collapsed |

## Naming rules

The owner should see business language rather than internal implementation language. `Настройки публикации` is replaced by `гостевая витрина`: it means exactly what the owner can inspect — the surface a guest sees and can order from. `Профиль и режим` remains the venue operating domain; `Telegram` is a channel/integration domain; `Меню и товары` is the catalog domain.

## Interaction rules

Each domain is a large rounded card with a clear title, one-line explanation, item count and explicit expand/collapse affordance. Inside, individual resources use the existing details pattern: tap the row for a compact operational preview; use the primary link for the full screen. Only one resource detail should be open at a time. Collapsed state is local to the current session and never hides urgent task badges from the Today card.

## Visual rules

Cards share the same surface, radius, border, padding and shadow tokens. Section headers use stronger typography than row labels, while hints remain muted and short. Status, counts and readiness alerts use a restrained semantic palette: accent for ready, amber for action required, rose only for urgent outstanding tasks. No domain should mix unrelated controls inside one card.

## Smoke scenarios

Open `/admin` in Telegram WebView and verify that Today and KPI remain visible while domain cards are independently collapsed. Collapse `аналитика`, reload the route, and confirm that the information architecture remains understandable even when details are hidden. Expand `гостевая витрина`, open `Главная` and `Меню и товары`, then return to the top without losing the owner context. Tap the Today CTA `гостевая витрина` and verify that the label is clear and does not imply an implementation detail.
