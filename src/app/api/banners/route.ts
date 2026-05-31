import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getConsumerRestaurantId } from '@/lib/restaurant-context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const restaurantId = await getConsumerRestaurantId()

    const banners = await prisma.homeBanner.findMany({
      where: { restaurantId, isActive: true },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, title: true, description: true, image: true, href: true, cta: true, type: true, targetType: true, targetId: true },
    })

    return NextResponse.json(
      { ok: true, banners },
      {
        headers: {
          'Cache-Control': 'private, max-age=30, stale-while-revalidate=120',
        },
      }
    )
  } catch {
    return NextResponse.json({ ok: false, banners: [] }, { status: 500 })
  }
}
