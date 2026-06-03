'use client'

import { formatPrice } from '@/lib/utils'
import type { PeriodQuote } from '@/features/subscriptions/lib/subscription-checkout-utils'

type Props = {
  quote: PeriodQuote | null | undefined
  periodLabel: string
}

/** Наглядная выгода подписки — одна полоска вместо мелкого текста под карточками. */
export function SubscriptionSavingsStrip({ quote, periodLabel }: Props) {
  if (!quote || quote.periodRetail <= quote.guestPrice) return null
  const saved = Math.round(quote.periodRetail - quote.guestPrice)
  const perDelivery =
    quote.deliveriesInPeriod > 0 ? Math.round(quote.guestPrice / quote.deliveriesInPeriod) : null

  return (
    <div className="mb-3 flex items-center gap-3 rounded-[var(--radius-large)] border border-[color:var(--accent)]/25 bg-[color:var(--accent)]/[0.08] px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-extrabold leading-tight">выгода за {periodLabel.toLowerCase()}</p>
        <p className="text-[11px] text-[color:var(--muted)]">
          {perDelivery != null ? `≈ ${formatPrice(perDelivery)} за доставку` : 'доставка в цене'}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[18px] font-extrabold tabular-nums leading-none text-[color:var(--text)]">
          −{formatPrice(saved)}
        </p>
        {quote.guestSavingsPercent >= 0.5 ? (
          <p className="text-[10px] font-bold text-[color:var(--muted)]">−{Math.round(quote.guestSavingsPercent)}%</p>
        ) : null}
      </div>
    </div>
  )
}
