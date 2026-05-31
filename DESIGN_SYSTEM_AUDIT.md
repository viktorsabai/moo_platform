# MOO Design System Audit

**Date:** 2026-01-28  
**Context:** Telegram Mini App, B2B2C food commerce platform  
**Goal:** Systematize existing UI patterns without redesigning

---

## Executive Summary

The codebase contains a **coherent but unconsolidated** design system. Multiple card types exist for valid reasons (different scenarios), but some patterns are duplicated or used inconsistently. The design direction is clear: modern, Telegram-native, calm, with structured geometry and human warmth.

**Key Finding:** The system is 80% there. It needs consolidation, not reinvention.

---

## 1. Design Tokens & Foundation

### 1.1 Color System (✅ Well-Defined)

**Light Mode:**
- Background: `#f8f7f5` (warm off-white)
- Surface: `rgba(255,255,255,.72)` / `.92` (strong)
- Stroke: `rgba(15, 23, 42, .10)` / `.16` (strong)
- Text: `#111827` (graphite)
- Muted: `rgba(17, 24, 39, .62)`
- Primary/Accent: `#111827` (monochrome, clean)

**Dark Mode:** Defined but not actively used (future-ready)

**Assessment:** ✅ Solid foundation. Monochrome approach is clean and modern.

### 1.2 Typography (✅ Consistent)

- Title: `22px / font-extrabold / tracking-tight`
- Subtitle: `13px / font-medium`
- Body: `14px / font-semibold`
- Meta: `12px / font-semibold`
- Line heights: `1.15` (titles), `1.2` (body)

**Assessment:** ✅ Consistent scale. Good for Telegram/iOS readability.

### 1.3 Spacing & Geometry (✅ Systematic)

- Radius: `26px` (xl), `18px` (lg), `14px` (md), `999px` (pill)
- Shadows: Soft (`0_14px_40px`), Card (`0_10px_26px`)
- Backdrop blur: `14px` / `16px` (glassy surfaces)

**Assessment:** ✅ Clear hierarchy. Rounded corners create modern, friendly feel.

### 1.4 CSS Classes (✅ Organized)

**Layout:**
- `.ui-container` - max-width container
- `.ui-section` - section wrapper
- `.ui-header` - page header pattern

**Surfaces:**
- `.ui-surface` - standard surface (72% opacity)
- `.ui-surface-strong` - strong surface (92% opacity)
- `.card` - card template

**Components:**
- `.ufo-list` - content-first list
- `.ufo-row` - list row pattern
- `.chip` / `.chip-accent` - badge/chip
- `.input` / `.input--pill` - form inputs

**Assessment:** ✅ Good abstraction. Utility classes are semantic, not prescriptive.

---

## 2. Card & Layout Pattern Inventory

### 2.1 Card Types (By Purpose)

#### **A. Promo/Reel Cards** (Vertical, Tall)

**Component:** `ReelCard`  
**Purpose:** Promotional content, "shorts" style  
**Dimensions:** `h-[280px] w-[200px]` (tall, narrow)  
**Usage:**
- Home page: "сегодня" section (dish of day, trial subscription, store)
- Subscriptions: subscription cards in reel format

**Structure:**
```
┌─────────────────┐
│ kicker (small)  │
│ title (large)   │
│                 │
│ [mark/icon]     │
│                 │
│                 │
│ [CTA button] →  │
└─────────────────┘
```

**Assessment:** ✅ Purposeful. Tall format works for vertical scrolling reels.

---

#### **B. Action/Navigation Cards** (Horizontal, Square-ish)

**Component:** `ActionCard`  
**Purpose:** Quick actions, scenario selection  
**Dimensions:** `w-[260px]` (flexible height)  
**Usage:**
- Home page: "сценарии" section (dish of day, subscription, store, repeat order, etc.)

**Structure:**
```
┌─────────────────────────────┐
│ [icon/mark] Title      [→]  │
│            Subtitle         │
└─────────────────────────────┘
```

**Assessment:** ✅ Clear purpose. Horizontal layout good for quick scanning.

---

#### **C. Content Cards** (Vertical, Product)

**Component:** `DishCard` (in menu)  
**Purpose:** Product display (dishes, store items)  
**Dimensions:** Variable (grid-based)  
**Usage:**
- Menu page: dish cards in sections
- Store page: product cards

