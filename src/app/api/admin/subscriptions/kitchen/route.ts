import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRestaurantContext, requireRestaurantAdmin } from '@/lib/restaurant-context'
import { dayWindow, runKitchenForDay } from '@/lib/subscription-kitchen'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Сводка «кухня на сегодня»: сколько доставок, сколько заказов уже есть, что упало. */
export async function GET() {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())
    const { start, end } = dayWindow()
    const rows = await prisma.subscriptionDelivery.findMany({
      where: {
        scheduledDate: { gte: start, lt: end },
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
        subscription: { restaurantId: ctx.restaurantId, status: 'ACTIVE' },
      },
      select: { orderId: true, kitchenError: true },
    })
    return NextResponse.json({
      ok: true,
      total: rows.length,
      pending: rows.filter((r) => !r.orderId).length,
      failed: rows.filter((r) => !r.orderId && r.kitchenError).length,
      lastError: rows.find((r) => !r.orderId && r.kitchenError)?.kitchenError ?? null,
    })
  } catch (e: unknown) {
    const status = Number((e as { statusCode?: number })?.statusCode || 500)
    return NextResponse.json({ ok: false, error: 'Ошибка' }, { status })
  }
}

/** Кнопка «собрать кухню на сегодня»: идемпотентно, повторный клик дублей не создаёт. */
export async function POST() {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())
    const r = await runKitchenForDay({ restaurantId: ctx.restaurantId })
    return NextResponse.json({
      ok: true,
      created: r.created,
      failed: r.failed,
      errors: [...new Set(r.results.filter((x) => !x.ok).map((x) => (x as { error: string }).error))],
    })
  } catch (e: unknown) {
    const status = Number((e as { statusCode?: number })?.statusCode || 500)
    return NextResponse.json({ ok: false, error: 'Ошибка' }, { status })
  }
}
