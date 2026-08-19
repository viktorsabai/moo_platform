# MOO Guest Navigation v2

## Problem addressed

The previous guest second-level surfaces used a compressed one-line rhythm, mixed back-link patterns and several fixed overlays competing for the same bottom area. Menu media used `object-cover` for transparent food photography, while product names were too aggressively clamped. Catering also looked like a generic information page instead of a fast commercial lead surface.

## New rules

| Rule | Implementation |
|---|---|
| One back pattern | All second-level pages use the shared `PageHeader` and `BackLink` contract. |
| No title clipping | Shared title/subtitle tokens now allow natural wrapping; action slots are width-constrained and do not push the title off-screen. |
| Catering conversion | `/catering` has a dark editorial hero, one primary CTA, clear use cases, trust signals and a three-step flow. The lead form uses the same page header and explicit two-step grouping. |
| Food image integrity | Dish gallery imagery uses `object-contain` with controlled padding instead of cropping transparent plate photos. |
| Product text integrity | Dish names have a larger type scale, three-line clamp and a fixed minimum rhythm to prevent accidental visual jumps. |
| Safe-area discipline | Existing root shell, sticky cart and bottom navigation remain the layer owners; second-level routes use extra bottom padding and do not mount a redundant cart overlay. |

## Smoke scenarios

Open `/catering` in Telegram and verify that the hero CTA is immediately visible, the three use-case cards are tappable, and the bottom CTA is not covered by navigation. Open `/requests/new?type=catering`; confirm the back arrow returns to `/catering`, the title wraps naturally and the two request sections fit within the viewport. Open `/menu`; verify that the dish image is not cut at the plate edges, titles do not end in accidental mid-word clipping, category chips remain horizontally scrollable and the sticky cart does not cover a card action. Repeat on a narrow Telegram WebView and on a wider desktop browser.