**Structure:**
```
┌─────────────────┐
│ [image/emoji]    │
│ [price badge]    │
│ [in-cart badge]  │
│                  │
│ Title            │
│ Description      │
│ [tags/chips]     │
│ [add button]     │
└─────────────────┘
```

**Assessment:** ⚠️ **Duplication Issue:** Similar cards exist in:
- `src/features/menu/components/DishCard.tsx` (full-featured)
- Inline cards in `src/app/menu/page.tsx` (simplified)

**Recommendation:** Consolidate into one `ProductCard` component with variants.

---

#### **D. List Rows** (Horizontal, Compact)

**Component:** `ListRow`  
**Purpose:** Dense information display, lists  
**Dimensions:** Full width, flexible height  
**Usage:**
- Menu page: list view of dishes
- Cart page: cart items (via `CartItem`, not `ListRow`)
- Orders page: order history
- Profile page: settings list
- Admin pages: management lists

**Structure:**
```
┌─────────────────────────────────────┐
│ [icon] Title              [action] │
│        Subtitle                    │
│        Meta                         │
└─────────────────────────────────────┘
```

**Assessment:** ✅ Consistent. Used appropriately for dense lists.

---

#### **E. Cart Items** (Horizontal, Rich)

**Component:** `CartItem`  
**Purpose:** Cart line items with controls  
**Dimensions:** Full width, `~100px` height  
**Usage:**
- Cart page: individual cart items

**Structure:**
```
┌─────────────────────────────────────┐
│ [thumb] Title              [price] │
│         Meta              [remove] │
│         [counter controls]         │
└─────────────────────────────────────┘
```

**Assessment:** ✅ Purpose-specific. Good separation from `ListRow`.

---

#### **F. Subscription Cards** (Vertical, Rich)

**Component:** `SubscriptionCard`  
**Purpose:** Subscription details display  
**Dimensions:** Full width, variable height  
**Usage:**
- Subscriptions page: subscription list

**Structure:**
```
┌─────────────────────────────────────┐
│ Title [status]              [price] │
│ Plan info                            │
│ [schedule grid]                      │
│ [items list]                         │
│ [action buttons]                     │
└─────────────────────────────────────┘
```

**Assessment:** ✅ Purpose-specific. Rich content needs full-width card.

---

#### **G. Sticky Bars** (Floating, Contextual)

**Component:** `StickyCartBar`, `StickyBar`  
**Purpose:** Persistent actions, context  
**Dimensions:** Fixed width (`min(420px,92%)`), variable height  
**Usage:**
- Global: cart summary (expandable pill)
- Checkout: order summary

**Structure:**
```
┌─────────────────────────────┐
│ [icon] Summary      [CTA]   │
│ (expandable content)        │
└─────────────────────────────┘
```

**Assessment:** ✅ Good pattern. Floating bars work well for Telegram.

---

### 2.2 Layout Patterns

#### **Section Container**

**Component:** `Section`  
**Purpose:** Group related content  
**Structure:**
```
Section Title [meta] [action]
─────────────────────────────
[content]
```

**Usage:** Consistent across all pages.

**Assessment:** ✅ Well-used. Clear hierarchy.

---

#### **Control Panel**

**Component:** `ControlPanel`  
**Purpose:** Filters, search, mode toggles  
**Structure:**
```
┌─────────────────────────────┐
│ [top controls]              │
│ [search]                    │
│ [chips/filters]             │
│ [expanded content]          │
└─────────────────────────────┘
```

**Usage:**
- Menu page: mode toggle (food/store), filters, search
- Subscriptions page: tabs, scope filters

**Assessment:** ✅ Flexible. Good for complex filtering.

---

#### **Page Header**

**Component:** `PageHeader`  
**Purpose:** Page title and navigation  
**Structure:**
```
[←] Title [action]
    Subtitle
```

**Usage:** Consistent across all pages.

**Assessment:** ✅ Standard. Works well.

---

## 3. Pattern Classification

### 3.1 By Role

