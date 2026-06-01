import {
  getPeriodDiscountPercent,
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
