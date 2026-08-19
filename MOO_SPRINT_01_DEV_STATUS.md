# MOO Sprint 01 — development status

## Completed in current slice

В forced single-tenant режиме guest consumer reads больше не доверяют client-supplied restaurant header/cookie. Telegram initData HMAC comparison использует timing-safe сравнение в `src/lib/auth.ts` и `src/lib/tg-auth-resolver.ts`.

Также исправлены compile blockers в store tags, menu option IDs, subscription delivery dish typing, favorites headers, subscription checkout duplicate/unused prop flow. Guest delivery quote state выровнен с shared `DeliveryQuoteResult` domain type.

## Quality gate

| Check | Result |
|---|---|
| `npm ci` | PASS |
| `npm run type-check` | PASS; 0 TypeScript errors |
| `npm run lint` | PASS; warnings only |
| `npm run build` | PASS; Next.js compiled successfully |
| `git diff --check` | PASS |

## Remaining warnings

Lint сообщает существующие non-blocking React hook dependency warnings и `img` optimization warnings. Они не блокируют текущий P0 compile/build gate и вынесены в отдельный backlog.

## Next implementation slice

Первым следующим вертикальным срезом остаются owner settings acceptance для open/closed, delivery zones и одного payment method. Затем нужно добавить checkout/order E2E smoke coverage с idempotency и stale-cart cases, проверить payment/receipt state transitions и owner order actions, после чего пройти role и cross-tenant negative tests перед pilot deployment.
