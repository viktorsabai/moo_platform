import {
  getPeriodDiscountPercent,
  periodLabel,
  type SubscriptionCommerceConfig,
  type SubscriptionConfig,
} from '@/lib/subscription-config'

/** Суммарная скидка гостя: базовая + за длинный период (как в pricing engine). */
export function totalSubscriptionDiscountPercent(
  commerce: SubscriptionCommerceConfig,
  periodDiscounts: SubscriptionConfig['periodDiscounts'],
  periodDays: number
): number {
  const extra = getPeriodDiscountPercent(periodDiscounts, periodDays)
  return Math.min(90, commerce.subscriptionDiscountPercent + extra)
}

export function formatGuestPeriodBadge(
  commerce: SubscriptionCommerceConfig,
  periodDiscounts: SubscriptionConfig['periodDiscounts'],
  periodDays: number
): string | null {
  const total = totalSubscriptionDiscountPercent(commerce, periodDiscounts, periodDays)
  if (total <= 0) return null
  return `−${Math.round(total)}%`
}

/** Бейдж на карточке периода — из того же quote, что цена и зачёркнутая сумма. */
/** Доп. скидка только за длину периода (для подписи на карточке). */
export function formatPeriodExtraLabel(
  periodDiscounts: SubscriptionConfig['periodDiscounts'],
  periodDays: number
): string | null {
  const extra = getPeriodDiscountPercent(periodDiscounts, periodDays)
  if (extra <= 0) return null
  return `ещё −${Math.round(extra)}% за ${periodLabel(periodDays).toLowerCase()}`
}

export function formatQuoteSavingsBadge(quote: {
  periodRetail: number
  guestPrice: number
  guestSavingsPercent: number
}): string | null {
  if (quote.periodRetail <= quote.guestPrice || quote.guestSavingsPercent < 0.5) return null
  return `−${Math.round(quote.guestSavingsPercent)}%`
}

/** Подпись под бейджем / у слайдера в админке — та же логика, что у гостя. */
export function formatPeriodDiscountBreakdown(
  commerce: SubscriptionCommerceConfig,
  periodDiscounts: SubscriptionConfig['periodDiscounts'],
  periodDays: number
): string {
  const base = commerce.subscriptionDiscountPercent
  const extra = getPeriodDiscountPercent(periodDiscounts, periodDays)
  if (extra <= 0) return `гость: до −${Math.round(base)}%`
  const total = totalSubscriptionDiscountPercent(commerce, periodDiscounts, periodDays)
  return `гость: −${Math.round(base)}% + −${Math.round(extra)}% = до −${Math.round(total)}%`
}
