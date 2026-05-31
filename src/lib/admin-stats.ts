import { prisma } from '@/lib/prisma'

function getTodayBoundsUTC() {
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 1)
  return { start, end }
}

function getWeekBoundsUTC() {
  const { end } = getTodayBoundsUTC()
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - 7)
  return { start, end }
}

export type AdminStats = {
  ordersToday: number
  revenueToday: number
  ordersWeek: number
  revenueWeek: number
}

export async function getAdminStats(restaurantId: string): Promise<AdminStats> {
  const { start: startToday, end: endToday } = getTodayBoundsUTC()
  const { start: startWeek, end: endWeek } = getWeekBoundsUTC()

  const [todayAgg, weekAgg] = await Promise.all([
    prisma.order.aggregate({
      where: {
        restaurantId,
        createdAt: { gte: startToday, lt: endToday },
      },
      _count: { id: true },
      _sum: { totalAmount: true },
    }),
    prisma.order.aggregate({
      where: {
        restaurantId,
        createdAt: { gte: startWeek, lt: endWeek },
      },
      _count: { id: true },
      _sum: { totalAmount: true },
    }),
  ])

  return {
    ordersToday: todayAgg._count.id ?? 0,
    revenueToday: Number(todayAgg._sum.totalAmount ?? 0),
    ordersWeek: weekAgg._count.id ?? 0,
    revenueWeek: Number(weekAgg._sum.totalAmount ?? 0),
  }
}
