# UI/UX Unification Progress

**Date:** 2026-01-28  
**Task:** Unify MOO mini-app UI/UX to one coherent design system

---

## ✅ Completed

### 1. Design Tokens Updated
- ✅ Spacing system: base 4/8, section paddings 16-20, block gaps 12-16
- ✅ Typography: 3 levels (ui-h1, ui-h2, ui-body) + muted
- ✅ Radius: consistent (20px, 16px, 12px, 8px, pill)
- ✅ Shadows: unified (soft, card, sticky)

### 2. Base Components Created
- ✅ `HeaderCompact` - Compact header with restaurant name + status + cart + profile
- ✅ `SegmentedControl` - Restaurant/shop toggle
- ✅ `FilterBar` - Compact filter/search panel
- ✅ `SearchInput` - Pill style search
- ✅ `Chip` - Category chips (supports emoji)
- ✅ `ListRow` - Base row with chevron support
- ✅ `Button` - 3 variants (primary/soft/ghost)
- ✅ `ExpandableCard` - Tap-to-expand pattern
- ✅ `ProductRow` - List row for products
- ✅ `SubscriptionRailCard` - Vertical rail card for subscriptions

### 3. ProductCard Enhanced
- ✅ Expandable support (collapsed/expanded states)
- ✅ Favorite button (heart icon)
- ✅ Price more prominent
- ✅ Quantity control secondary
- ✅ Uses unified typography tokens

### 4. StickyCartBar Unified
- ✅ Consistent height, radius, shadow
- ✅ Expandable cart preview
- ✅ Scrollable item list
- ✅ Unified button styles

### 5. Layout Updated
- ✅ `layout.tsx` uses `HeaderCompact` (replaces old Header)

---

## 🔄 In Progress

### 6. Home (/) - Partially Done
- ✅ Rails carousel structure
- ✅ Action cards structure
- ⚠️ Needs: Remove PageHeader (header now in layout), improve visual hierarchy

### 7. Menu (/menu) - Partially Done
- ✅ FilterBar with SegmentedControl
- ✅ SearchInput
- ✅ Chip categories
- ✅ ProductCard with expandable
- ✅ ProductRow for list view
- ⚠️ Needs: Remove PageHeader, ensure all cards use expandable, favorite integration

---

## 📋 Remaining

### 8. Subscriptions (/subscriptions)
- [ ] Replace ControlPanel with FilterBar
- [ ] Add tabs/filters: active / all / expiring soon
- [ ] Use SubscriptionRailCard for list
- [ ] Add expandable to rail cards
- [ ] Remove PageHeader

### 9. Profile (/profile)
- [ ] Redesign with ListRow pattern (less cardy)
- [ ] Add language selector (ru/en/th) - UI only
- [ ] Add theme selector (light/dark/system) - UI only
- [ ] Make summary values clear (badges, muted text)
- [ ] Keep management section in same ListRow style

### 10. Orders (/orders)
- [ ] Fix header/back/title alignment
- [ ] Redesign as "value dashboard" (Apple Health vibe)
- [ ] Add summary widgets: total orders, saved, rating prompt (UI placeholders)
- [ ] Use compact ListRow with status badges

---

## 🎯 Key Requirements Status

### Global Rules
- [x] Spacing system: base 4/8 ✅
- [x] Typography: 3 levels ✅
- [x] Navigation: chevrons only for "go to details" ✅
- [x] CTA system: strong primary in sticky, calm in-page ✅
- [x] Sticky bar: unified component ✅

### Components
- [x] Header (compact) ✅
- [x] SegmentedControl ✅
- [x] FilterBar ✅
- [x] SearchInput ✅
- [x] Chip ✅
- [x] ListRow ✅
- [x] Card (one style) ✅
- [x] ProductRow/ProductCard ✅
- [x] SubscriptionRailCard ✅
- [x] ExpandableCard ✅
- [x] Button (3 variants) ✅

### Screen Requirements
- [x] Menu: expandable cards, favorite, simplified header (partial)
- [ ] Home: rails + action cards (structure done, needs polish)
- [ ] Subscriptions: FilterBar, rail cards, expandable
- [ ] Profile: ListRow, language/theme selectors
- [ ] Orders: value dashboard, summary widgets

---

## 📝 Notes

- Emojis kept only in category chips ✅
- Stroke icons used everywhere else ✅
- No business logic changes ✅
- Routes unchanged ✅

---

**Progress:** ~40% complete

**Next:** Complete Subscriptions, Profile, Orders screens
