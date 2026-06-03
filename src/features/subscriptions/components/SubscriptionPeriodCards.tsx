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

/** Карточки периода — компактно: цена, зачёркнутое, бейдж. */
export function SubscriptionPeriodCards({
  config,
  periods,
  quotesByPeriod,
  selectedPeriodDays,
  onSelect,
  compact,
}: Props) {
  return (
    <div className="grid grid-cols-3 gap-2 overflow-visible">
      {periods.map((d) => {
        const q = quotesByPeriod[d]
        const badge = q ? formatQuoteSavingsBadge(q) : formatGuestPeriodBadge(config.commerce, config.periodDiscounts, d)
        const sel = selectedPeriodDays === d

        return (
          <button
            key={d}
            type="button"
            onClick={() => onSelect(d)}
            className={cn(
              'relative flex min-w-0 flex-col rounded-[var(--radius-large)] border px-2 py-2.5 text-left transition active:scale-[0.99]',
              compact && 'py-2',
              sel
                ? 'border-[color:var(--text)] bg-[color:var(--text)] text-[color:var(--surface)]'
                : 'border-[color:var(--stroke)] bg-[color:var(--surface)]'
            )}
          >
            {badge ? (
              <span className="absolute -right-1 -top-1 z-[2] rounded-full bg-[color:var(--accent)] px-1.5 py-0.5 text-[9px] font-bold text-white">
                {badge}
              </span>
            ) : null}

            <span className={cn('text-[11px] font-extrabold leading-tight', compact && 'text-[10px]')}>
              {periodLabel(d)}
            </span>
            {q && q.deliveriesInPeriod > 0 ? (
              <span className={cn('text-[9px] leading-tight', sel ? 'opacity-75' : 'text-[color:var(--muted)]')}>
                {q.deliveriesInPeriod} дост.
              </span>
            ) : null}

            {q ? (
              <div className="mt-1.5 min-w-0">
                <span className="block text-[15px] font-extrabold tabular-nums leading-tight">{formatPrice(q.guestPrice)}</span>
                {q.periodRetail > q.guestPrice ? (
                  <span className={cn('text-[9px] tabular-nums line-through', sel ? 'opacity-55' : 'text-[color:var(--muted)]')}>
                    {formatPrice(q.periodRetail)}
                  </span>
                ) : null}
              </div>
            ) : (
              <span className={cn('mt-1.5 text-[10px]', sel ? 'opacity-70' : 'text-[color:var(--muted)]')}>…</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
