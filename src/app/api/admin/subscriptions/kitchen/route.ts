import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRestaurantContext, requireRestaurantAdmin } from '@/lib/restaurant-context'
import { KITCHEN_ERROR_TYPE, dayWindow, runKitchenForDay } from '@/lib/subscription-kitchen'

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
      select: { id: true, orderId: true },
    })
    const pendingIds = new Set(rows.filter((r) => !r.orderId).map((r) => r.id))
    const events = pendingIds.size
      ? await prisma.userActivityEvent.findMany({
          where: { restaurantId: ctx.restaurantId, type: KITCHEN_ERROR_TYPE, createdAt: { gte: start } },
          orderBy: { createdAt: 'desc' },
          select: { metadata: true },
        })
      : []
    // последняя ошибка на каждую всё ещё несобранную доставку
    const lastByDelivery = new Map<string, string>()
    for (const e of events) {
      const m = (e.metadata ?? {}) as { deliveryId?: string; error?: string }
      if (m.deliveryId && pendingIds.has(m.deliveryId) && !lastByDelivery.has(m.deliveryId)) {
        lastByDelivery.set(m.deliveryId, String(m.error ?? ''))
      }
    }
    return NextResponse.json({
      ok: true,
      total: rows.length,
      pending: rows.filter((r) => !r.orderId).length,
      failed: lastByDelivery.size,
      lastError: [...lastByDelivery.values()][0] ?? null,
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
