# Design Unification Progress

**Date:** 2026-01-28  
**Status:** Phase 1 Complete, Phase 2 In Progress

---

## ✅ Completed

### 1. ProductCard Component Created
- **File:** `src/components/ui/ProductCard.tsx`
- **Purpose:** Unified product card component
- **Variants:** `compact` (for sections) and `full` (for detail views)
- **Features:**
  - Auto cart integration
  - Image/emoji fallback
  - Price badge
  - Cart quantity display
  - Tags, calories, allergens (full variant)
  - Consistent styling with `.ui-surface-strong`

### 2. Components Updated to Use ProductCard
- ✅ `src/features/menu/components/DishCard.tsx` - Now uses ProductCard (full variant)
- ✅ `src/app/menu/page.tsx` - Section cards now use ProductCard (compact variant)
- ✅ List view in menu still uses ListRow (appropriate for dense lists)

### 3. Card Styling Standardized
- ✅ `CartItem` - Now uses `.ui-surface-strong` instead of inline styles
- ✅ `SubscriptionCard` - Now uses `.ui-surface-strong` instead of inline styles
- ✅ `ProductCard` - Uses `.ui-surface-strong` by default

### 4. Button Styling Standardized (Partial)
- ✅ `ProductCard` - Uses `btn btn-primary` for add buttons
- ✅ `StickyCartBar` - Uses `btn btn-primary` for checkout button
- ✅ `checkout/page.tsx` - Uses `btn btn-primary` for submit buttons
- ✅ `menu/page.tsx` - Store buttons use `btn btn-primary`
- ✅ `SubscriptionCard` - Resume button uses `btn btn-primary`

---

## 🔄 In Progress

### Button Standardization (Remaining)
Still need to update buttons in:
- `src/app/subscriptions/page.tsx` (4 instances)
- `src/app/orders/page.tsx` (3 instances)
- `src/app/profile/delivery/page.tsx` (1 instance)
- `src/app/cart/page.tsx` (3 instances)
- `src/app/platform/page.tsx` (2 instances)
- Admin pages (multiple instances)
- Auth pages (signin/signup)

**Pattern to replace:**
```tsx
// OLD
className="... bg-[color:var(--accent)] ..."

// NEW
className="btn btn-primary ..."
```

---

## 📋 Remaining Tasks

### High Priority
1. **Complete button standardization** - Replace all inline `bg-[color:var(--accent)]` with `btn btn-primary`
2. **Store product cards** - Consider using ProductCard for store items (currently inline)
3. **Secondary buttons** - Replace `border border-black/10 bg-white` with `btn btn-secondary`

### Medium Priority
4. **Card border radius consistency** - Ensure all cards use consistent radius (some use `rounded-2xl`, some `rounded-[22px]`)
5. **Shadow consistency** - Some cards have custom shadows, should use CSS variables

### Low Priority
6. **Documentation** - Create usage guide for ProductCard variants
7. **Testing** - Verify all pages render correctly after changes

---

## 📊 Statistics

**Files Modified:** 6
- `src/components/ui/ProductCard.tsx` (new)
- `src/features/menu/components/DishCard.tsx`
- `src/app/menu/page.tsx`
- `src/features/cart/components/CartItem.tsx`
- `src/features/subscriptions/components/SubscriptionCard.tsx`
- `src/components/StickyCartBar.tsx`
- `src/app/checkout/page.tsx`
- `src/app/page.tsx`

**Components Standardized:** 4
- ProductCard (new unified component)
- CartItem
- SubscriptionCard
- DishCard (now wrapper)

**Buttons Standardized:** ~8 instances
**Buttons Remaining:** ~26 instances (across 15 files)

---

## 🎯 Next Steps

1. **Batch update remaining buttons** - Use find/replace for common patterns
2. **Test all pages** - Ensure visual consistency
3. **Update store cards** - Consider ProductCard for store items
4. **Document patterns** - Add comments/guides for future development

---

## 💡 Design System Status

**Before:** Mixed inline styles, duplicate card implementations  
**After:** Unified ProductCard, standardized card surfaces, partial button standardization

**Progress:** ~60% complete

---

**Last Updated:** 2026-01-28
