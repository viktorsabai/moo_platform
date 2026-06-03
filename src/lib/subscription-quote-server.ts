import { prisma } from '@/lib/prisma'
import { getPeriodDiscountPercent } from '@/lib/subscription-config'
import { loadSubscriptionConfig } from '@/lib/subscription-config-load'
import { parseMealSlot, type MealSlot } from '@/lib/subscription-meal-slots'
import { calculateSubscriptionQuote, type SubscriptionQuoteResult } from '@/lib/subscription-pricing'

export type QuoteLineInput = {
  dishId: string
  quantity: number
  mealSlot?: MealSlot | string | null
  modifierIds?: string[]
  dayOfWeek?: number | null
}

export async function computeSubscriptionQuoteForRestaurant(
  restaurantId: string,
  input: {
    items: QuoteLineInput[]
    deliveryDays: number[]
    periodDays: number
    personCount: number
  }
): Promise<{ quote: SubscriptionQuoteResult; config: Awaited<ReturnType<typeof loadSubscriptionConfig>> } | null> {
  const config = await loadSubscriptionConfig(restaurantId)
  const items = input.items
    .map((it) => ({
      dishId: String(it.dishId || ''),
      quantity: Math.max(1, Number(it.quantity ?? 1)),
      mealSlot: parseMealSlot(it.mealSlot),
      modifierIds: Array.isArray(it.modifierIds) ? it.modifierIds.filter((x) => typeof x === 'string') : [],
      dayOfWeek:
        it.dayOfWeek === null || typeof it.dayOfWeek === 'undefined'
          ? null
          : Number(it.dayOfWeek) >= 0 && Number(it.dayOfWeek) <= 6
            ? Number(it.dayOfWeek)
            : null,
    }))
    .filter((it) => it.dishId && it.quantity > 0)

  if (!items.length) return null

  const dishIds = [...new Set(items.map((it) => it.dishId))]
  const modIds = [...new Set(items.flatMap((it) => it.modifierIds))]

  const [dishes, modifiers, optionLinks] = await Promise.all([
    prisma.dish.findMany({
      where: { restaurantId, id: { in: dishIds } },
      select: { id: true, price: true, costPrice: true },
    }),
    prisma.dishModifier.findMany({
      where: { id: { in: modIds }, dish: { restaurantId } },
      select: { id: true, priceAdjust: true, costPrice: true, subscriptionEligible: true },
    }),
    prisma.dishOptionValue.findMany({
      where: { restaurantId, optionValueId: { in: modIds } },
      select: { optionValueId: true, priceAdjust: true, costPrice: true, subscriptionEligible: true },
    }),
  ])

  const dishMap = new Map(
    dishes.map((d) => [d.id, { id: d.id, price: Number(d.price), costPrice: d.costPrice == null ? null : Number(d.costPrice) }])
  )
  const modMap = new Map<string, { id: string; priceAdjust: number; costPrice: number | null }>()
  for (const m of modifiers) {
    if (m.subscriptionEligible === false) continue
    modMap.set(m.id, { id: m.id, priceAdjust: Number(m.priceAdjust), costPrice: m.costPrice == null ? null : Number(m.costPrice) })
  }
  for (const o of optionLinks) {
    if (o.subscriptionEligible === false) continue
    modMap.set(o.optionValueId, {
      id: o.optionValueId,
      priceAdjust: Number(o.priceAdjust),
      costPrice: o.costPrice == null ? null : Number(o.costPrice),
    })
  }

  const deliveryDaysJs = [...new Set(input.deliveryDays.filter((d) => d >= 0 && d <= 6))].sort((a, b) => a - b)
  const deliveryDaysPerWeek = deliveryDaysJs.length || config.minDaysPerWeek
  const persons = Math.max(config.minPersons, Math.min(config.maxPersons, Math.round(input.personCount)))
  const periodDays = config.availablePeriods.includes(input.periodDays) ? input.periodDays : config.defaultPeriodDays

  const quote = calculateSubscriptionQuote({
    items,
    deliveryDaysPerWeek,
    deliveryDaysJs,
    periodDays,
    personCount: persons,
    commerce: config.commerce,
    dishes: dishMap,
    modifiers: modMap,
    periodDiscountPercent: getPeriodDiscountPercent(config.periodDiscounts, periodDays),
    ownerPriceOverride: config.ownerPriceOverride ?? null,
  })

  return { quote, config }
}
