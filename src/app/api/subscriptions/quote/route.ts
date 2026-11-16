import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getConsumerRestaurantId } from '@/lib/restaurant-context'
import { loadSubscriptionConfig } from '@/lib/subscription-config-load'
import { prisma } from '@/lib/prisma'
import { computeSubscriptionQuoteForRestaurant, quoteBlockMessage } from '@/lib/subscription-quote-server'
import { parseMealSlot, type MealSlot } from '@/lib/subscription-meal-slots'
import { parseRequiredMealSlotsByDay, validateSubscriptionItemsByMealSlots } from '@/lib/subscription-meal-slot-rules'
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

    const dishes = await prisma.dish.findMany({
      where: { restaurantId, id: { in: dishIds } },
      select: { id: true, subscriptionEligible: true, isAvailable: true },
    })

    const eligibleIds = new Set(
      dishes.filter((d) => d.isAvailable && d.subscriptionEligible).map((d) => d.id)
    )
    const requiredSlotsByJsDay = parseRequiredMealSlotsByDay(body?.requiredMealSlotsByDay)

    const validation = validateSubscriptionItemsByMealSlots(
      items,
      config,
      eligibleIds,
      deliveryDaysJs,
      Object.keys(requiredSlotsByJsDay).length ? requiredSlotsByJsDay : undefined
    )
    if (!validation.valid) {
      return NextResponse.json({ ok: false, error: validation.error }, { status: 400 })
    }

    if (deliveryDaysPerWeek < config.minDaysPerWeek || deliveryDaysPerWeek > config.maxDaysPerWeek) {
      return NextResponse.json(
        { ok: false, error: `Дней доставки: от ${config.minDaysPerWeek} до ${config.maxDaysPerWeek}.` },
        { status: 400 }
      )
    }

    const computed = await computeSubscriptionQuoteForRestaurant(restaurantId, {
      items,
      deliveryDays: deliveryDaysJs,
      periodDays,
      personCount,
    })
    if (!computed) {
      return NextResponse.json({ ok: false, error: quoteBlockMessage(null) }, { status: 400 })
    }
    const { quote } = computed
    if (!quote.offerable) {
      return NextResponse.json(
        { ok: false, error: quoteBlockMessage(quote.blockReason), reason: quote.blockReason },
        { status: 422 }
      )
    }

    return NextResponse.json({ ok: true, quote, guestPrice: quote.guestPrice, periodDays: computed.periodDays, personCount: computed.personCount })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 })
  }
}
