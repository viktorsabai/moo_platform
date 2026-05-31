import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getConsumerRestaurantId } from '@/lib/restaurant-context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const restaurantId = await getConsumerRestaurantId()

    const settings = await prisma.appSettings.findUnique({
      where: { restaurantId },
      select: { storeEnabled: true },
    })
    if (settings?.storeEnabled === false) {
      return NextResponse.json({ ok: true, categories: [] })
    }

    const categories = await prisma.storeCategory.findMany({
      where: { restaurantId },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        emoji: true,
        description: true,
        order: true,
      },
    })
    return NextResponse.json({ ok: true, categories })
  } catch {
    return NextResponse.json({ ok: false, error: 'Ошибка при получении категорий магазина' }, { status: 500 })
  }
}

