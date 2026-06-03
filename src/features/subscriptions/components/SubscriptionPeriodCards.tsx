'use client'

import { cn, formatPrice } from '@/lib/utils'
import { periodLabel, type SubscriptionConfig } from '@/lib/subscription-config'
import { formatGuestPeriodBadge, formatQuoteSavingsBadge } from '@/lib/subscription-offer-labels'
import type { PeriodQuote } from '@/features/subscriptions/lib/subscription-checkout-utils'

type Props = {
  config: SubscriptionConfig
  periods: number[]
  quotesByPeriod: Record<number, PeriodQuote | undefined>
  selectedPeriodDays: number
  onSelect: (days: number) => void
  compact?: boolean
}

/** Карточки периода: сетка без обрезки, бейдж = фактическая скидка из quote. */
export function SubscriptionPeriodCards({
  config,
  periods,
  quotesByPeriod,
  selectedPeriodDays,
  onSelect,
  compact,
}: Props) {
  const useGrid = periods.length <= 3

  return (
    <div
      className={cn(
        'overflow-visible',
        useGrid ? 'grid grid-cols-3 gap-2' : 'flex gap-2 overflow-x-auto overscroll-x-contain pb-1 pt-1'
      )}
    >
      {periods.map((d) => {
        const q = quotesByPeriod[d]
        const badge = q ? formatQuoteSavingsBadge(q) : formatGuestPeriodBadge(config.commerce, config.periodDiscounts, d)
        const sel = selectedPeriodDays === d
        const perDelivery =
          q && q.deliveriesInPeriod > 0 ? Math.round(q.guestPrice / q.deliveriesInPeriod) : null

        return (
          <button
            key={d}
            type="button"
            onClick={() => onSelect(d)}
            className={cn(
              'relative flex min-w-0 flex-col overflow-visible rounded-[var(--radius-large)] border text-left transition active:scale-[0.99]',
              compact ? 'px-2 py-2.5' : 'px-2.5 py-3',
              useGrid ? 'w-full' : 'w-[31%] min-w-[104px] shrink-0',
              sel
                ? 'border-[color:var(--text)] bg-[color:var(--text)] text-[color:var(--surface)]'
                : 'border-[color:var(--stroke)] bg-[color:var(--surface)]'
            )}
          >
            {badge ? (
              <span
                className={cn(
                  'absolute right-1 top-1 z-[2] rounded-full px-1.5 py-0.5 text-[9px] font-bold leading-none',
                  sel ? 'bg-[color:var(--accent)] text-white' : 'bg-[color:var(--accent)] text-white'
                )}
              >
                {badge}
              </span>
            ) : null}

            <span className={cn('pr-7 text-[12px] font-extrabold leading-tight', compact && 'text-[11px]')}>
              {periodLabel(d)}
            </span>

            <span className={cn('mt-0.5 text-[10px] leading-tight', sel ? 'opacity-80' : 'text-[color:var(--muted)]')}>
              {q && q.deliveriesInPeriod > 0 ? `${q.deliveriesInPeriod} доставок` : `${d} дн.`}
            </span>

            {q ? (
              <div className="mt-2 flex min-w-0 flex-col gap-0.5">
                <span className="text-[14px] font-extrabold tabular-nums leading-tight">
                  {formatPrice(q.guestPrice)}
                </span>
                {q.periodRetail > q.guestPrice ? (
                  <span
                    className={cn(
                      'text-[10px] tabular-nums line-through leading-tight',
                      sel ? 'opacity-60' : 'text-[color:var(--muted)]'
                    )}
                  >
                    {formatPrice(q.periodRetail)}
                  </span>
                ) : null}
                {perDelivery != null ? (
                  <span className={cn('text-[9px] leading-tight', sel ? 'opacity-70' : 'text-[color:var(--muted)]')}>
                    ≈ {formatPrice(perDelivery)}/дост.
                  </span>
                ) : null}
              </div>
            ) : (
              <span className={cn('mt-2 text-[10px]', sel ? 'opacity-70' : 'text-[color:var(--muted)]')}>…</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
