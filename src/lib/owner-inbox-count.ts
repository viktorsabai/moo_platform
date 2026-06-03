import { prisma } from '@/lib/prisma'

export type OwnerInboxBreakdown = {
  orders: number
  subscriptions: number
  leads: number
}

/** Входящие заявки, требующие внимания владельца (для короны и ЛК). */
export async function getOwnerInboxCount(restaurantId: string): Promise<{
  total: number
  breakdown: OwnerInboxBreakdown
}> {
  const [orders, subscriptions, leads] = await Promise.all([
    prisma.order.count({
      where: { restaurantId, status: 'PENDING' },
    }),
    prisma.subscription.count({
      where: { restaurantId, status: 'PENDING' },
    }),
    prisma.serviceLead.count({
      where: { restaurantId, status: 'NEW' },
    }),
  ])

  const breakdown = { orders, subscriptions, leads }
  return { total: orders + subscriptions + leads, breakdown }
}
