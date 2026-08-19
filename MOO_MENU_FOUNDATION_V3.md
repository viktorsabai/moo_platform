# MOO Menu Foundation v3

## Product direction

The menu is no longer forced into one card shape. It exposes three presentation modes for different guest intents:

| Mode | Best for | Behavior |
|---|---|---|
| `сетка` | Fast browse and category scanning | Compact two-column mobile / three-column wide layout, with tagged hero items spanning two columns. |
| `список` | Deliberate choice and readability | One item per row, image thumbnail on the left, full title/price/action area on the right. |
| `витрина` | Editorial discovery | Full-width food-led cards with larger media stage and more breathing room. |

## Full-screen dish viewer

The viewer uses one global search-filtered restaurant dish collection, not the currently selected category. Previous/next controls and horizontal swipe can cross category boundaries. The header exposes position and category context (`N из M · всё меню`) so the guest knows the navigation scope.

Dots remain a compact progress indicator; they do not represent a category or limit the actual collection.

## Price contract

Displayed and cart prices are normalized through `Number(dish.price ?? 0)`. Modifier/option adjustments are added once in the focused view. The same normalized base price is used for card labels, detail total, cart payload and activity analytics.

## Card rules

Food photos remain contained inside a controlled media stage. Titles wrap naturally; no mid-word truncation is used. The footer owns title, price, availability hint and action controls instead of overlaying them on food media.

## Smoke scenarios

1. Open `/menu` and switch `сетка → список → витрина`; verify the same dishes and prices remain consistent.
2. Open a dish in `Салаты`, swipe through the viewer and verify it can move to dishes from another category.
3. Compare card price, focused unit price and cart line price for a dish with no modifiers.
4. Select an option/modifier and verify the detail total equals base price + one modifier adjustment, multiplied by quantity.
5. Open a long-titled dish in every presentation mode and verify no mid-word clipping.
6. Check sticky cart and bottom navigation do not cover list/editorial actions.
7. Test outside Telegram: haptic failure must not block add-to-cart or viewer navigation.
