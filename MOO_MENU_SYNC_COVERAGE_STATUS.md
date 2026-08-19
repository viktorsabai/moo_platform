# MOO menu sync coverage status

## Covered owner mutation points

| Domain | Handler | Mutations | Event entity types |
|---|---|---|---|
| Food menu | `admin/menu/categories` | create, update, delete/archive | `Category`, `CategoryBatch` |
| Food menu | `admin/menu/dishes` | create, bulk/single update, delete | `Dish`, `DishBatch` |
| Food menu | `admin/menu/options` | group/value create, update, hide, hard delete | `MenuOptionGroup`, `MenuOptionValue` |
| Food menu | `admin/menu/dish-options` | replace dish option links | `DishOptionValueBatch` |
| Food menu | `admin/menu/modifiers` | replace option set, create, update, delete | `DishModifierBatch`, `DishModifier` |
| Store menu | `admin/store/categories` | create, update, delete | `StoreCategory`, `StoreCategoryBatch` |
| Store menu | `admin/store/products` | create with nested variants, update, delete | `StoreProduct`, `StoreProductBatch` |
| Store menu | `admin/store/variants` | create, update, delete | `StoreVariant` |

## Publisher contract

Every successful owner mutation calls `publishRestaurantContentChange` with `domain: MENU`. The publisher increments the restaurant's monotonic menu version and appends a cursorable event. Failed mutations do not publish. The event payload is deliberately compact and contains no customer or payment data.

## Quality gate

| Check | Result |
|---|---|
| `prisma generate` | PASS |
| `npm run type-check` | PASS; 0 TypeScript errors |
| `npm run lint` | PASS; existing warnings only |
| `npm run build` | PASS; Next.js compiled and generated all 46 static pages |
| `git diff --check` | PASS |

## Remaining verification

The migration and events must be exercised against staging DB. The required matrix is owner create/update/delete for every row above, followed by guest `/api/sync/state` and `/api/sync/events` checks. Negative cases must verify that an owner cannot mutate another restaurant and a guest cannot read another restaurant's cursor. After staging proof, add owner confirmation UI and guest refresh messaging.
