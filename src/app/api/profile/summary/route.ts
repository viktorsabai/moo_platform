import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getConsumerRestaurantId } from '@/lib/restaurant-context'
import { prisma } from '@/lib/prisma'
import { resolveApiUser } from '@/lib/tg-auth-resolver'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const authUser = await resolveApiUser(headers())
    let userId = authUser.userId
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'нужна авторизация' }, { status: 401 })
    }

    const tg = String(authUser.telegramId || '').trim()
    if (tg) {
      const canonical = await prisma.user.findFirst({
        where: { telegramId: tg },
        select: { id: true },
      })
      if (canonical?.id) userId = canonical.id
    }

    const restaurantId = await getConsumerRestaurantId()
    const [ordersCount, activeSubscriptionsCount, favoritesCount, restaurantRow, addressCandidates] = await Promise.all([
      prisma.order.count({ where: { userId, restaurantId } }),
      prisma.subscription.count({ where: { userId, restaurantId, status: 'ACTIVE' } }),
      prisma.favoriteDish.count({ where: { userId, restaurantId } }),
      prisma.restaurant.findUnique({
        where: { id: restaurantId },
        select: { address: true },
      }),
      prisma.address.findMany({
        where: { userId, isDefault: true },
        select: { street: true, city: true, zipCode: true },
        orderBy: { createdAt: 'desc' },
        take: 12,
      }),
    ])

    const norm = (s: string) =>
      String(s || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ')
    const venueAddr = norm(String(restaurantRow?.address || ''))
    const defaultAddress =
      venueAddr.length > 8
        ? addressCandidates.find((a) => norm(a.street) !== venueAddr) ?? null
        : addressCandidates[0] ?? null

    return NextResponse.json(
      {
        ok: true,
        summary: {
          ordersCount,
          activeSubscriptionsCount,
          favoritesCount,
          addressLabel: defaultAddress
            ? [defaultAddress.street, defaultAddress.city].map((x) => String(x || '').trim()).filter(Boolean).join(', ')
            : null,
        },
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=20, stale-while-revalidate=90',
        },
      }
    )
  } catch {
    return NextResponse.json({ ok: false, error: 'Ошибка' }, { status: 500 })
  }
}
