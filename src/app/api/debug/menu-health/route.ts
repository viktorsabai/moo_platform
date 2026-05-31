import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getConsumerRestaurantResolution } from '@/lib/restaurant-context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ARCHIVE_CATEGORY_SLUG = '__archive'

export async function GET() {
  try {
    const resolution = await getConsumerRestaurantResolution()
    const restaurantId = resolution.restaurantId
    const [
      restaurant,
      settings,
      categoryCount,
      visibleCategoryCount,
      availableDishCount,
      totalDishCount,
      base64DishImageCount,
      urlDishImageCount,
    ] = await Promise.all([
      prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { id: true, name: true, slug: true } }),
      prisma.appSettings.findUnique({ where: { restaurantId }, select: { menuEnabled: true, storeEnabled: true, subscriptionEnabled: true } }),
      prisma.category.count({ where: { restaurantId, slug: { not: ARCHIVE_CATEGORY_SLUG } } }),
      prisma.category.count({ where: { restaurantId, slug: { not: ARCHIVE_CATEGORY_SLUG }, dishes: { some: { isAvailable: true } } } }),
      prisma.dish.count({ where: { restaurantId, isAvailable: true } }),
      prisma.dish.count({ where: { restaurantId } }),
      prisma.dish.count({ where: { restaurantId, image: { startsWith: 'data:image/' } } }),
      prisma.dish.count({
        where: {
          restaurantId,
          image: { not: null, notIn: [''] },
          NOT: { image: { startsWith: 'data:image/' } },
        },
      }),
    ])

    return NextResponse.json({
      ok: true,
      resolution,
      restaurant,
      settings,
      counts: {
        categoryCount,
        visibleCategoryCount,
        availableDishCount,
        totalDishCount,
        base64DishImageCount,
        urlDishImageCount,
      },
      ts: Date.now(),
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 })
  }
}
