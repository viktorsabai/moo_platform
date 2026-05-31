# MVP Smoke Report

Date: 2026-04-21

## Automated checks

- `npm run type-check` - PASS
- `npm run lint` - PASS (warnings only, no blocking errors)

## Implemented flows covered by code inspection

- Subscription unavailable CTA:
  - client placeholder + CTA submission implemented
  - API persists lead in DB table `SubscriptionRequestLead`
  - Telegram notification sent to OWNER/ADMIN/STAFF
- Delivery zones:
  - admin CRUD API implemented
  - checkout quote API implemented
  - checkout uses zone quote (fee, min order, delivery window)
- Order operations:
  - guarded status transitions enabled
  - status journal `OrderStatusLog` writes on create/update
  - bot callback status updates obey transition rules
- Notifications:
  - routing expanded to OWNER/ADMIN/STAFF
  - subscription request event integrated

## Manual smoke checklist before production

1. Seller side:
   - create at least 1 delivery zone in admin settings
   - create a store product and a menu dish
   - place test order from client and pass full status chain
2. Buyer side:
   - open mini app from Telegram
   - complete checkout with address in zone and verify quote
   - verify Telegram status updates after each admin action
3. Subscription CTA:
   - open subscriptions when disabled
   - send "Хочу подписку" request
   - verify lead insert and Telegram alert in owner/admin/staff chats

