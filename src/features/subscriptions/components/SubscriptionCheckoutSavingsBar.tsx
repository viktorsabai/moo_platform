'use client'

import { formatPrice } from '@/lib/utils'
import type { PeriodQuote } from '@/features/subscriptions/lib/subscription-checkout-utils'

type Props = {
  quote: PeriodQuote | null | undefined
  totalPrice: number
}

/** Яркая выгода в липкой панели оформления. */
export function SubscriptionCheckoutSavingsBar({ quote, totalPrice }: Props) {
  if (!quote || quote.periodRetail <= totalPrice) {
    return (
      <div className="mb-2 text-center">
        <p className="text-[22px] font-extrabold tabular-nums leading-none">{formatPrice(totalPrice)}</p>
        <p className="mt-1 text-[11px] text-[color:var(--muted)]">итого за период</p>
      </div>
    )
  }

  const saved = Math.round(quote.periodRetail - totalPrice)
  const pct = Math.round(quote.guestSavingsPercent)

  return (
    <div className="mb-2.5 overflow-hidden rounded-[var(--radius-large)] border border-[color:var(--accent)]/30 bg-gradient-to-br from-[color:var(--accent)]/[0.14] to-[color:var(--surface)] px-3 py-2.5">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[color:var(--accent)]">ваша выгода</p>
          <p className="mt-0.5 text-[26px] font-extrabold tabular-nums leading-none text-[color:var(--text)]">
            −{formatPrice(saved)}
          </p>
          {pct > 0 ? (
            <p className="mt-1 text-[12px] font-bold text-[color:var(--muted)]">это −{pct}% от цены по меню</p>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] text-[color:var(--muted)]">было</p>
          <p className="text-[13px] font-semibold tabular-nums line-through opacity-60">{formatPrice(quote.periodRetail)}</p>
          <p className="mt-1 text-[10px] text-[color:var(--muted)]">сейчас</p>
          <p className="text-[18px] font-extrabold tabular-nums leading-tight">{formatPrice(totalPrice)}</p>
        </div>
      </div>
    </div>
  )
}
