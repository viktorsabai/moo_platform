'use client'

import { cn, formatPrice } from '@/lib/utils'
import { periodLabel, type SubscriptionConfig } from '@/lib/subscription-config'
import { formatGuestPeriodBadge } from '@/lib/subscription-offer-labels'
import type { PeriodQuote } from '@/features/subscriptions/lib/subscription-checkout-utils'

type Props = {
  config: SubscriptionConfig
  periods: number[]
  quotesByPeriod: Record<number, PeriodQuote | undefined>
  selectedPeriodDays: number
  onSelect: (days: number) => void
  compact?: boolean
}

/** Карточки периода — единая вёрстка (цена и бейдж не ломаются на узком экране). */
export function SubscriptionPeriodCards({
  config,
  periods,
  quotesByPeriod,
  selectedPeriodDays,
  onSelect,
  compact,
}: Props) {
  return (
    <div className="-mx-0.5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {periods.map((d) => {
        const q = quotesByPeriod[d]
        const badge = formatGuestPeriodBadge(config.commerce, config.periodDiscounts, d)
        const sel = selectedPeriodDays === d
        return (
          <button
            key={d}
            type="button"
            onClick={() => onSelect(d)}
            className={cn(
              'relative flex shrink-0 flex-col rounded-[var(--radius-large)] border text-left transition active:scale-[0.99]',
              compact ? 'min-w-[108px] px-2.5 py-2.5' : 'min-w-[128px] px-3 py-3',
              sel
                ? 'border-[color:var(--text)] bg-[color:var(--text)] text-[color:var(--surface)]'
                : 'border-[color:var(--stroke)] bg-[color:var(--surface)]'
            )}
          >
            {badge ? (
              <span className="absolute -right-1 -top-1 z-[1] rounded-full bg-[color:var(--accent)] px-1.5 py-0.5 text-[9px] font-bold leading-none text-white">
                {badge}
              </span>
            ) : null}
            <span className="text-[13px] font-extrabold leading-tight">{periodLabel(d)}</span>
            <span className={cn('mt-0.5 text-[10px] leading-tight', sel ? 'opacity-80' : 'text-[color:var(--muted)]')}>
              {d} дн.
            </span>
            {q ? (
              <div className="mt-2 flex min-w-0 flex-col gap-0.5">
                <span className="text-[15px] font-extrabold tabular-nums leading-none whitespace-nowrap">
                  {formatPrice(q.guestPrice)}
                </span>
                {q.periodRetail > q.guestPrice ? (
                  <span
                    className={cn(
                      'text-[10px] tabular-nums line-through whitespace-nowrap',
                      sel ? 'opacity-60' : 'text-[color:var(--muted)]'
                    )}
                  >
                    {formatPrice(q.periodRetail)}
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
