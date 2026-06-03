import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getConsumerRestaurantId } from '@/lib/restaurant-context'
import { bannerPlacementWhere, parseBannerPlacement } from '@/lib/home-banner-placement'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const restaurantId = await getConsumerRestaurantId()
    const placement = parseBannerPlacement(new URL(request.url).searchParams.get('placement'))

    const banners = await prisma.homeBanner.findMany({
      where: { restaurantId, isActive: true, ...bannerPlacementWhere(placement) },
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
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const missingPlacementColumns =
      /showOnHome|showOnSubscriptions|Unknown field/i.test(msg) ||
      /column.*does not exist/i.test(msg)
    if (missingPlacementColumns) {
      console.error('[banners] run: npm run db:migrate:prod — placement columns missing')
    } else {
      console.error('[banners]', msg)
    }
    return NextResponse.json({ ok: false, banners: [], error: 'banners_unavailable' }, { status: 500 })
  }
}
