# MOO Product Alignment Analysis

**Date:** 2026-01-28  
**Current Product:** UFO_Delivery  
**Target Product:** MOO (B2B2C food commerce platform)

---

## Executive Summary

The codebase has a solid foundation with multi-tenant architecture, unified cart, and Telegram integration. However, it needs significant alignment to match the MOO product vision, particularly around:
- **Loyalty system** (completely missing)
- **Location management** (single location assumption)
- **Fixed subscription plans** (currently custom-only)
- **Owner mode visibility** (currently exposed in navigation)
- **Pickup vs delivery** (not distinguished)
- **Operator role** (not separated from admin)

---

## 1. Current State Analysis

### ✅ What Already Matches Target Model

#### 1.1 Core Architecture
- **Multi-tenant support**: `Restaurant` model with `restaurantId` context
- **Unified cart**: Supports both `dish` and `store` item types in one cart
- **Telegram Mini App**: Properly integrated with Telegram WebApp API
- **Feature-based structure**: Well-organized codebase

#### 1.2 Product Services (Partial Match)

**Food Ordering (✅ Mostly Aligned)**
- Menu/catalog exists (`/menu`)
- Cart supports dishes
- Order creation works
- Delivery address handling

**Shop/Grocery (✅ Aligned)**
- Store products and variants implemented
- Stock management (qty tracking)
- Unified cart integration
- Admin management UI

**Subscriptions (⚠️ Partially Aligned)**
- Subscription model exists
- Custom subscriptions work (user creates their own)
- Delivery scheduling
- **Missing**: Fixed plan templates (owner-defined plans)

**Owner Panel (⚠️ Partially Aligned)**
- Admin routes exist (`/admin/*`)
- Role-based access (OWNER, ADMIN, STAFF)
- Menu management (via API, no UI found)
- Store management UI
- Settings management
- **Issue**: Visible in consumer navigation

**Loyalty System (❌ Missing)**
- No loyalty/bonus/points models
- No progress tracking
- No reward system

---

## 2. Detailed Mismatches

### 2.1 Navigation & User Experience

**Current:**
- Bottom nav: Home, Menu, Subscriptions, Profile
- Admin accessible via `/admin` route (visible if user has role)
- Subscriptions shown as separate tab

**Target:**
- Home = scenario selection (✅ matches)
- Menu = catalog (✅ matches)
- Subscriptions = mode, not separate page (❌ mismatch)
- Owner mode hidden from consumers (❌ mismatch)

**Mismatch Details:**
1. **Subscriptions as tab**: Target says subscriptions are a "mode", not a pricing page. Current implementation treats it as a separate section with its own navigation item.
2. **Owner mode visibility**: Admin panel is accessible via direct URL. Should be hidden/restricted from consumer view.

### 2.2 Data Models

#### Missing Models

**Loyalty System:**
```prisma
// MISSING: No loyalty models
model LoyaltyPoints {
  userId
  restaurantId
  points
  totalEarned
  totalSpent
  // ...
}

model LoyaltyTransaction {
  userId
  points
  type (EARNED | SPENT | EXPIRED)
  orderId?
  // ...
}

model LoyaltyTier {
  restaurantId
  name
  minPoints
  benefits
  // ...
}
```

**Location Management:**
```prisma
// MISSING: Restaurant assumes single location
model Location {
  id
  restaurantId
  name
  address
  coordinates
  isActive
  pickupEnabled
  deliveryEnabled
  // ...
}
```

**Fixed Subscription Plans:**
```prisma
// MISSING: Owner-defined subscription templates
model SubscriptionPlan {
  id
  restaurantId
  name
  description
  price
  planType (WEEKLY | BIWEEKLY | MONTHLY)
  defaultItems (JSON) // default dishes/quantities
  isActive
  // ...
}
```

#### Existing Models Needing Changes

**Order Model:**
```prisma
// CURRENT: Only deliveryTime, no orderType
model Order {
  // ...
  deliveryTime DateTime?
  // MISSING: orderType (DELIVERY | PICKUP)
  // MISSING: locationId (for pickup)
}
```

**Subscription Model:**
```prisma
// CURRENT: Custom subscriptions only
model Subscription {
  // ...
  name String // user-defined
  plan SubscriptionPlan // frequency only
  // MISSING: planTemplateId (reference to fixed plan)
  // MISSING: isCustom (boolean)
}
```

