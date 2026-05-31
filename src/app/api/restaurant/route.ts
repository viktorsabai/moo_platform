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

    return NextResponse.json({ ok: true, restaurant })
  } catch {
    return NextResponse.json({ ok: false, error: 'Ошибка' }, { status: 500 })
  }
}

