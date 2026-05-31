import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRestaurantContext, requireRestaurantAdmin } from '@/lib/restaurant-context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SLA_MINUTES: Record<string, number> = {
  PENDING: 10,
  CONFIRMED: 15,
  PREPARING: 40,
  READY: 20,
  OUT_FOR_DELIVERY: 60,
}

export async function GET() {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())
    const active = await prisma.order.findMany({
      where: {
        restaurantId: ctx.restaurantId,
        status: { in: ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'] },
      },
      select: { id: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    const now = Date.now()
    const byStatus: Record<string, { total: number; overdue: number }> = {}
    const overdueOrders: Array<{ id: string; status: string; overdueMinutes: number }> = []
    for (const order of active) {
      const status = String(order.status)
      const limit = SLA_MINUTES[status]
      if (!limit) continue
      const spentMinutes = Math.floor((now - new Date(order.createdAt).getTime()) / 60000)
      const overdue = Math.max(0, spentMinutes - limit)
      if (!byStatus[status]) byStatus[status] = { total: 0, overdue: 0 }
      byStatus[status].total += 1
      if (overdue > 0) {
        byStatus[status].overdue += 1
        overdueOrders.push({ id: order.id, status, overdueMinutes: overdue })
      }
    }

    overdueOrders.sort((a, b) => b.overdueMinutes - a.overdueMinutes)
    return NextResponse.json({
      ok: true,
      slaMinutes: SLA_MINUTES,
      activeOrders: active.length,
      overdueTotal: overdueOrders.length,
      byStatus,
      topOverdue: overdueOrders.slice(0, 8),
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Ошибка' }, { status: Number(e?.statusCode || 500) })
  }
}