| Role | Components | Usage |
|------|-----------|-------|
| **Promotion** | `ReelCard` | Home page reels, subscription highlights |
| **Navigation** | `ActionCard` | Scenario selection, quick actions |
| **Content** | `DishCard`, inline product cards | Menu items, store products |
| **List** | `ListRow` | Dense lists, settings, history |
| **Cart** | `CartItem` | Cart line items |
| **Detail** | `SubscriptionCard` | Rich content display |
| **Context** | `StickyCartBar`, `StickyBar` | Persistent actions |

### 3.2 By Layout

| Layout | Components | When to Use |
|--------|-----------|-------------|
| **Vertical Tall** | `ReelCard` | Promo content, vertical scrolling |
| **Vertical Compact** | `DishCard`, `SubscriptionCard` | Product display, detail cards |
| **Horizontal** | `ActionCard`, `ListRow`, `CartItem` | Navigation, lists, cart |
| **Floating** | `StickyCartBar` | Persistent context |

---

## 4. Duplication & Inconsistencies

### 4.1 Critical Issues

#### **Issue 1: Product Card Duplication**

**Problem:**
- `src/features/menu/components/DishCard.tsx` - Full-featured card
- Inline card implementation in `src/app/menu/page.tsx` (lines 398-457)

**Impact:** Two similar but different implementations. Maintenance burden.

**Recommendation:**
1. Extract inline card to `ProductCard` component
2. Use `ProductCard` in both places
3. Add `variant` prop: `"compact" | "full"`

---

#### **Issue 2: Cart Item vs ListRow**

**Problem:**
- `CartItem` is purpose-built for cart
- `ListRow` is generic list component
- Some cart-like items might use `ListRow` inconsistently

**Assessment:** ✅ **Not an issue.** `CartItem` is correctly specialized. Keep separate.

---

#### **Issue 3: Card Styling Inconsistencies**

**Problem:**
- Some cards use `.ui-surface-strong`
- Some use inline `rounded-2xl border border-black/10 bg-white`
- Some use `.card` class

**Examples:**
- `ActionCard`: `ui-surface-strong`
- `ReelCard`: `ui-surface-strong`
- `DishCard`: inline styles
- `CartItem`: inline styles
- `SubscriptionCard`: inline styles

**Recommendation:**
1. Standardize on `.ui-surface-strong` for cards
2. Or create `.card-product`, `.card-action`, `.card-promo` variants
3. Update all cards to use consistent base class

---

### 4.2 Minor Issues

#### **Issue 4: Button Styling**

**Problem:**
- Some buttons use `.btn-primary`
- Some use inline `bg-[color:var(--accent)]`
- Some use `bg-[color:var(--primary)]`

**Recommendation:**
- Standardize on `.btn-primary` for primary actions
- Use `.btn-secondary` for secondary
- Use `.btn-ghost` for tertiary

---

#### **Issue 5: Chip/Badge Usage**

**Problem:**
- `.chip` class exists
- Some badges use inline styles
- Some use `.chip-accent`

**Assessment:** ⚠️ Minor. Most places use `.chip` correctly.

---

## 5. Proposed Canonical Template Set

### 5.1 Card Templates (By Purpose)

#### **Template 1: PromoCard** (Reel-style)
- **Component:** `ReelCard` (keep as-is)
- **Purpose:** Promotional content, vertical scrolling
- **Dimensions:** `h-[280px] w-[200px]`
- **Variants:** None needed
- **Usage:** Home reels, subscription highlights

#### **Template 2: ActionCard** (Navigation)
- **Component:** `ActionCard` (keep as-is)
- **Purpose:** Quick actions, scenario selection
- **Dimensions:** `w-[260px]` (flexible height)
- **Variants:** None needed
- **Usage:** Home scenarios, quick navigation

#### **Template 3: ProductCard** (Content)
- **Component:** New unified `ProductCard`
- **Purpose:** Product display (dishes, store items)
- **Dimensions:** Variable (grid-based)
- **Variants:**
  - `variant="compact"` - Minimal (image, title, price, add button)
  - `variant="full"` - Full details (description, tags, calories, allergens)
- **Usage:** Menu items, store products
- **Consolidates:** `DishCard` + inline menu cards

#### **Template 4: ListRow** (List)
- **Component:** `ListRow` (keep as-is)
- **Purpose:** Dense information, lists
- **Dimensions:** Full width
- **Variants:** None needed
- **Usage:** Settings, history, admin lists