**RestaurantRole Enum:**
```prisma
// CURRENT: OWNER, ADMIN, STAFF
// TARGET: OWNER, ADMIN, OPERATOR
// ISSUE: STAFF != OPERATOR (operator has limited permissions)
```

### 2.3 Role & Permission System

**Current:**
- `PlatformRole`: NONE, SUPERADMIN
- `UserRole`: CUSTOMER, ADMIN, OWNER, SUPERADMIN (legacy)
- `RestaurantRole`: OWNER, ADMIN, STAFF

**Target:**
- Consumer (default)
- Owner (business role)
- Admin (restaurant admin)
- Operator (limited permissions)

**Mismatches:**
1. **STAFF vs OPERATOR**: Current `STAFF` role may not match `OPERATOR` semantics (operator = limited permissions, not just staff)
2. **Role visibility**: Owner mode should be hidden from consumers (role-based UI switching)
3. **Permission granularity**: No fine-grained permissions (operator limitations not defined)

### 2.4 Subscription Model

**Current Implementation:**
- Subscriptions are **custom** (user creates their own)
- User selects dishes, days, time
- No pre-defined plans

**Target Model:**
- **Fixed plans first** (owner-defined templates)
- Customization later (optional)
- Subscriptions are a "mode", not a pricing page

**Mismatches:**
1. No `SubscriptionPlan` template model
2. No owner UI to create/manage fixed plans
3. Subscriptions presented as separate section (should be integrated as "mode")
4. No distinction between fixed plan subscription vs custom subscription

### 2.5 Location & Delivery

**Current:**
- Single restaurant location assumption
- Delivery only (no pickup option)
- Address stored per order

**Target:**
- Multiple locations per restaurant
- Pickup and delivery options
- Location-specific settings

**Mismatches:**
1. No `Location` model
2. No `orderType` (DELIVERY | PICKUP)
3. No location selection in checkout
4. No location-specific hours/settings

### 2.6 Loyalty System

**Current:**
- Completely missing

**Target:**
- Points/bonuses
- Progress tracking
- Loyalty tiers
- Integration with orders/subscriptions

**Missing:**
- All loyalty-related models
- Points calculation logic
- Reward redemption
- Progress UI

---

## 3. Missing Product Components

### 3.1 Core Missing Features

1. **Loyalty System** (0% implemented)
   - Points earning/spending
   - Progress tracking
   - Tiers and benefits
   - Integration with orders

2. **Location Management** (0% implemented)
   - Multiple locations per restaurant
   - Location CRUD in owner panel
   - Location selection in checkout
   - Location-specific settings

3. **Fixed Subscription Plans** (0% implemented)
   - Owner-defined plan templates
   - Plan management UI
   - Plan selection in subscription flow
   - Plan vs custom distinction

4. **Pickup Support** (0% implemented)
   - Order type selection
   - Pickup location selection
   - Pickup time scheduling
   - Pickup status tracking

5. **Operator Role** (Partial - STAFF exists but semantics unclear)
   - Operator-specific permissions
   - Limited access UI
   - Operator vs Admin distinction

### 3.2 UI/Flow Missing Components

1. **Owner Mode Toggle** (hidden from consumers)
   - Role-based UI switching
   - Owner mode entry point (not visible in nav)
   - Context switching

2. **Subscription as Mode** (not separate page)
   - Integration into main flow
   - Mode switching UI
   - Fixed plan selection

3. **Location Selection** (checkout)
   - Location picker
   - Delivery vs pickup toggle
   - Location-specific availability

---

## 4. Technical Debt from Old Assumptions

### 4.1 Single Location Assumption

**Impact:**
- `AppSettings` is singleton per restaurant (assumes one location)
- No location context in queries
- Address model tied to user, not location

**Refactoring Needed:**
- Migrate `AppSettings` to location-specific or restaurant-level
- Add location context to all restaurant-scoped queries
- Update address handling for multi-location

### 4.2 Delivery-Only Assumption

