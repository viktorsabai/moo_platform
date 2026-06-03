'use client'

import { formatPrice } from '@/lib/utils'
import type { PeriodQuote } from '@/features/subscriptions/lib/subscription-checkout-utils'

type Props = {
  quote: PeriodQuote | null | undefined
  periodLabel: string
}

/** Выгода над карточками периода — крупно и заметно. */
export function SubscriptionSavingsStrip({ quote, periodLabel }: Props) {
  if (!quote || quote.periodRetail <= quote.guestPrice) return null
  const saved = Math.round(quote.periodRetail - quote.guestPrice)
  const pct = Math.round(quote.guestSavingsPercent)

  return (
    <div className="mb-3 rounded-[var(--radius-large)] border-2 border-[color:var(--accent)]/35 bg-[color:var(--accent)]/[0.1] px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-[color:var(--accent)]">экономия</p>
          <p className="text-[22px] font-extrabold tabular-nums leading-tight">−{formatPrice(saved)}</p>
        </div>
        {pct > 0 ? (
          <span className="rounded-full bg-[color:var(--accent)] px-3 py-1.5 text-[14px] font-extrabold text-white">
            −{pct}%
          </span>
        ) : null}
      </div>
      <p className="mt-1.5 text-[11px] text-[color:var(--muted)]">
        за {periodLabel.toLowerCase()} · доставка в цене · меню без доплат
      </p>
    </div>
  )
}
