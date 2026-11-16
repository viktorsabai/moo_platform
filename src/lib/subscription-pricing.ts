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

/**
 * Почему корзину нельзя продать как рацион:
 * - missing_cost: у позиции нет себестоимости, защита от минуса не работает;
 * - no_guest_benefit: чтобы не уйти ниже мин. маржи, цена вышла бы выше «меню минус мин. выгода гостя».
 */
export type QuoteBlockReason = 'missing_cost' | 'no_guest_benefit'

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
  /** Ниже этой цены владелец уходит под мин. маржу. 0 — себестоимости нет. */
  floorPrice: number
  /** Выше этой цены у гостя нет минимальной выгоды против меню. */
  ceilingPrice: number
  /** false — такую корзину рационом не продаём. */
  offerable: boolean
  blockReason: QuoteBlockReason | null
}

export type GuestPriceInput = {
  /** Цена тех же позиций по меню за весь период. */
  periodRetail: number
  /** Себестоимость тех же позиций за весь период. 0 — неизвестна. */
  periodCost: number
  commerce: SubscriptionCommerceConfig
  /** Доп. скидка за длинный период, %. */
  periodDiscountPercent?: number
  /** Цена, которую владелец хочет вместо рассчитанной. */
  ownerPriceOverride?: number | null
  /** Шаг округления; по умолчанию из commerce. */
  roundTo?: number
}

export type GuestPriceResult = {
  guestPrice: number
  recommendedPrice: number
  floorPrice: number
  ceilingPrice: number
  totalDiscountPercent: number
  periodDiscountPercent: number
  offerable: boolean
  blockReason: QuoteBlockReason | null
}

function nearest(value: number, step: number): number {
  if (step <= 1) return Math.round(value)
  return Math.round(value / step) * step
}

function roundUp(value: number, step: number): number {
  if (step <= 1) return Math.ceil(value - 1e-9)
  return Math.ceil(value / step - 1e-9) * step
}

function roundDown(value: number, step: number): number {
  if (step <= 1) return Math.floor(value + 1e-9)
  return Math.floor(value / step + 1e-9) * step
}

/**
 * Единственное место, где считается цена для гостя. Инвариант:
 *   пол (себестоимость × (1 + мин. маржа))  ≤  цена  ≤  потолок (меню × (1 − мин. выгода гостя)).
 * Цена тянется к «меню минус скидка» и к целевой марже, но всегда остаётся между полом и потолком.
 * Если пол выше потолка или себестоимости нет — offerable=false.
 */
export function resolveGuestPrice(input: GuestPriceInput): GuestPriceResult {
  const { periodRetail, periodCost, commerce, ownerPriceOverride } = input
  const step = input.roundTo ?? commerce.priceRoundTo
  const extraPeriod = Math.max(0, Math.min(50, input.periodDiscountPercent ?? 0))
  const totalDiscountPercent = Math.min(90, commerce.subscriptionDiscountPercent + extraPeriod)
  const minGuestDiscount = Math.max(0, Math.min(90, commerce.minGuestDiscountPercent))

  const hasCost = periodCost > 0
  const floor = hasCost ? roundUp(periodCost * (1 + commerce.minMarginPercent / 100), step) : 0
  const ceiling = roundDown(periodRetail * (1 - minGuestDiscount / 100), step)

  const discounted = periodRetail * (1 - totalDiscountPercent / 100)
  const target = hasCost ? periodCost * (1 + commerce.targetMarginPercent / 100) * (1 - extraPeriod / 100) : 0
  const wanted =
    ownerPriceOverride != null && Number.isFinite(ownerPriceOverride) && ownerPriceOverride > 0
      ? ownerPriceOverride
      : Math.max(discounted, target)

  const recommendedPrice = Math.max(floor, Math.min(nearest(wanted, step), ceiling))

  let blockReason: QuoteBlockReason | null = null
  if (!hasCost) blockReason = 'missing_cost'
  else if (floor > ceiling) blockReason = 'no_guest_benefit'

  return {
    guestPrice: recommendedPrice,
    recommendedPrice,
    floorPrice: floor,
    ceilingPrice: ceiling,
    totalDiscountPercent,
    periodDiscountPercent: extraPeriod,
    offerable: blockReason == null,
    blockReason,
  }
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
    } else if (m.priceAdjust > 0) {
      // доплата без себестоимости — маржа по позиции неизвестна
      hasCost = false
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

  // Всё считаем сразу за период: розница и себестоимость одной и той же корзины.
  let periodRetail = 0
  let periodCost = 0
  let missingCostCount = 0

  if (jsDays && items.some((it) => it.dayOfWeek != null)) {
    let weekRetail = 0
    let weekCost = 0
    for (const jsDay of jsDays) {
      const sums = sumItemsRetailCost(itemsForJsDay(jsDay, items), persons, dishes, modifiers)
      weekRetail += sums.retail
      weekCost += sums.cost
      missingCostCount += sums.missingCostCount
    }
    periodRetail = weekRetail * weeksInPeriod
    periodCost = weekCost * weeksInPeriod
  } else {
    const sums = sumItemsRetailCost(items, persons, dishes, modifiers)
    periodRetail = sums.retail * deliveriesInPeriod
    periodCost = sums.cost * deliveriesInPeriod
    missingCostCount = sums.missingCostCount
  }

  const resolved = resolveGuestPrice({
    periodRetail,
    periodCost,
    commerce,
    periodDiscountPercent,
    ownerPriceOverride,
  })

  const guestPrice = resolved.guestPrice
  const ownerMargin = periodCost > 0 ? guestPrice - periodCost : 0
  const ownerMarginPercent = periodCost > 0 && guestPrice > 0 ? (ownerMargin / guestPrice) * 100 : 0
  const guestSavings = Math.max(0, periodRetail - guestPrice)
  /** Фактическая скидка vs меню (для бейджа на карточках — не путать с totalDiscountPercent из настроек). */
  const guestSavingsPercent = periodRetail > 0 ? (guestSavings / periodRetail) * 100 : 0

  return {
    perDeliveryRetail: Number((periodRetail / deliveriesInPeriod).toFixed(2)),
    perDeliveryCost: Number((periodCost / deliveriesInPeriod).toFixed(2)),
    periodRetail: Number(periodRetail.toFixed(2)),
    recommendedPrice: Number(resolved.recommendedPrice.toFixed(2)),
    guestPrice: Number(guestPrice.toFixed(2)),
    ownerMargin: Number(ownerMargin.toFixed(2)),
    ownerMarginPercent: Number(ownerMarginPercent.toFixed(2)),
    guestSavings: Number(guestSavings.toFixed(2)),
    guestSavingsPercent: Number(guestSavingsPercent.toFixed(2)),
    deliveriesInPeriod,
    missingCostCount,
    periodDiscountPercent: resolved.periodDiscountPercent,
    totalDiscountPercent: resolved.totalDiscountPercent,
    floorPrice: resolved.floorPrice,
    ceilingPrice: resolved.ceilingPrice,
    offerable: resolved.offerable && missingCostCount === 0,
    blockReason: resolved.blockReason ?? (missingCostCount > 0 ? 'missing_cost' : null),
  }
}
