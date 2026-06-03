import type { SubscriptionCommerceConfig } from '@/lib/subscription-config'

export type DeliveryPriceVerdict = 'good' | 'low' | 'loss' | 'unknown'

export type DeliveryPricePreview = {
  retail: number
  guest: number
  profit: number | null
  marginPercent: number | null
  minGuest: number | null
  verdict: DeliveryPriceVerdict
  verdictLabel: string
  hasCost: boolean
}

/** Одна доставка, одно блюдо — та же логика, что в pricing engine. */
export function previewOneDeliveryPrice(
  retail: number,
  cost: number | null,
  commerce: SubscriptionCommerceConfig
): DeliveryPricePreview {
  const c = cost != null && cost > 0 ? cost : 0
  const byDiscount = retail * (1 - commerce.subscriptionDiscountPercent / 100)
  const byMargin = c > 0 ? c * (1 + commerce.targetMarginPercent / 100) : 0
  const floor = c > 0 ? c * (1 + commerce.minMarginPercent / 100) : 0
  const minGuest = c > 0 ? Math.round(Math.max(byMargin, floor)) : null
  let guest = Math.max(byDiscount, byMargin, floor, 0)
  guest = Math.round(guest)
  const profit = c > 0 ? guest - c : null
  const marginPercent = profit != null && guest > 0 ? (profit / guest) * 100 : null

  let verdict: DeliveryPriceVerdict = 'unknown'
  let verdictLabel = 'Укажите себестоимость в меню — покажем, не в убыток ли скидка (необязательно).'

  if (c > 0) {
    if (guest < c) {
      verdict = 'loss'
      verdictLabel = 'Ниже себестоимости — вы в минусе'
    } else if (marginPercent != null && marginPercent < commerce.minMarginPercent) {
      verdict = 'low'
      verdictLabel = 'Мало зарабатываете — поднимите цену или снизьте скидку'
    } else {
      verdict = 'good'
      verdictLabel = 'С этой скидкой на этом блюде вы в плюсе'
    }
  }

  return {
    retail,
    guest,
    profit,
    marginPercent,
    minGuest,
    verdict,
    verdictLabel,
    hasCost: c > 0,
  }
}

/** Какую скидку поставить, чтобы гость платил ~targetGuest (с учётом пола по себестоимости). */
export function discountForTargetGuestPrice(
  retail: number,
  cost: number | null,
  targetGuest: number,
  commerce: SubscriptionCommerceConfig
): { discountPercent: number; preview: DeliveryPricePreview } {
  if (retail <= 0) {
    return {
      discountPercent: commerce.subscriptionDiscountPercent,
      preview: previewOneDeliveryPrice(retail, cost, commerce),
    }
  }

  let discount = Math.round((1 - targetGuest / retail) * 100)
  discount = Math.max(0, Math.min(40, discount))

  const trial = previewOneDeliveryPrice(retail, cost, {
    ...commerce,
    subscriptionDiscountPercent: discount,
  })

  return { discountPercent: discount, preview: trial }
}

export function verdictStyles(verdict: DeliveryPriceVerdict) {
  switch (verdict) {
    case 'good':
      return {
        wrap: 'border-emerald-200 bg-emerald-50 text-emerald-950',
        dot: 'bg-emerald-500',
      }
    case 'low':
      return {
        wrap: 'border-amber-200 bg-amber-50 text-amber-950',
        dot: 'bg-amber-500',
      }
    case 'loss':
      return {
        wrap: 'border-red-200 bg-red-50 text-red-950',
        dot: 'bg-red-500',
      }
    default:
      return {
        wrap: 'border-[color:var(--stroke)] bg-black/[0.03] text-[color:var(--muted)]',
        dot: 'bg-[color:var(--muted)]',
      }
  }
}

/** Один слайдер «за месяц» → 7/14/28 дней автоматически. */
export function periodDiscountsFromMonthBonus(monthBonus: number): Record<number, number> {
  const m = Math.max(0, Math.min(20, Math.round(monthBonus)))
  return { 7: 0, 14: Math.round(m / 2), 28: m }
}

export function monthBonusFromPeriodDiscounts(periodDiscounts: Record<number, number> | undefined): number {
  return periodDiscounts?.[28] ?? 0
}
