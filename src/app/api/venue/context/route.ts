import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getConsumerRestaurantId } from '@/lib/restaurant-context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export type VenueContextResponse = {
  ok: boolean
  restaurantId: string
  name?: string
  settings: {
    menuEnabled: boolean
    storeEnabled: boolean
    subscriptionEnabled: boolean
  }
}

export async function GET() {
  try {
    const restaurantId = await getConsumerRestaurantId()

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

    const response: VenueContextResponse = {
      ok: true,
      restaurantId: restaurant?.id ?? restaurantId,
      name: restaurant?.name ?? (restaurantId === 'default' ? 'MOO' : undefined),
      settings: {
        menuEnabled: Boolean(settings?.menuEnabled),
        storeEnabled: Boolean(settings?.storeEnabled ?? true),
        subscriptionEnabled: Boolean(settings?.subscriptionEnabled),
      },
    }

    return NextResponse.json(response)
  } catch {
    return NextResponse.json(
      {
        ok: false,
        restaurantId: 'default',
        settings: {
          menuEnabled: false,
          storeEnabled: true,
          subscriptionEnabled: false,
        },
      } satisfies VenueContextResponse,
      { status: 500 }
    )
  }
}
