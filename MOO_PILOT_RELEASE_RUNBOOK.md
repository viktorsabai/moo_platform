# MOO Platform — Pilot Release Runbook

## Scope

This runbook defines the minimum operational sequence for promoting the Telegram Mini App from `test` to `main` for the first pilot restaurant. The pilot must use an isolated database and storage namespace; production promotion must never reuse staging data implicitly.

## Pre-release checks

| Check | Required result |
|---|---|
| Git | `test` is green and the exact commit intended for promotion is identified. |
| Quality gate | `npm run type-check`, `npm run lint`, `npm run build`, and `git diff --check` pass. |
| Health | `GET /api/health` returns `200`, `ready: true`, expected environment and commit. |
| Database | Prisma client is generated; migrations are applied to the target database; no destructive reset is used against pilot data. |
| Readiness | Owner `/api/admin/readiness` has no blocking checks for the pilot restaurant. |
| Telegram | Bot opens the expected Mini App URL and sends a valid Telegram init context. |
| Payments | At least one enabled manual/payment method is configured and its instructions/QR are visible. |
| Operations | Owner can see orders, approve/reject payment receipts, and review subscription requests. |

## Pilot onboarding sequence

1. Create or confirm the production restaurant record and owner access.
2. Configure restaurant name, address, operating hours, delivery zones, payment methods and notification recipients.
3. Add categories and dishes. Mark only real pilot dishes as available and subscription-eligible where applicable.
4. Configure subscription templates, prices, cadence, delivery days and economics. Review cost completeness and margin warnings.
5. Configure campaigns only after the base catalog and payment flow are ready. Do not activate a public promo without a valid period and code when the mechanic is `PROMOCODE`.
6. Open the guest preview and verify menu, cart, checkout, pickup/delivery selection, payment instructions and subscription offer.
7. Run the smoke matrix once with the pilot owner and once with a guest Telegram account.

## Promotion checks

The promotion candidate is the exact commit that passed the `test` quality gate. Confirm the target Vercel environment is connected to `main`, then deploy without changing application code during the promotion window. Verify `/api/health` after deployment and compare the reported commit with the intended candidate.

## Rollback criteria

Rollback to the previous known-good commit if `/api/health` is not ready, guest authentication fails, orders cannot be created, payment receipt review is unavailable, subscription creation produces a stale or incorrect quote, or owner/guest tenant isolation is violated. Preserve logs and the failing smoke step before rollback.

## Post-release observation

For the first pilot window, monitor order creation, payment review, Telegram notification delivery, subscription status transitions, and realtime sync errors. Any failed operation must have a visible recovery path for the user and an owner-visible operational signal.
