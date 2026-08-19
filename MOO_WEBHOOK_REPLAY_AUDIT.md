# Webhook replay and idempotency audit

## Current controls

| Webhook | Current protection | Result |
|---|---|---|
| Stripe `payment_intent.succeeded` | Signature verification plus conditional `Order.updateMany` that excludes orders already marked `PAID`. | Replayed success event becomes a no-op and returns `replaySafe: true`, `updatedOrders: 0`. |
| Stripe `payment_intent.payment_failed` | Signature verification plus conditional update that excludes orders already marked `FAILED`. | Replayed failure event becomes a no-op. |
| Telegram order status callbacks | Callback handler checks order ownership/restaurant scope and validates current order status before transition. | Repeated button presses cannot apply an invalid second transition. |
| Telegram manual payment callbacks | Handler requires `UNDER_REVIEW` payment state before approve/reject. | Repeated `payok_*`/`payno_*` callbacks do not repeat the payment transition. |
| Telegram subscription callbacks | Handler checks subscription state and owner permissions before approve/reject. | Repeated callback delivery is state-safe. |
| Order creation | Unique `clientRequestId` and duplicate lookup before notification. | Client retries do not create duplicate orders or duplicate order-created notifications. |
| Subscription creation | Unique `clientRequestId` and stale quote validation. | Client retries are deduplicated and stale client quotes are rejected. |

## Remaining production hardening

Telegram `update_id` and Stripe `event.id` are not yet persisted in a dedicated webhook-event ledger. The current design is **state-idempotent** for the supported transitions, but it does not provide a durable audit trail for every received event or a cross-instance deduplication record. Before high-volume production usage, add a `WebhookEvent` table with provider, event ID/update ID, payload hash, receivedAt, processedAt, status, and error fields, protected by a provider/event unique constraint.

## Promotion rule

For the first pilot, state guards plus unique request IDs are acceptable for low volume only if operational logs are monitored. Do not promote to high-volume production until the persistent event ledger and replay dashboard are implemented.
