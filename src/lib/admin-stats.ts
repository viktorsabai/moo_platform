import { prisma } from '@/lib/prisma'

function getTodayBoundsUTC(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 1)
  return { start, end }
}

function getWeekBoundsUTC(now = new Date()) {
  const { end } = getTodayBoundsUTC(now)
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - 7)
  return { start, end }
}

type PeriodBounds = { from: string; to: string }
type KpiPeriod = { orders: number; revenue: number; averageOrderValue: number }

export type AdminStats = {
  /** Backwards-compatible fields consumed by the current dashboard cards. */
  ordersToday: number
  revenueToday: number
  ordersWeek: number
  revenueWeek: number
  /** Canonical analytics contract for new owner dashboard consumers. */
  taxonomyVersion: '2026-08-19'
  timezone: 'UTC'
  periods: {
    today: PeriodBounds
    last7d: PeriodBounds
  }
  kpis: {
    today: KpiPeriod
    last7d: KpiPeriod
    cancelledOrdersLast7d: number
  }
  definitions: {
    orders: 'all orders created in period'
    revenue: 'sum of totalAmount for non-cancelled orders created in period'
    averageOrderValue: 'revenue divided by non-cancelled orders in period'
    cancelledOrders: 'orders with status CANCELLED created in period'
  }
}

function toKpi(count: number, revenue: number): KpiPeriod {
  return {
    orders: count,
    revenue,
    averageOrderValue: count > 0 ? Number((revenue / count).toFixed(2)) : 0,
  }
}

export async function getAdminStats(restaurantId: string): Promise<AdminStats> {
  const now = new Date()
  const { start: startToday, end: endToday } = getTodayBoundsUTC(now)
  const { start: startWeek, end: endWeek } = getWeekBoundsUTC(now)
  const todayWhere = { restaurantId, createdAt: { gte: startToday, lt: endToday } }
  const weekWhere = { restaurantId, createdAt: { gte: startWeek, lt: endWeek } }
  const revenueWhere = { status: { not: 'CANCELLED' as const } }

  const [todayAgg, todayRevenueAgg, weekAgg, weekCancelled] = await Promise.all([
    prisma.order.aggregate({
      where: todayWhere,
      _count: { id: true },
      _sum: { totalAmount: true },
    }),
    prisma.order.aggregate({
      where: { ...todayWhere, ...revenueWhere },
      _count: { id: true },
      _sum: { totalAmount: true },
    }),
    prisma.order.aggregate({
      where: { ...weekWhere, ...revenueWhere },
      _count: { id: true },
      _sum: { totalAmount: true },
    }),
    prisma.order.count({ where: { ...weekWhere, status: 'CANCELLED' } }),
  ])

  const ordersToday = todayAgg._count.id ?? 0
  const revenueToday = Number(todayRevenueAgg._sum.totalAmount ?? 0)
  const ordersTodayForKpi = todayRevenueAgg._count.id ?? 0
  const ordersWeek = weekAgg._count.id ?? 0
  const revenueWeek = Number(weekAgg._sum.totalAmount ?? 0)

  return {
    ordersToday,
    revenueToday,
    ordersWeek,
    revenueWeek,
    taxonomyVersion: '2026-08-19',
    timezone: 'UTC',
    periods: {
      today: { from: startToday.toISOString(), to: endToday.toISOString() },
      last7d: { from: startWeek.toISOString(), to: endWeek.toISOString() },
    },
    kpis: {
      today: toKpi(ordersTodayForKpi, revenueToday),
      last7d: toKpi(ordersWeek, revenueWeek),
      cancelledOrdersLast7d: weekCancelled,
    },
    definitions: {
      orders: 'all orders created in period',
      revenue: 'sum of totalAmount for non-cancelled orders created in period',
      averageOrderValue: 'revenue divided by non-cancelled orders in period',
      cancelledOrders: 'orders with status CANCELLED created in period',
    },
  }
}
