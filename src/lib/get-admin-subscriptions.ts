import { prisma } from '@/lib/prisma'

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'активная',
  PAUSED: 'на паузе',
  CANCELLED: 'отменена',
  EXPIRED: 'закончилась',
}

export type AdminSubscriptionRow = {
  id: string
  name: string
  status: string
  statusLabel: string
  price: number
  plan: string
  deliveryDays: number[]
  deliveryTime: string | null
  nextDelivery: string | null
  createdAt: string
  user: {
    id: string
    name: string
    email: string | null
    phone: string | null
    telegramPhotoUrl: string | null
    avatar: string | null
  } | null
  items: { id: string; quantity: number; dish: { id: string; name: string; price: number } }[]
  deliveries: { id: string; scheduledDate: string; status: string }[]
}

/** Список подписок ресторана для ЛК — тот же контекст, что и счётчик на дашборде. */
export async function getAdminSubscriptions(restaurantId: string): Promise<AdminSubscriptionRow[]> {
  const subs = await prisma.subscription.findMany({
    where: { restaurantId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      status: true,
      price: true,
      plan: true,
      deliveryDays: true,
      deliveryTime: true,
      nextDelivery: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          telegramPhotoUrl: true,
          avatar: true,
        },
      },
      items: {
        select: {
          id: true,
          quantity: true,
          dish: { select: { id: true, name: true, price: true } },
        },
      },
      deliveries: {
        select: { id: true, scheduledDate: true, status: true },
      },
    },
  })

  return subs.map((s) => ({
    ...s,
    price: Number(s.price),
    nextDelivery: s.nextDelivery ? s.nextDelivery.toISOString() : null,
    createdAt: s.createdAt.toISOString(),
    statusLabel: STATUS_LABEL[s.status] ?? s.status,
    user: s.user
      ? {
          id: s.user.id,
          name: s.user.name ?? s.user.email ?? '—',
          email: s.user.email ?? null,
          phone: s.user.phone ?? null,
          telegramPhotoUrl: s.user.telegramPhotoUrl ?? null,
          avatar: s.user.avatar ?? null,
        }
      : null,
    items: (s.items ?? []).map((it) => ({
      ...it,
      dish: it.dish ? { ...it.dish, price: Number(it.dish.price) } : it.dish,
    })),
    deliveries: (s.deliveries ?? []).map((d) => ({
      id: d.id,
      scheduledDate: d.scheduledDate.toISOString(),
      status: d.status,
    })),
  }))
}
