# MOO Telegram Notification Matrix

## Product model

Telegram is the primary operating layer for the pilot. The Mini App is the workspace for rich actions, while the bot chat is the fast notification and command surface. Every notification must answer three questions: what happened, what requires attention, and which one-tap action opens the right context.

| Audience | Channel role | Typical actions |
|---|---|---|
| Guest | Confirmation, status and recovery messages | Open order, open payment/re-upload receipt, open subscription, return to menu |
| Owner/Admin/Staff | Operational queue and status controls | Confirm/reject order, review receipt, accept/reject subscription, open inbox/orders |
| Platform operator | Lead and integration alerts | Contact requester, open platform profile, investigate configuration |

## Event policy

| Event group | Guest | Owner team | Platform |
|---|---|---|---|
| Order created | Confirmation with order link | New order with status callbacks | — |
| Order status | Every meaningful status change | Operational status change where action is needed | — |
| Payment receipt | Confirmation/recovery | Receipt review with approve/reject | — |
| Subscription created/status | Confirmation and lifecycle update | Approval/review and delivery operations | — |
| Catering/service lead | Request accepted | New lead with date/guest count | Only platform business inquiry |
| Campaign/CRM | Explicit opt-in campaign or scenario | Campaign economics and delivery result | — |
| System/integration | `/start`, connection help | Bot/integration health | Business inquiry and failed delivery signal |

## Interaction contract

Messages should be short, specific and localized to the restaurant. The first line states the event, the second line states the next action, and inline buttons open either a precise Mini App route or a safe callback. Owner callbacks must remain idempotent and return a visible success/error response in Telegram. If the Mini App cannot open, the message must still contain the essential status and a recovery instruction.

## Current implementation coverage

The existing `src/lib/notification-registry.ts` is the source of truth for event IDs, audiences, triggers, handlers and target routes. Existing handlers cover orders, payment review, subscriptions, service leads, campaigns, CRM scenarios, `/start`, platform inquiries and exports. The current release block adds a separate catering landing route at `/catering`; restaurants can expose it through an optional Home Banner with that href, so it does not appear for venues that do not sell catering.

## Release smoke scenarios

| Scenario | Expected result |
|---|---|
| Guest opens bot and sends `/start` | Bot replies with Mini App button and correct restaurant context. |
| Guest creates order | Guest receives confirmation; owner team receives actionable new-order message. |
| Owner changes order status from Telegram callback | Owner receives callback acknowledgement; guest receives status update; repeated callback is state-idempotent. |
| Guest submits catering lead | Lead is stored; guest receives acknowledgement; owner receives lead with date, count and request context. |
| Owner opens catering CTA | `/catering` renders in the same visual system and CTA opens the existing lead form preselected to catering. |
| Owner has no catering banner | Catering route is not discoverable from the guest home surface unless the owner intentionally publishes a banner. |
| Telegram send fails | Backend logs a structured failure and the UI/API response exposes a retry or recovery path; business-critical state remains stored. |
