# MOO Guest Storefront Redesign v1

## Visual direction

The guest surface now moves from a utility-first catalog toward a **Pinterest-inspired food editorial** composition: food imagery leads, surfaces are warmer and more dimensional, cards have asymmetric editorial rhythm, and the interface uses a restrained accent instead of a collection of unrelated colors.

| Surface | Redesign rule |
|---|---|
| Menu header | Food-first editorial headline `выберите своё`, compact freshness marker and a stronger visual entry point. |
| Filter bar | Floating rounded control surface with clearer category chips and sticky blur treatment. |
| Dish cards | Larger image media, softer editorial radius, deeper but restrained shadow, larger 44px add target, stronger price hierarchy. Featured/hit dishes continue to receive wide cards. |
| Home promos | Tall image-led cards with dark gradient, larger title, short editorial descriptor and high-contrast CTA. |
| Cart | Existing sticky cart remains the persistent action layer; menu add feedback is now local to the tapped item, so the guest understands exactly what changed. |

## Add-to-cart motion contract

| State | Feedback |
|---|---|
| Tap on simple dish | Item image receives a short `cart-pop`, add button changes from `+` to `✓`, button becomes emerald for 850ms, Telegram light haptic fires when available. |
| Tap on dish with options | No premature add; focused detail sheet opens so modifier/variant choice stays explicit. |
| Item already in cart | Inline quantity control remains the source of truth; plus/minus remains a 44px action target. |
| Guest outside Telegram | Haptic call is safely ignored; visual feedback remains fully functional. |
| Reduced motion preference | Existing `prefers-reduced-motion` override prevents decorative movement while retaining the semantic success state. |
| Network/cart failure | Cart store remains authoritative; existing sticky cart and checkout recovery continue to expose the actual cart state rather than relying on animation. |

## Telegram smoke scenarios

Open the Mini App in Telegram and verify that the menu header is visually distinct from the previous build, the sticky filter remains usable after scroll, cards use the larger editorial treatment, and the sticky cart does not cover the add button. Tap a simple dish once and confirm `+ → ✓ → +` with no navigation. Tap a dish with modifiers and confirm the detail sheet opens instead of silently adding a default configuration. Repeat outside Telegram browser and confirm no runtime error when haptic APIs are unavailable.
