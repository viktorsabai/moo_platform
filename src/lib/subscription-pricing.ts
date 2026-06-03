import type { SubscriptionCommerceConfig } from '@/lib/subscription-config'
import type { SubscriptionItemInput } from '@/lib/subscription-meal-slot-rules'

export type DishPricingRow = {
  id: string
  price: number
  costPrice: number | null
}

export type ModifierPricingRow = {
  id: string
  priceAdjust: number
  costPrice: number | null
}

export type SubscriptionQuoteInput = {
  items: SubscriptionItemInput[]
  deliveryDaysPerWeek: number
  /** JS weekdays 0–6; если задан — цена считается по меню каждого дня отдельно. */
  deliveryDaysJs?: number[]
  periodDays: number
  personCount: number
  commerce: SubscriptionCommerceConfig
  dishes: Map<string, DishPricingRow>
  modifiers: Map<string, ModifierPricingRow>
  /** Extra discount % for longer billing period (stacked with subscriptionDiscountPercent). */
  periodDiscountPercent?: number
  ownerPriceOverride?: number | null
}

export type SubscriptionQuoteResult = {
  perDeliveryRetail: number
  perDeliveryCost: number
  periodRetail: number
  recommendedPrice: number
  guestPrice: number
  ownerMargin: number
  ownerMarginPercent: number
  guestSavings: number
  guestSavingsPercent: number
  deliveriesInPeriod: number
  missingCostCount: number
  periodDiscountPercent: number
  totalDiscountPercent: number
}

function roundPrice(value: number, roundTo: number): number {
  if (roundTo <= 0) return Math.round(value)
  return Math.round(value / roundTo) * roundTo
}

function lineUnit(
  dish: DishPricingRow | undefined,
  modifierIds: string[],
  modifiers: Map<string, ModifierPricingRow>
): { retail: number; cost: number; hasCost: boolean } {
  if (!dish) return { retail: 0, cost: 0, hasCost: false }
  let retail = dish.price
  let cost = dish.costPrice ?? 0
  let hasCost = dish.costPrice != null && dish.costPrice > 0
  for (const id of modifierIds) {
    const m = modifiers.get(id)
    if (!m) continue
    retail += m.priceAdjust
    if (m.costPrice != null && m.costPrice > 0) {
      cost += m.costPrice
      hasCost = true
    }
  }
  return { retail, cost, hasCost }
}

function itemsForJsDay(jsDay: number, items: SubscriptionItemInput[]): SubscriptionItemInput[] {
  const hasPerDay = items.some((it) => it.dayOfWeek != null)
  if (!hasPerDay) return items
  return items.filter((it) => it.dayOfWeek == null || it.dayOfWeek === jsDay)
}

function sumItemsRetailCost(
  dayItems: SubscriptionItemInput[],
  persons: number,
  dishes: Map<string, DishPricingRow>,
  modifiers: Map<string, ModifierPricingRow>
) {
  let retail = 0
  let cost = 0
  let missingCostCount = 0
  for (const it of dayItems) {
    const dish = dishes.get(it.dishId)
    const unit = lineUnit(dish, it.modifierIds ?? [], modifiers)
    if (!unit.hasCost) missingCostCount += 1
    const qty = Math.max(0, it.quantity) * persons
    retail += unit.retail * qty
    cost += unit.cost * qty
  }
  return { retail, cost, missingCostCount }
}