#### **Template 5: CartItem** (Cart)
- **Component:** `CartItem` (keep as-is)
- **Purpose:** Cart line items
- **Dimensions:** Full width
- **Variants:** None needed
- **Usage:** Cart page only

#### **Template 6: DetailCard** (Rich Content)
- **Component:** `SubscriptionCard` → rename to `DetailCard`
- **Purpose:** Rich content display
- **Dimensions:** Full width, variable height
- **Variants:**
  - `type="subscription"` - Subscription details
  - `type="order"` - Order details (future)
- **Usage:** Subscription details, order details

---

### 5.2 Layout Templates

#### **Template 7: Section**
- **Component:** `Section` (keep as-is)
- **Purpose:** Content grouping
- **Structure:** Title + meta + action + content

#### **Template 8: ControlPanel**
- **Component:** `ControlPanel` (keep as-is)
- **Purpose:** Filters, search, mode toggles
- **Structure:** Top controls + search + chips + expanded

#### **Template 9: PageHeader**
- **Component:** `PageHeader` (keep as-is)
- **Purpose:** Page title and navigation
- **Structure:** Back button + title + subtitle + action

#### **Template 10: StickyBar**
- **Component:** `StickyCartBar`, `StickyBar` (keep as-is)
- **Purpose:** Persistent actions
- **Structure:** Icon + summary + CTA (expandable)

---

## 6. Consolidation Plan

### Phase 1: Product Card Unification (High Priority)

**Tasks:**
1. Create `src/components/ui/ProductCard.tsx`
2. Extract common logic from `DishCard` and inline menu cards
3. Add `variant` prop: `"compact" | "full"`
4. Update `src/app/menu/page.tsx` to use `ProductCard`
5. Update `src/features/menu/components/DishCard.tsx` to use `ProductCard`
6. Test in both menu and store contexts

**Files to Modify:**
- `src/components/ui/ProductCard.tsx` (new)
- `src/app/menu/page.tsx`
- `src/features/menu/components/DishCard.tsx`

---

### Phase 2: Card Styling Standardization (Medium Priority)

**Tasks:**
1. Audit all card components for base class usage
2. Standardize on `.ui-surface-strong` or create card variants
3. Update all cards to use consistent base
4. Remove inline card styles where possible

**Files to Modify:**
- `src/components/ui/ActionCard.tsx`
- `src/components/ui/ReelCard.tsx`
- `src/components/ui/ProductCard.tsx` (new)
- `src/features/cart/components/CartItem.tsx`
- `src/features/subscriptions/components/SubscriptionCard.tsx`

---

### Phase 3: Button Standardization (Low Priority)

**Tasks:**
1. Audit all button usages
2. Replace inline button styles with `.btn-*` classes
3. Ensure consistent primary/secondary/ghost usage

**Files to Modify:**
- All page components
- All feature components

---

## 7. Design System Principles (Documented)

### 7.1 Card Usage Rules

1. **PromoCard (ReelCard):** Use for promotional content in vertical scrolling sections
2. **ActionCard:** Use for quick actions and scenario selection
3. **ProductCard:** Use for all product displays (dishes, store items)
4. **ListRow:** Use for dense lists (settings, history, admin)
5. **CartItem:** Use only for cart line items
6. **DetailCard:** Use for rich content (subscriptions, orders)

### 7.2 Layout Rules

1. **Section:** Always use for content grouping
2. **ControlPanel:** Use for complex filtering/search
3. **PageHeader:** Use on all pages for consistency
4. **StickyBar:** Use for persistent actions (cart, checkout)

### 7.3 Styling Rules

1. **Surfaces:** Use `.ui-surface` or `.ui-surface-strong` for cards
2. **Buttons:** Use `.btn-primary`, `.btn-secondary`, `.btn-ghost`
3. **Chips:** Use `.chip` or `.chip-accent`
4. **Inputs:** Use `.input` or `.input--pill`
5. **Spacing:** Use consistent margins (`mt-4`, `gap-3`, etc.)

### 7.4 Emoji Usage

- ✅ **Allowed:** Category icons, food type indicators
- ✅ **Allowed:** Subtle accent (`.ufo-emoji--subtle`)
- ❌ **Avoid:** Overuse, everywhere emoji
- **Rule:** Emoji should enhance, not distract

---

## 8. Component Library Structure

### 8.1 Current Structure

