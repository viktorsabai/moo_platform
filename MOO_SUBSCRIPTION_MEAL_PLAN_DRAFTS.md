# SubscriptionMealPlanDraft

## Purpose

`SubscriptionMealPlanDraft` хранит конкретный собранный рацион владельца отдельно от `SubscriptionConfig`. Config задаёт правила и границы подписки; draft хранит выбранные блюда по дням и слотам.

## Persistence contract

| Field | Meaning |
|---|---|
| `restaurantId` | Tenant scope. Every query is constrained to current restaurant context. |
| `createdByUserId` | Owner/admin who created the draft. |
| `planTemplateId` | Optional link to a plan template. |
| `status` | Сейчас `DRAFT`; reserved for `PUBLISHED`/`ARCHIVED` lifecycle. |
| `payload` | JSON day → meal slot → dish IDs map. |
| `updatedAt` | Autosave and ordering timestamp. |
| `lastOpenedAt` | Last restore/open timestamp. |

## API

`GET /api/admin/subscriptions/meal-plan-drafts` returns up to 30 current restaurant drafts sorted by updated time. Passing `?id=` returns one scoped draft and updates `lastOpenedAt`.

`POST /api/admin/subscriptions/meal-plan-drafts` creates a draft. `PATCH` with `id` updates payload/name/period/person count. `DELETE?id=` removes only a draft in `DRAFT` status. All operations use the existing `requireRestaurantAdmin(getRestaurantContext())` guard.

## Client behavior

The planner loads the latest server draft first. If none exists, it falls back to local storage. Changes are autosaved with an 800 ms debounce. A server error does not block editing; the UI explains that local fallback is active. The explicit save action gives immediate feedback while the same draft remains available across devices after the API succeeds.

## Smoke checklist

1. Owner opens `/admin/subscriptions` and starts `собрать рацион`.
2. Planner loads without a draft and creates a server draft after the first edit.
3. Owner changes Monday and Tuesday meals, closes and reopens the planner; the same draft is restored.
4. Owner opens the Mini App from another authenticated device/session; the latest restaurant-scoped draft is visible.
5. Owner clicks `сбросить`; the server draft is deleted and the planner returns to subscription defaults.
6. A staff user without admin rights receives a forbidden response and cannot read or mutate drafts.
7. If the draft endpoint fails, the planner remains editable and shows the local fallback message.

## Release gate

Run `npx prisma migrate deploy` against staging before production. Do not use `prisma db push` for the pilot database. Apply the migration before testing cross-device restore.
