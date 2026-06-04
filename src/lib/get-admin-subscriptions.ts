import { prisma } from '@/lib/prisma'
import { formatTelegramContact } from '@/lib/telegram-contact'

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'активная',
  PENDING: 'на подтверждении',
  PAUSED: 'на паузе',
  CANCELLED: 'отменена',
  EXPIRED: 'закончилась',
  DRAFT: 'черновик',
}

export type AdminSubscriptionRow = {
  id: string
  name: string
  status: string
  statusLabel: string
  price: number
  plan: string
  personCount: number
  periodDays: number
  deliveryDays: number[]
  deliveryTime: string | null
  nextDelivery: string | null
  createdAt: string
  user: {
    id: string
    displayName: string
    contactLabel: string
    name: string
    telegramUsername: string | null
    telegramId: string | null
    telegramPhotoUrl: string | null
    avatar: string | null
  } | null
  items: {
    id: string
    quantity: number
    dayOfWeek: number | null
    mealSlot: string | null
    dish: { id: string; name: string; price: number } | null
  }[]
  deliveries: { id: string; scheduledDate: string; status: string; orderId: string | null }[]
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
      personCount: true,
      periodDays: true,
      deliveryDays: true,
      deliveryTime: true,
      nextDelivery: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          name: true,
          telegramUsername: true,
          telegramId: true,
          telegramPhotoUrl: true,
          avatar: true,
        },
      },
      items: {
        select: {
          id: true,
          quantity: true,
          dayOfWeek: true,
          mealSlot: true,
          dish: { select: { id: true, name: true, price: true } },
        },
      },
      deliveries: {
        select: { id: true, scheduledDate: true, status: true, orderId: true },
      },
    },
  })

  return subs.map((s) => {
    const displayName = String(s.user?.name || '').trim() || 'Гость'
    const contactLabel = s.user
      ? formatTelegramContact({
          name: s.user.name,
          telegramUsername: s.user.telegramUsername,
          telegramId: s.user.telegramId,
        })
      : '—'

    return {
      ...s,
      price: Number(s.price),
      nextDelivery: s.nextDelivery ? s.nextDelivery.toISOString() : null,
      createdAt: s.createdAt.toISOString(),
      statusLabel: STATUS_LABEL[s.status] ?? s.status,
      user: s.user
        ? {
            id: s.user.id,
            displayName,
            contactLabel,
            name: displayName,
            telegramUsername: s.user.telegramUsername ?? null,
            telegramId: s.user.telegramId ?? null,
            telegramPhotoUrl: s.user.telegramPhotoUrl ?? null,
            avatar: s.user.avatar ?? null,
          }
        : null,
      items: (s.items ?? []).map((it) => ({
        ...it,
        dish: it.dish ? { ...it.dish, price: Number(it.dish.price) } : null,
      })),
    deliveries: (s.deliveries ?? []).map((d) => ({
      id: d.id,
      scheduledDate: d.scheduledDate.toISOString(),
      status: d.status,
      orderId: d.orderId ?? null,
    })),
    }
  })
}