```
src/components/ui/
├── ActionCard.tsx          ✅ Keep
├── BrandMarkOO.tsx         ✅ Keep
├── Button.tsx              ✅ Keep (base)
├── Card.tsx                ⚠️  Unused? Check usage
├── Chip.tsx                ✅ Keep
├── ControlPanel.tsx        ✅ Keep
├── DishBadge.tsx           ⚠️  Check usage
├── EmojiIcon.tsx           ⚠️  Check usage
├── icons.tsx               ✅ Keep
├── InlineCounter.tsx       ✅ Keep
├── InlineReveal.tsx        ✅ Keep
├── ListRow.tsx             ✅ Keep
├── PageHeader.tsx          ✅ Keep
├── PromoReelCard.tsx       ✅ Keep (ReelCard)
├── RoleBadges.tsx          ⚠️  Check usage
├── Section.tsx              ✅ Keep
├── SectionBadge.tsx        ⚠️  Check usage
├── StickyBar.tsx           ✅ Keep
└── ProductCard.tsx          ❌ Create (new)
```

### 8.2 Recommended Structure

```
src/components/ui/
├── cards/
│   ├── ActionCard.tsx
│   ├── ProductCard.tsx      (new, consolidates DishCard)
│   ├── ReelCard.tsx         (rename from PromoReelCard)
│   └── DetailCard.tsx       (rename from SubscriptionCard)
├── layout/
│   ├── Section.tsx
│   ├── ControlPanel.tsx
│   ├── PageHeader.tsx
│   └── StickyBar.tsx
├── forms/
│   ├── Button.tsx
│   ├── Input.tsx            (if extracted)
│   ├── Chip.tsx
│   └── InlineCounter.tsx
├── content/
│   ├── ListRow.tsx
│   └── InlineReveal.tsx
└── brand/
    └── BrandMarkOO.tsx
```

**Note:** This is optional. Current flat structure is fine if components are well-documented.

---

## 9. Consistency Checklist

### 9.1 Visual Consistency

- [x] Color tokens defined and used
- [x] Typography scale consistent
- [x] Spacing system in place
- [x] Border radius consistent
- [x] Shadow system defined
- [ ] Card base classes standardized (needs work)
- [ ] Button classes standardized (needs work)

### 9.2 Component Consistency

- [x] Section pattern used consistently
- [x] PageHeader used consistently
- [x] ListRow used appropriately
- [ ] ProductCard needs consolidation
- [x] StickyBar pattern clear

### 9.3 Interaction Consistency

- [x] Active states consistent (`active:scale-[0.98]`)
- [x] Hover states where appropriate
- [x] Loading states handled
- [x] Error states handled

---

## 10. Recommendations Summary

### ✅ Keep As-Is

1. **ReelCard** - Purposeful, well-designed
2. **ActionCard** - Clear purpose, consistent usage
3. **ListRow** - Appropriate for dense lists
4. **CartItem** - Correctly specialized
5. **Section** - Consistent usage
6. **ControlPanel** - Flexible, well-used
7. **PageHeader** - Standard pattern
8. **StickyBar** - Good Telegram pattern

### ⚠️ Consolidate

1. **ProductCard** - Unify `DishCard` + inline menu cards
2. **Card styling** - Standardize base classes
3. **Button styling** - Use `.btn-*` classes consistently

### 📝 Document

1. **Card usage rules** - When to use which card
2. **Layout patterns** - Section, ControlPanel usage
3. **Styling guidelines** - When to use which classes

---

## 11. Next Steps

1. **Review this audit** with design/product team
2. **Prioritize consolidation** (ProductCard first)
3. **Create ProductCard component** (Phase 1)
4. **Update documentation** with usage rules
5. **Test across all pages** for consistency

---

## 12. Design System Health Score

**Overall:** 8/10

**Breakdown:**
- Foundation (tokens, typography): 9/10 ✅
- Component consistency: 7/10 ⚠️
- Pattern clarity: 8/10 ✅
- Documentation: 6/10 ⚠️

**Main Issues:**
1. Product card duplication
2. Card styling inconsistencies
3. Missing usage documentation

**Strengths:**
1. Clear design direction
2. Good foundation tokens
3. Purposeful card variety
4. Consistent layout patterns

---

**End of Audit**
