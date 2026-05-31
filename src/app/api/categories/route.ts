// API Route: GET /api/categories - получение категорий
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getConsumerRestaurantId } from '@/lib/restaurant-context'

export async function GET() {
  try {
    const ARCHIVE_CATEGORY_SLUG = '__archive'
    const restaurantId = await getConsumerRestaurantId()

    const settings = await prisma.appSettings.findUnique({
      where: { restaurantId },
      select: { menuEnabled: true },
    })
    if (settings?.menuEnabled === false) {
      return NextResponse.json([])
    }

    const categories = await prisma.category.findMany({
      where: {
        restaurantId,
        slug: { not: ARCHIVE_CATEGORY_SLUG },
        dishes: { some: { isAvailable: true } },
      },
      orderBy: [{ order: 'asc' }, { name: 'asc' }, { createdAt: 'asc' }],
    })

    return NextResponse.json(categories)
  } catch {
    return NextResponse.json([], {
      status: 503,
      headers: { 'x-ufo-degraded': 'true' },
    })
  }
}







