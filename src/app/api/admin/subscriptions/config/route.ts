import { NextResponse } from 'next/server'
import { getRestaurantContext, requireRestaurantAdmin } from '@/lib/restaurant-context'
import { loadSubscriptionConfig, parseSubscriptionConfig, saveSubscriptionConfig } from '@/lib/subscription-config-load'
import { prisma } from '@/lib/prisma'
import { calculateSubscriptionQuote } from '@/lib/subscription-pricing'
import { parseMealSlot } from '@/lib/subscription-meal-slots'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())
    const config = await loadSubscriptionConfig(ctx.restaurantId)

    const [dishes, categories, optionLinks] = await Promise.all([
      prisma.dish.findMany({
        where: { restaurantId: ctx.restaurantId, subscriptionEligible: true, isAvailable: true },
        select: {
          id: true,
          name: true,
          price: true,
          costPrice: true,
          categoryId: true,
          image: true,
          emoji: true,
          category: { select: { name: true } },
        },
        orderBy: [{ category: { order: 'asc' } }, { name: 'asc' }],
      }),
      prisma.category.findMany({
        where: { restaurantId: ctx.restaurantId },
        select: { id: true, name: true, slug: true, emoji: true },
        orderBy: { order: 'asc' },
      }),
      prisma.dishOptionValue.findMany({
        where: {
          restaurantId: ctx.restaurantId,
          subscriptionEligible: true,
          isAvailable: true,
        },
        select: {
          optionValueId: true,
          priceAdjust: true,
          costPrice: true,
          dishId: true,
          optionValue: { select: { name: true } },
          dish: { select: { name: true, categoryId: true, category: { select: { name: true } } } },
        },
        orderBy: [{ dish: { name: 'asc' } }, { order: 'asc' }],
      }),
    ])

    const products = [
      ...dishes.map((d) => ({
        kind: 'dish' as const,
        id: d.id,
        name: d.name,
        emoji: d.emoji,
        categoryId: d.categoryId,
        categoryName: d.category?.name ?? 'меню',
        price: Number(d.price),
        costPrice: d.costPrice == null ? null : Number(d.costPrice),
        image: d.image,
        dishId: d.id,
      })),
      ...optionLinks.map((o) => ({
        kind: 'option' as const,
        id: o.optionValueId,
        name: o.optionValue?.name ?? 'опция',
        emoji: '🥄',
        categoryId: o.dish?.categoryId ?? '',
        categoryName: o.dish?.category?.name ?? 'опции',
        price: Number(o.priceAdjust),
        costPrice: o.costPrice == null ? null : Number(o.costPrice),
        image: null as string | null,
        dishId: o.dishId,
        parentDishName: o.dish?.name ?? null,
      })),
    ]

    return NextResponse.json({
      ok: true,
      config,
      dishes: dishes.map((d) => ({
        id: d.id,
        name: d.name,
        price: Number(d.price),
        costPrice: d.costPrice == null ? null : Number(d.costPrice),
        categoryId: d.categoryId,
        image: d.image,
        emoji: d.emoji,
      })),
      products,
      categories,
    })
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    return NextResponse.json({ ok: false, error: e?.message || 'Ошибка' }, { status })
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())
    const body = await request.json().catch(() => ({}))
    const config = parseSubscriptionConfig(body?.config ?? body)
    const saved = await saveSubscriptionConfig(ctx.restaurantId, config)
    return NextResponse.json({ ok: true, config: saved })
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    return NextResponse.json({ ok: false, error: e?.message || 'Ошибка' }, { status })
  }
}

/** POST preview quote for owner commerce panel */
export async function POST(request: Request) {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())
    const body = await request.json().catch(() => ({}))
    const config = await loadSubscriptionConfig(ctx.restaurantId)
    const commerce =
      body?.commerce && typeof body.commerce === 'object'
        ? { ...config.commerce, ...body.commerce }
        : config.commerce

    const items = Array.isArray(body?.items) ? body.items : []
    const deliveryDays = Array.isArray(body?.deliveryDays) ? body.deliveryDays.length : config.minDaysPerWeek
    const periodDays = Number(body?.periodDays ?? config.defaultPeriodDays)
    const personCount = Number(body?.personCount ?? 1)

    const dishIds = items.map((it: any) => String(it?.dishId || '')).filter(Boolean)
    const modIds = items.flatMap((it: any) => (Array.isArray(it?.modifierIds) ? it.modifierIds : []))

    const [dishes, modifiers, optionLinks] = await Promise.all([
      prisma.dish.findMany({
        where: { restaurantId: ctx.restaurantId, id: { in: dishIds } },
        select: { id: true, price: true, costPrice: true },
      }),
      prisma.dishModifier.findMany({
        where: { id: { in: modIds }, dish: { restaurantId: ctx.restaurantId } },
        select: { id: true, priceAdjust: true, costPrice: true },
      }),
      prisma.dishOptionValue.findMany({
        where: { restaurantId: ctx.restaurantId, optionValueId: { in: modIds } },
        select: { optionValueId: true, priceAdjust: true, costPrice: true },
      }),
    ])

    const dishMap = new Map(dishes.map((d) => [d.id, { id: d.id, price: Number(d.price), costPrice: d.costPrice == null ? null : Number(d.costPrice) }]))
    const modMap = new Map<string, { id: string; priceAdjust: number; costPrice: number | null }>()
    for (const m of modifiers) {
      modMap.set(m.id, { id: m.id, priceAdjust: Number(m.priceAdjust), costPrice: m.costPrice == null ? null : Number(m.costPrice) })
    }
    for (const o of optionLinks) {
      modMap.set(o.optionValueId, {
        id: o.optionValueId,
        priceAdjust: Number(o.priceAdjust),
        costPrice: o.costPrice == null ? null : Number(o.costPrice),
      })
    }

    const quote = calculateSubscriptionQuote({
      items: items.map((it: any) => ({
        dishId: String(it.dishId),
        quantity: Number(it.quantity ?? 1),
        mealSlot: parseMealSlot(it.mealSlot),
        modifierIds: Array.isArray(it.modifierIds) ? it.modifierIds : [],
      })),
      deliveryDaysPerWeek: deliveryDays,
      periodDays,
      personCount,
      commerce,
      dishes: dishMap,
      modifiers: modMap,
      ownerPriceOverride: body?.ownerPriceOverride != null ? Number(body.ownerPriceOverride) : config.ownerPriceOverride ?? null,
    })

    return NextResponse.json({ ok: true, quote })
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    return NextResponse.json({ ok: false, error: e?.message || 'Ошибка' }, { status })
  }
}
