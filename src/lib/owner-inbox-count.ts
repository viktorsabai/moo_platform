import { prisma } from '@/lib/prisma'
import { formatPrice } from '@/lib/utils'

export type OwnerInboxBreakdown = {
  orders: number
  subscriptions: number
  leads: number
}

export type OwnerInboxItem = {
  kind: 'order' | 'subscription' | 'lead'
  id: string
  label: string
  subtitle?: string
  href: string
  createdAt: string
}

/** Входящие заявки, требующие внимания владельца (корона · блок «входящие» в ЛК). */
export async function getOwnerInbox(restaurantId: string): Promise<{
  total: number
  breakdown: OwnerInboxBreakdown
  items: OwnerInboxItem[]
}> {
  const [orders, subscriptions, leads] = await Promise.all([
    prisma.order.findMany({
      where: { restaurantId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        totalAmount: true,
        itemsCount: true,
        createdAt: true,
        user: { select: { name: true, telegramUsername: true } },
      },
    }),
    prisma.subscription.findMany({
      where: { restaurantId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        name: true,
        price: true,
        createdAt: true,
        user: { select: { name: true, telegramUsername: true } },
      },
    }),
    prisma.serviceLead.findMany({
      where: { restaurantId, status: 'NEW' },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        title: true,
        type: true,
        name: true,
        createdAt: true,
      },
    }),
  ])

  const items: OwnerInboxItem[] = []

  for (const o of orders) {
    const client = o.user?.name ?? o.user?.telegramUsername ?? 'гость'
    items.push({
      kind: 'order',
      id: o.id,
      label: `Заказ · ${formatPrice(o.totalAmount)}`,
      subtitle: `${client} · ${o.itemsCount} поз.`,
      href: '/admin/orders',
      createdAt: o.createdAt.toISOString(),
    })
  }

  for (const s of subscriptions) {
    const client = s.user?.name ?? s.user?.telegramUsername ?? 'гость'
    items.push({
      kind: 'subscription',
      id: s.id,
      label: `«${s.name}» · на подтверждении`,
      subtitle: `${client} · ${formatPrice(s.price)}/мес`,
      href: `/admin/subscriptions/clients?subscriptionId=${s.id}`,
      createdAt: s.createdAt.toISOString(),
    })
  }

  for (const l of leads) {
    items.push({
      kind: 'lead',
      id: l.id,
      label: l.title?.trim() || 'Заявка на кейтеринг',
      subtitle: `${l.name} · ${l.type}`,
      href: '/admin/leads',
      createdAt: l.createdAt.toISOString(),
    })
  }

  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const breakdown = {
    orders: orders.length,
    subscriptions: subscriptions.length,
    leads: leads.length,
  }
  return { total: breakdown.orders + breakdown.subscriptions + breakdown.leads, breakdown, items }
}

/** @deprecated use getOwnerInbox */
export async function getOwnerInboxCount(restaurantId: string): Promise<{
  total: number
  breakdown: OwnerInboxBreakdown
}> {
  const { total, breakdown } = await getOwnerInbox(restaurantId)
  return { total, breakdown }
}
