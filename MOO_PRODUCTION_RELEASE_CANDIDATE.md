# MOO Production Release Candidate

**Prepared:** 2026-08-19  
**Candidate branch:** `test`  
**Candidate commit:** `2a5d2f9` plus the production webhook ledger changes in this release block  
**Target:** first single-tenant offline pilot restaurant

## Release scope

This candidate includes the completed order reliability, subscription lifecycle, menu/subscription synchronization, campaign contribution reporting, owner operations dashboard, Telegram WebView UX hardening, guest cart quick-add upsell, owner venue settings information architecture, and persistent Stripe webhook event ledger.

## Automated gate

| Check | Result |
|---|---|
| `npm run type-check` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS; Next.js compiled and generated 46 static pages |
| `git diff --check` | PASS |
| `npx prisma format` | PASS |
| `npx prisma generate` | PASS |
| Webhook migration SQL present | PASS; `20260819100000_add_webhook_event_ledger` |

## Production-only gates

These checks cannot be truthfully completed from the local sandbox because they require the pilot's Vercel environment and production database credentials.

| Gate | Required evidence before production |
|---|---|
| Database migration | `npm run db:migrate:prod` completes successfully; migration status is clean. |
| Database separation | Production `DATABASE_URL` is distinct from staging; no staging rows are reused. |
| Secrets | `BOT_TOKEN`/`TELEGRAM_BOT_TOKEN`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`/`APP_URL`, and owner notification IDs are configured in the production environment. |
| Health | Production `/api/health` returns HTTP 200 and `ready: true`. |
| Telegram | `@topka_demo_bot` opens the production Mini App URL and authenticates through Telegram WebView. |
| Stripe replay | A signed event is accepted once; replay returns `duplicate: true`; no duplicate state transition occurs. |
| Smoke | The unified staging matrix is executed against the production candidate with a pilot owner and a guest Telegram account. |
| Rollback | Previous known-good commit and deployment URL are recorded before promotion. |

## Promotion rule

Do not merge or deploy to `main` until the production-only gates are checked and the pilot owner confirms the candidate. The migration must run before application traffic is switched to the new deployment. If any gate fails, remain on `test`, preserve logs, and fix the blocker before promotion.

## Rollback rule

Rollback to the previous known-good deployment if health is not ready, Telegram authentication fails, order creation fails, payment review is unavailable, subscription quote/state is inconsistent, or tenant isolation is violated. Do not roll back by deleting migrations or resetting the production database.

## First pilot observation window

During the first operational window, monitor order creation and status transitions, payment webhook and receipt review, subscription requests and cutoff actions, Telegram notifications, menu sync events, and `WebhookEvent` records with `FAILED` status. Record the first successful test order and the release decision owner.
