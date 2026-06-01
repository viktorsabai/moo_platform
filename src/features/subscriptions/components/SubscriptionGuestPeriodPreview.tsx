'use client'

import { cn, formatPrice } from '@/lib/utils'
import { periodLabel, type SubscriptionConfig } from '@/lib/subscription-config'
import {
  formatGuestPeriodBadge,
  formatPeriodDiscountBreakdown,
} from '@/lib/subscription-offer-labels'
import type { PeriodQuote } from '@/features/subscriptions/lib/subscription-checkout-utils'

type Props = {
  config: SubscriptionConfig
  quotesByPeriod?: Record<number, PeriodQuote | undefined>
  selectedPeriodDays?: number
  compact?: boolean
  title?: string
}

/** Мини-карточки периодов — одинаковый вид в админке и у гостя. */
export function SubscriptionGuestPeriodPreview({
  config,
  quotesByPeriod,
  selectedPeriodDays,
  compact,
  title = 'как увидит гость',
}: Props) {
  const periods = config.availablePeriods ?? [7, 14, 28]

  return (
    <div className={cn(compact ? 'mt-3' : 'mt-4')}>
      <p className="text-[12px] font-bold text-[color:var(--muted)]">{title}</p>
      <div className="-mx-0.5 mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {periods.map((d) => {
          const badge = formatGuestPeriodBadge(config.commerce, config.periodDiscounts, d)
          const sel = selectedPeriodDays === d
          const q = quotesByPeriod?.[d]
          return (
            <div
              key={d}
              className={cn(
                'relative flex w-[108px] shrink-0 flex-col rounded-[var(--radius-large)] border px-2.5 py-2.5',
                sel ? 'border-[color:var(--text)] bg-[color:var(--text)] text-[color:var(--surface)]' : 'border-[color:var(--stroke)] bg-[color:var(--surface)]'
              )}
            >
              {badge ? (
                <span className="absolute -right-1 -top-1 rounded-full bg-[color:var(--accent)] px-1.5 py-0.5 text-[9px] font-bold text-white">
                  {badge}
                </span>
              ) : null}
              <span className="text-[13px] font-extrabold">{periodLabel(d)}</span>
              {q ? (
                <span className="mt-1 text-[13px] font-extrabold tabular-nums">{formatPrice(q.guestPrice)}</span>
              ) : (
                <span className="mt-1 text-[10px] opacity-70 leading-tight">
                  {formatPeriodDiscountBreakdown(config.commerce, config.periodDiscounts, d)}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
