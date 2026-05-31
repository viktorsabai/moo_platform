// API Route: GET /api/dishes - получение списка блюд
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getConsumerRestaurantId } from '@/lib/restaurant-context'

export async function GET(request: Request) {
  try {
    const restaurantId = await getConsumerRestaurantId()

    const settings = await prisma.appSettings.findUnique({
      where: { restaurantId },
      select: { menuEnabled: true },
    })
    if (settings?.menuEnabled === false) {
      return NextResponse.json([])
    }

    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get('categoryId')
    const subscriptionEligible = searchParams.get('subscriptionEligible') === 'true'

    const where = {
      restaurantId,
      ...(subscriptionEligible ? { isAvailable: true, subscriptionEligible: true } : {}),
      ...(categoryId && { categoryId }),
    }
    const orderBy = { createdAt: 'desc' as const }

    const dishFields = {
      id: true,
      name: true,
      slug: true,
      emoji: true,
      description: true,
      price: true,
      image: true,
      categoryId: true,
      isAvailable: true,
      calories: true,
      allergens: true,
      tags: true,
      prepTimeMinutes: true,
      subscriptionEligible: true,
      maxOrderQuantity: true,
      updatedAt: true,
      category: { select: { id: true, name: true, slug: true, emoji: true, prepTimeMinutes: true, maxOrderQuantity: true } },
    }
    const modOrder = [{ order: 'asc' as const }, { createdAt: 'asc' as const }]
    const modifiersLegacy = {
      orderBy: modOrder,
      select: { id: true, name: true, type: true, priceAdjust: true, order: true },
    }
    const optionGroupSelect = { select: { id: true, name: true, order: true } as const }
    const guestOptionValues = (includeValueImage: boolean) => ({
      optionValues: {
        where: { isAvailable: true, optionValue: { isActive: true, group: { isActive: true } } },
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          priceAdjust: true,
          order: true,
          optionValue: {
            select: includeValueImage
              ? {
                  id: true,
                  name: true,
                  order: true,
                  subscriptionImageUrl: true,
                  group: optionGroupSelect,
                }
              : {
                  id: true,
                  name: true,
                  order: true,
                  group: optionGroupSelect,
                },
          },
        },
      },
    })
    const selectAttempts: any[] = []
    for (const modifiers of [modifiersLegacy]) {
      for (const includeValueImage of [true, false]) {
        const core = { ...dishFields, modifiers }
        const withWeight = { ...core, weightLabel: true }
        const withCost = { ...core, costPrice: true }
        const withWeightCost = { ...withWeight, costPrice: true }
        const ov = guestOptionValues(includeValueImage)
        selectAttempts.push(
          { ...withWeightCost, ...ov },
          { ...withWeight, ...ov },
          { ...withCost, ...ov },
          { ...core, ...ov },
          withWeightCost,
          withWeight,
          withCost,
          core
        )
      }
    }

    let dishes: any[] | null = null
    let lastError: unknown
    for (const select of selectAttempts) {
      try {
        dishes = await prisma.dish.findMany({ where, select: select as any, orderBy })
        lastError = undefined
        break
      } catch (e) {
        lastError = e
      }
    }
    if (!dishes && lastError) throw lastError
    if (!dishes) dishes = []

    return NextResponse.json(
      dishes.map((d) => {
        const cat = d.category as { prepTimeMinutes?: number | null; maxOrderQuantity?: number | null } | null
        const image = typeof d.image === 'string' ? d.image.trim() : ''
        const imageUrl = image.startsWith('data:image/')
          ? `/api/dishes/image/${encodeURIComponent(d.id)}?r=${encodeURIComponent(restaurantId)}&v=${new Date(d.updatedAt).getTime()}`
          : image || null
        const groups = new Map<string, { id: string; name: string; order: number; values: any[] }>()
        for (const ov of (d as any).optionValues || []) {
          const group = ov.optionValue.group
          const existing = groups.get(group.id) ?? { id: group.id, name: group.name, order: Number(group.order || 0), values: [] as any[] }
          const subImg = ov.optionValue.subscriptionImageUrl
          existing.values.push({
            id: ov.optionValue.id,
            name: ov.optionValue.name,
            priceAdjust: Number(ov.priceAdjust),
            order: Number(ov.order ?? ov.optionValue.order ?? 0),
            subscriptionImageUrl: subImg && String(subImg).trim() ? String(subImg).trim() : null,
          })
          groups.set(group.id, existing)
        }
        return {
          ...d,
          price: Number(d.price),
          costPrice: d.costPrice == null ? null : Number(d.costPrice),
          image: imageUrl,
          prepTimeMinutes: cat?.prepTimeMinutes ?? d.prepTimeMinutes ?? null,
          maxOrderQuantity: cat?.maxOrderQuantity ?? d.maxOrderQuantity ?? 10,
          modifiers: (d.modifiers || []).map((m: any) => ({ ...m, priceAdjust: Number(m.priceAdjust) })),
          optionGroups: Array.from(groups.values())
            .map((g) => ({ ...g, values: g.values.sort((a, b) => a.order - b.order) }))
            .sort((a, b) => a.order - b.order),
        }
      })
    )
  } catch {
    return NextResponse.json([], {
      status: 503,
      headers: { 'x-ufo-degraded': 'true' },
    })
  }
}







