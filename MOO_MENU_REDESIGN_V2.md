# MOO Menu Redesign v2

## Product direction

The menu should feel like a curated food discovery surface, not a dense product database. Pinterest inspiration means editorial rhythm, strong image hierarchy, varied but controlled card sizes and generous whitespace; it does not mean random masonry or unreadable overlays.

## Card system

| Variant | Use | Geometry |
|---|---|---|
| Standard | Default dishes | Two-column mobile grid, square media stage, full readable title, price and add control. |
| Featured | Hit, popular or chef choice | Full-width row, 16:10 media stage, stronger badge and editorial copy. |
| Compact rail | Upsell/recommendation | Horizontal card, one-line title only where safe, no long descriptions. |

Every standard card uses a fixed media ratio but **never clips the food image**. Transparent dish photography uses `object-contain` with a controlled stage and warm neutral background. Text is content-led: no mid-word truncation, no forced two-line clamp for names, and action controls stay in a separate footer row.

## Guest menu hierarchy

1. Search and category rail remain sticky, but use one compact surface and never cover the first card.
2. Category headings are short, sentence case and separated from the grid by consistent rhythm.
3. Each dish card has only one image badge, one favorite action and one add/quantity action. Price is part of the footer, not an overlay competing with the food.
4. A dish with modifiers opens a detail sheet. It never silently adds an incomplete configuration.
5. Sticky cart reserves safe-area space and never covers a card footer or bottom navigation.

## Detail sheet

The detail sheet is a focused purchase surface: readable title, category/tag row, image stage, full description, weight, modifier choices, price, quantity and one primary `в корзину` action. Title and description may wrap naturally. The close action has a stable right slot and never shares the title row with an overflowing string.

## Motion

Add action uses a short scale/pulse, `+ → ✓`, optional Telegram light haptic and a persistent cart update. Reduced-motion users receive the state change without decorative animation. Errors preserve cart state and explain the next action.