**Impact:**
- `Order.addressId` always required (pickup doesn't need address)
- No order type distinction
- Checkout always asks for address

**Refactoring Needed:**
- Make `addressId` optional
- Add `orderType` enum
- Conditional address form in checkout

### 4.3 Custom-Only Subscriptions

**Impact:**
- Subscription creation flow assumes user builds from scratch
- No plan template selection
- Owner can't pre-define popular plans

**Refactoring Needed:**
- Add plan template model
- Update subscription creation to support template selection
- Add owner plan management UI

### 4.4 Owner Mode Visibility

**Impact:**
- Admin routes accessible if user has role (no hiding)
- No consumer/owner mode separation in UI
- Owner features visible in navigation

**Refactoring Needed:**
- Implement role-based UI hiding
- Add mode toggle (if needed)
- Separate owner entry point

### 4.5 STAFF vs OPERATOR Confusion

**Impact:**
- `STAFF` role exists but semantics unclear
- No operator-specific permission checks
- May need renaming or new role

**Refactoring Needed:**
- Clarify STAFF vs OPERATOR semantics
- Add operator permission checks
- Update role enum if needed

---

## 5. Prioritized Refactoring Plan

### Phase 1: Critical Product Structure (High Priority)

#### 1.1 Location Management
**Effort:** Medium  
**Impact:** High  
**Dependencies:** None

**Tasks:**
- Add `Location` model to schema
- Create location CRUD API (`/api/admin/locations`)
- Add location selection to checkout
- Update `AppSettings` to support location-specific or restaurant-level
- Migrate existing data (assume single default location)

**Files to Modify:**
- `prisma/schema.prisma` (add Location model)
- `src/app/api/admin/locations/route.ts` (new)
- `src/app/checkout/page.tsx` (add location picker)
- `src/lib/restaurant-context.ts` (add location context)

#### 1.2 Pickup vs Delivery
**Effort:** Low  
**Impact:** High  
**Dependencies:** Location Management

**Tasks:**
- Add `orderType` enum (DELIVERY | PICKUP) to Order model
- Make `addressId` optional in Order
- Add order type toggle in checkout
- Update order creation API
- Add pickup location selection

**Files to Modify:**
- `prisma/schema.prisma` (add orderType, make addressId optional)
- `src/app/checkout/page.tsx` (add order type toggle)
- `src/app/api/orders/route.ts` (handle pickup)

#### 1.3 Owner Mode Hiding
**Effort:** Low  
**Impact:** Medium  
**Dependencies:** None

**Tasks:**
- Remove admin links from consumer navigation
- Add role-based UI hiding
- Create owner mode entry point (hidden, e.g., `/owner` or special gesture)
- Update layout to conditionally show owner features

**Files to Modify:**
- `src/components/bottom-navbar.tsx` (remove admin link)
- `src/app/layout.tsx` (conditional owner UI)
- `src/app/admin/page.tsx` (ensure hidden from consumers)

### Phase 2: Subscription Model Alignment (High Priority)

#### 2.1 Fixed Subscription Plans
**Effort:** Medium  
**Impact:** High  
**Dependencies:** None

**Tasks:**
- Add `SubscriptionPlan` template model
- Create plan CRUD API (`/api/admin/subscription-plans`)
- Add plan management UI in owner panel
- Update subscription creation to support plan selection
- Add `planTemplateId` to Subscription model

**Files to Modify:**
- `prisma/schema.prisma` (add SubscriptionPlan model)
- `src/app/api/admin/subscription-plans/route.ts` (new)
- `src/app/admin/subscription-plans/page.tsx` (new)
- `src/features/subscriptions/components/SubscriptionWizard.tsx` (add plan selection)

#### 2.2 Subscription as Mode
**Effort:** Medium  
**Impact:** Medium  
**Dependencies:** Fixed Plans

**Tasks:**
- Remove subscriptions from bottom nav (or make it mode toggle)
- Integrate subscription selection into main flow
- Add "subscription mode" UI state
- Update home page to show subscription scenarios

**Files to Modify:**
- `src/components/bottom-navbar.tsx` (remove or change subscriptions tab)
- `src/app/page.tsx` (enhance subscription scenarios)
- `src/app/subscriptions/page.tsx` (refactor as mode, not separate page)

### Phase 3: Loyalty System (Medium Priority)

#### 3.1 Loyalty Core
**Effort:** High  
**Impact:** High  
**Dependencies:** None

**Tasks:**
- Add loyalty models (LoyaltyPoints, LoyaltyTransaction, LoyaltyTier)
- Create points calculation service
- Add points earning on order completion
- Add points display in profile
- Create loyalty API endpoints

**Files to Create:**
- `prisma/schema.prisma` (loyalty models)
- `src/lib/loyalty.ts` (points calculation)
- `src/app/api/loyalty/route.ts`
- `src/features/loyalty/` (new feature module)

#### 3.2 Loyalty UI
**Effort:** Medium  
**Impact:** Medium  
**Dependencies:** Loyalty Core

**Tasks:**
- Add points display in profile
- Create loyalty progress UI
- Add tier benefits display
- Integrate with checkout (points redemption)

**Files to Create:**
- `src/features/loyalty/components/LoyaltyProgress.tsx`
- `src/app/profile/loyalty/page.tsx`

### Phase 4: Role Refinement (Low Priority)

#### 4.1 Operator Role
**Effort:** Low  
**Impact:** Low  
**Dependencies:** None

**Tasks:**
- Clarify STAFF vs OPERATOR semantics
- Add operator permission checks
- Create operator-limited UI
- Update role enum if needed (or document STAFF = OPERATOR)

**Files to Modify:**
- `src/lib/restaurant-context.ts` (add operator checks)
- `src/app/admin/*` (add operator restrictions)

---

## 6. Data Migration Considerations

### 6.1 Location Migration
- Create default location for each existing restaurant
- Migrate `AppSettings` to location-specific or keep restaurant-level
- Update existing orders (assume delivery to default location)

### 6.2 Subscription Migration
- Existing subscriptions remain custom
- Add `isCustom: true` to existing subscriptions
- No breaking changes needed

### 6.3 Order Migration
- Existing orders: `orderType = DELIVERY` (default)
- `addressId` remains required for existing orders
- New orders can have optional address (pickup)

---

## 7. API Changes Required

### 7.1 New Endpoints Needed

```
POST   /api/admin/locations
GET    /api/admin/locations
PATCH  /api/admin/locations/:id
DELETE /api/admin/locations/:id

POST   /api/admin/subscription-plans
GET    /api/admin/subscription-plans
PATCH  /api/admin/subscription-plans/:id
DELETE /api/admin/subscription-plans/:id

GET    /api/loyalty
POST   /api/loyalty/redeem
GET    /api/loyalty/tiers
```

### 7.2 Modified Endpoints

```
POST /api/orders
  - Add: orderType (DELIVERY | PICKUP)
  - Add: locationId (optional, for pickup)
  - Change: addressId (optional if pickup)

POST /api/subscriptions
  - Add: planTemplateId (optional)
  - Add: isCustom (boolean)
```

---

## 8. Testing Considerations

### 8.1 Critical Test Cases

1. **Location Management:**
   - Create/update/delete locations
   - Location selection in checkout
   - Location-specific availability

2. **Pickup vs Delivery:**
   - Order creation with pickup (no address)
   - Order creation with delivery (address required)
   - Location selection for pickup

3. **Fixed Plans:**
   - Owner creates plan template
   - Consumer selects plan
   - Custom subscription still works

4. **Owner Mode:**
   - Consumer cannot access `/admin`
   - Owner can access via hidden entry
   - Role-based UI hiding works

5. **Loyalty:**
   - Points earned on order
   - Points displayed correctly
   - Tier progression

---

## 9. Documentation Updates Needed

1. Update `ARCHITECTURE.md` with:
   - Location model
   - Loyalty system
   - Fixed plans
   - Pickup support

2. Update `FEATURES.md` with:
   - Loyalty features
   - Location management
   - Fixed subscription plans

3. Update `PROJECT_STRUCTURE.md` with:
   - New API routes
   - New feature modules

---

## 10. Summary of Changes

### Database Schema Changes
- ✅ Add `Location` model
- ✅ Add `SubscriptionPlan` model
- ✅ Add loyalty models (LoyaltyPoints, LoyaltyTransaction, LoyaltyTier)
- ✅ Add `orderType` to Order
- ✅ Make `addressId` optional in Order
- ✅ Add `planTemplateId` to Subscription
- ✅ Add `isCustom` to Subscription

### Code Structure Changes
- ✅ New feature: `src/features/loyalty/`
- ✅ New admin pages: locations, subscription-plans
- ✅ Modified: checkout flow (location, order type)
- ✅ Modified: subscription flow (plan selection)
- ✅ Modified: navigation (hide owner mode)

### API Changes
- ✅ New: `/api/admin/locations/*`
- ✅ New: `/api/admin/subscription-plans/*`
- ✅ New: `/api/loyalty/*`
- ✅ Modified: `/api/orders` (orderType, locationId)
- ✅ Modified: `/api/subscriptions` (planTemplateId)

---

## Next Steps

1. **Review this analysis** with product team
2. **Prioritize phases** based on business needs
3. **Start with Phase 1** (Location + Pickup + Owner Hiding)
4. **Create detailed tickets** for each phase
5. **Plan data migrations** before schema changes

---

**End of Analysis**
