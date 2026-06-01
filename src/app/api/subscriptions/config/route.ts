import { NextResponse } from 'next/server'
import { getConsumerRestaurantId } from '@/lib/restaurant-context'
import { loadSubscriptionConfig } from '@/lib/subscription-config-load'
import { prisma } from '@/lib/prisma'
import { getEnabledMealSlots } from '@/lib/subscription-config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Public subscription config + enabled flag for guest wizard */
export async function GET() {
  try {
    const restaurantId = await getConsumerRestaurantId()
    const settings = await prisma.appSettings.findUnique({
      where: { restaurantId },
      select: { subscriptionEnabled: true, subscriptionConfigJson: true },
    })

    if (!settings?.subscriptionEnabled) {
      return NextResponse.json({ ok: true, enabled: false, config: null, enabledSlots: [] })
    }

    const config = await loadSubscriptionConfig(restaurantId)
    const enabledSlots = getEnabledMealSlots(config)

    return NextResponse.json({
      ok: true,
      enabled: true,
      config: {
        mealSlots: config.mealSlots,
        minDaysPerWeek: config.minDaysPerWeek,
        maxDaysPerWeek: config.maxDaysPerWeek,
        minPersons: config.minPersons,
        maxPersons: config.maxPersons,
        defaultPeriodDays: config.defaultPeriodDays,
        availablePeriods: config.availablePeriods,
        periodDiscounts: config.periodDiscounts,
        commerce: {
          subscriptionDiscountPercent: config.commerce.subscriptionDiscountPercent,
        },
      },
      enabledSlots,
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 })
  }
}