export function calculateSubscriptionQuote(input: SubscriptionQuoteInput): SubscriptionQuoteResult {
  const {
    items,
    deliveryDaysPerWeek,
    deliveryDaysJs,
    periodDays,
    personCount,
    commerce,
    dishes,
    modifiers,
    periodDiscountPercent = 0,
    ownerPriceOverride,
  } = input

  const persons = Math.max(1, personCount)
  const jsDays =
    deliveryDaysJs && deliveryDaysJs.length > 0
      ? [...new Set(deliveryDaysJs.filter((d) => d >= 0 && d <= 6))].sort((a, b) => a - b)
      : null
  const daysPerWeek = jsDays?.length ?? Math.max(1, Math.min(7, deliveryDaysPerWeek))
  const weeksInPeriod = periodDays / 7
  const deliveriesInPeriod = Math.max(1, Math.round(daysPerWeek * weeksInPeriod))

  let perDeliveryRetail = 0
  let perDeliveryCost = 0
  let missingCostCount = 0
  let periodRetail = 0

  if (jsDays && items.some((it) => it.dayOfWeek != null)) {
    for (let w = 0; w < weeksInPeriod; w++) {
      for (const jsDay of jsDays) {
        const dayItems = itemsForJsDay(jsDay, items)
        const sums = sumItemsRetailCost(dayItems, persons, dishes, modifiers)
        periodRetail += sums.retail
        perDeliveryCost += sums.cost
        missingCostCount += sums.missingCostCount
      }
    }
    perDeliveryRetail = deliveriesInPeriod > 0 ? periodRetail / deliveriesInPeriod : 0
  } else {
    const sums = sumItemsRetailCost(items, persons, dishes, modifiers)
    perDeliveryRetail = sums.retail
    perDeliveryCost = sums.cost
    missingCostCount = sums.missingCostCount
    periodRetail = perDeliveryRetail * deliveriesInPeriod
  }

  const costBased =
    perDeliveryCost > 0
      ? perDeliveryCost * (1 + commerce.targetMarginPercent / 100) * deliveriesInPeriod
      : 0
  const extraPeriod = Math.max(0, Math.min(50, periodDiscountPercent))
  const totalDiscountPercent = Math.min(90, commerce.subscriptionDiscountPercent + extraPeriod)
  const discountBased = periodRetail * (1 - totalDiscountPercent / 100)

  let recommended = costBased > 0 && discountBased > 0 ? Math.max(costBased, discountBased) : costBased || discountBased || periodRetail
  if (perDeliveryCost > 0) {
    const minPrice = perDeliveryCost * (1 + commerce.minMarginPercent / 100) * deliveriesInPeriod
    recommended = Math.max(recommended, minPrice)
  }
  recommended = roundPrice(recommended, commerce.priceRoundTo)

  let guestPrice = recommended
  if (ownerPriceOverride != null && Number.isFinite(ownerPriceOverride) && ownerPriceOverride > 0) {
    guestPrice = roundPrice(ownerPriceOverride, commerce.priceRoundTo)
    const minPrice =
      perDeliveryCost > 0
        ? roundPrice(perDeliveryCost * (1 + commerce.minMarginPercent / 100) * deliveriesInPeriod, commerce.priceRoundTo)
        : 0
    if (minPrice > 0) guestPrice = Math.max(guestPrice, minPrice)
  }

  const totalCost = perDeliveryCost * deliveriesInPeriod
  const ownerMargin = guestPrice - totalCost
  const ownerMarginPercent = guestPrice > 0 ? (ownerMargin / guestPrice) * 100 : 0
  const guestSavings = Math.max(0, periodRetail - guestPrice)
  const guestSavingsPercent = periodRetail > 0 ? (guestSavings / periodRetail) * 100 : 0

  return {
    perDeliveryRetail: Number(perDeliveryRetail.toFixed(2)),
    perDeliveryCost: Number(perDeliveryCost.toFixed(2)),
    periodRetail: Number(periodRetail.toFixed(2)),
    recommendedPrice: Number(recommended.toFixed(2)),
    guestPrice: Number(guestPrice.toFixed(2)),
    ownerMargin: Number(ownerMargin.toFixed(2)),
    ownerMarginPercent: Number(ownerMarginPercent.toFixed(2)),
    guestSavings: Number(guestSavings.toFixed(2)),
    guestSavingsPercent: Number(guestSavingsPercent.toFixed(2)),
    deliveriesInPeriod,
    missingCostCount,
    periodDiscountPercent: extraPeriod,
    totalDiscountPercent,
  }
}
