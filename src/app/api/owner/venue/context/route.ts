import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRestaurantContext, requireRestaurantAdmin } from '@/lib/restaurant-context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Контекст заведения для кабинета владельца (не consumer cookie). */
export async function GET() {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())
    const restaurantId = ctx.restaurantId

    const [restaurant, settings] = await Promise.all([
      prisma.restaurant.findUnique({
        where: { id: restaurantId },
        select: { id: true, name: true },
      }),
      prisma.appSettings.findUnique({
        where: { restaurantId },
        select: {
          menuEnabled: true,
          storeEnabled: true,
          subscriptionEnabled: true,
        },
      }),
    ])

    return NextResponse.json({
      ok: true,
      restaurantId: restaurant?.id ?? restaurantId,
      name: restaurant?.name ?? undefined,
      settings: {
        menuEnabled: Boolean(settings?.menuEnabled),
        storeEnabled: Boolean(settings?.storeEnabled ?? true),
        subscriptionEnabled: Boolean(settings?.subscriptionEnabled),
      },
    })
  } catch (e: any) {
    const status = Number(e?.statusCode || 401)
    return NextResponse.json({ ok: false, error: String(e?.message || 'unauthorized') }, { status })
  }
}
