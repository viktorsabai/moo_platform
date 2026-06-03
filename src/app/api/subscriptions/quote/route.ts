import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getConsumerRestaurantId } from '@/lib/restaurant-context'
import { loadSubscriptionConfig } from '@/lib/subscription-config-load'
import { prisma } from '@/lib/prisma'
import { getPeriodDiscountPercent } from '@/lib/subscription-config'
import { calculateSubscriptionQuote } from '@/lib/subscription-pricing'
import { parseMealSlot } from '@/lib/subscription-meal-slots'
import { validateSubscriptionItemsByMealSlots } from '@/lib/subscription-meal-slot-rules'
import { resolveApiUser } from '@/lib/tg-auth-resolver'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    await resolveApiUser(headers())
    const restaurantId = await getConsumerRestaurantId()
    const settings = await prisma.appSettings.findUnique({
      where: { restaurantId },
      select: { subscriptionEnabled: true },
    })
    if (!settings?.subscriptionEnabled) {
      return NextResponse.json({ ok: false, error: 'Подписки отключены' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const config = await loadSubscriptionConfig(restaurantId)

    const rawItems = Array.isArray(body?.items) ? body.items : []
    const items = rawItems
      .map((it: any) => {
        const dw = it?.dayOfWeek
        const dayOfWeek =
          dw === null || typeof dw === 'undefined'
            ? null
            : Number(dw) >= 0 && Number(dw) <= 6
              ? Number(dw)
              : null
        return {
          dishId: String(it?.dishId || ''),
          quantity: Number(it?.quantity ?? 1),
          mealSlot: parseMealSlot(it?.mealSlot),
          modifierIds: Array.isArray(it?.modifierIds) ? it.modifierIds.filter((x: any) => typeof x === 'string') : [],
          dayOfWeek,
        }
      })
      .filter((it: { dishId: string; quantity: number }) => it.dishId && it.quantity > 0)

    const deliveryDaysRaw = Array.isArray(body?.deliveryDays) ? body.deliveryDays : []
    const deliveryDaysJs = Array.from(
      new Set(
        (deliveryDaysRaw as unknown[])
          .map((n) => Number(n))
          .filter((n) => Number.isFinite(n) && n >= 0 && n <= 6)
      )
    )
    const deliveryDaysPerWeek = deliveryDaysJs.length || config.minDaysPerWeek
    const periodDays = Number(body?.periodDays ?? config.defaultPeriodDays)
    const personCount = Number(body?.personCount ?? 1)

    const dishIds = [...new Set(items.map((it: { dishId: string }) => it.dishId))] as string[]
    const modIds = [...new Set(items.flatMap((it: { modifierIds: string[] }) => it.modifierIds))] as string[]

    const [dishes, modifiers, optionLinks] = await Promise.all([
      prisma.dish.findMany({
        where: { restaurantId, id: { in: dishIds } },
        select: { id: true, price: true, costPrice: true, subscriptionEligible: true, isAvailable: true },
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

    const eligibleIds = new Set(
      dishes.filter((d) => d.isAvailable && d.subscriptionEligible).map((d) => d.id)
    )
    const validation = validateSubscriptionItemsByMealSlots(items, config, eligibleIds, deliveryDaysJs)
    if (!validation.valid) {
      return NextResponse.json({ ok: false, error: validation.error }, { status: 400 })
    }

    if (deliveryDaysPerWeek < config.minDaysPerWeek || deliveryDaysPerWeek > config.maxDaysPerWeek) {
      return NextResponse.json(
        { ok: false, error: `Дней доставки: от ${config.minDaysPerWeek} до ${config.maxDaysPerWeek}.` },
        { status: 400 }
      )
    }

    const persons = Math.max(config.minPersons, Math.min(config.maxPersons, personCount))

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
    })

    return NextResponse.json({ ok: true, quote, guestPrice: quote.guestPrice, periodDays, personCount: persons })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 })
  }
}
