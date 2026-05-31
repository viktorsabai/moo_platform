import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getConsumerRestaurantId } from '@/lib/restaurant-context'
import { ensureMvpTables } from '@/lib/mvp-db'
import { mergePaymentMethodsWithDefaults, methodsAvailableForConsumer, stripeIsConfigured } from '@/lib/payment-methods'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const restaurantId = await getConsumerRestaurantId()

    await ensureMvpTables()
    const [settings, zoneCountRows] = await Promise.all([
      prisma.appSettings.upsert({
        where: { restaurantId },
        create: { restaurantId },
        update: {},
        select: {
          id: true,
          restaurantId: true,
          menuEnabled: true,
          storeEnabled: true,
          subscriptionEnabled: true,
          deliveryFee: true,
          freeDeliveryFrom: true,
          openTime: true,
          closeTime: true,
          isOpenOverride: true,
          paymentMethodsJson: true,
        },
      }),
      prisma.$queryRawUnsafe<Array<{ count: number }>>(
        `SELECT COUNT(*)::int AS count FROM "DeliveryZone" WHERE "restaurantId"=$1 AND "isActive"=TRUE`,
        restaurantId
      ),
    ])
    const activeDeliveryZonesCount = Math.max(0, Number(zoneCountRows?.[0]?.count ?? 0))
    const merged = mergePaymentMethodsWithDefaults(settings.paymentMethodsJson)
    const paymentOptions = methodsAvailableForConsumer(merged)
    const { paymentMethodsJson: _omit, ...rest } = settings as typeof settings & { paymentMethodsJson?: unknown }
    return NextResponse.json({
      ok: true,
      settings: {
        ...rest,
        paymentOptions,
        stripeConfigured: stripeIsConfigured(),
        activeDeliveryZonesCount,
      },
    })
  } catch {
    return NextResponse.json({ ok: false, error: 'Ошибка при получении настроек' }, { status: 500 })
  }
}

