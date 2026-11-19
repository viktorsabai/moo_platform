import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getConsumerRestaurantId } from '@/lib/restaurant-context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const restaurantId = await getConsumerRestaurantId()

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: {
        id: true,
        name: true,
        slug: true,
        address: true,
        isActive: true,
        botIntegrations: { orderBy: { createdAt: 'asc' }, take: 1, select: { botUsername: true, startParam: true } },
      },
    })

    const branding = restaurant ? await readBranding(restaurant.id) : null
    return NextResponse.json({ ok: true, restaurant: restaurant ? { ...restaurant, ...branding } : restaurant })
  } catch {
    return NextResponse.json({ ok: false, error: 'Ошибка' }, { status: 500 })
  }
}


/**
 * Обложка и логотип читаются отдельным запросом: если миграция
 * 20261119120000_restaurant_branding ещё не применена, главная и админка
 * продолжают работать — просто без оформления.
 */
async function readBranding(id: string): Promise<{ coverImage: string | null; logoImage: string | null }> {
  try {
    const r = await prisma.restaurant.findUnique({ where: { id }, select: { coverImage: true, logoImage: true } })
    return { coverImage: r?.coverImage ?? null, logoImage: r?.logoImage ?? null }
  } catch {
    return { coverImage: null, logoImage: null }
  }
}
