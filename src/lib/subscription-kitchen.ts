import { Prisma } from '@prisma/client'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { notifySubscriptionKitchenOrderToOwner, notifyOwnersKitchenSummary } from '@/lib/notifications'

/** Часовой пояс ресторана (минуты от UTC). Пхукет = +420, переходов на летнее время нет. */
function tzOffsetMin() {
  const n = Number(process.env.UFO_TZ_OFFSET_MIN)
  return Number.isFinite(n) ? n : 420
}

/** [start, end) календарного дня `at` в поясе ресторана, плюс день недели 0=вс. */
export function dayWindow(at: Date = new Date()) {
  const off = tzOffsetMin() * 60_000
  const local = new Date(at.getTime() + off)
  const startLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate())
  return {
    start: new Date(startLocal - off),
    end: new Date(startLocal + 86_400_000 - off),
    dow: new Date(startLocal).getUTCDay(),
  }
}

function dowOf(date: Date) {
  return new Date(date.getTime() + tzOffsetMin() * 60_000).getUTCDay()
}

export type KitchenResult =
  | { ok: true; deliveryId: string; orderId: string; duplicate?: boolean }
  | { ok: false; deliveryId: string; error: string }

class DuplicateKitchenOrder extends Error {}

/** След ошибки автосборки: событие KITCHEN_ERROR (без изменений схемы БД), видно владельцу на «Сегодня». */
export const KITCHEN_ERROR_TYPE = 'KITCHEN_ERROR'

async function recordKitchenError(restaurantId: string, deliveryId: string, error: string) {
  await prisma.userActivityEvent
    .create({
      data: {
        id: randomUUID(),
        restaurantId,
        type: KITCHEN_ERROR_TYPE,
        metadata: { deliveryId, error: error.slice(0, 300) },
      },
    })
    .catch(() => undefined)
}

/**
 * Один заказ на кухню на одну доставку. Защита от дублей:
 * обновление доставки идёт только при `orderId IS NULL`; параллельный запуск
 * (cron + кнопка) получает count=0, его заказ откатывается вместе с транзакцией.
 */
export async function createKitchenOrderForDelivery(
  deliveryId: string,
  restaurantId: string
): Promise<KitchenResult> {
  const fail = async (error: string): Promise<KitchenResult> => {
    await recordKitchenError(restaurantId, deliveryId, error)
    return { ok: false, deliveryId, error }
  }

  try {
    const delivery = await prisma.subscriptionDelivery.findFirst({
      where: { id: deliveryId, subscription: { restaurantId } },
      include: {
        subscription: {
          include: {
            user: { select: { id: true, name: true } },
            items: { include: { dish: { select: { id: true, name: true, price: true } } } },
          },
        },
      },
    })
    if (!delivery) return { ok: false, deliveryId, error: 'доставка не найдена' }
    if (delivery.orderId) return { ok: true, deliveryId, orderId: delivery.orderId, duplicate: true }
    if (delivery.status === 'CANCELLED' || delivery.status === 'DELIVERED' || delivery.status === 'SKIPPED') {
      return { ok: false, deliveryId, error: 'доставка уже закрыта' }
    }
    const sub = delivery.subscription
    if (sub.status !== 'ACTIVE') return { ok: false, deliveryId, error: 'подписка не активна' }
    const userId = sub.user?.id
    if (!userId) return fail('нет пользователя подписки')

    const address =
      (await prisma.address.findFirst({ where: { userId, isDefault: true }, orderBy: { createdAt: 'desc' } })) ??
      (await prisma.address.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } }))
    if (!address) return fail('у гостя нет адреса')

    const scheduled = new Date(delivery.scheduledDate)
    const dow = dowOf(scheduled)
    const rationItems = sub.items.filter(
      (it) => it.dish?.id && (it.dayOfWeek == null || it.dayOfWeek === dow)
    )
    if (!rationItems.length) return fail('нет блюд в рационе на этот день')

    const orderItems = rationItems.map((it) => ({
      dishId: it.dish!.id,
      quantity: Math.max(1, it.quantity || 1),
      price: Number(it.dish!.price) || 0,
    }))
    const totalAmount = orderItems.reduce((n, it) => n + it.price * it.quantity, 0)
    const clientName = sub.user?.name?.trim() || 'подписчик'
    const mealNote = rationItems.map((it) => `${it.quantity}× ${it.dish?.name ?? '—'}`).join(', ')

    let order: { id: string }
    try {
      order = await prisma.$transaction(async (tx) => {
        const created = await tx.order.create({
          data: {
            userId,
            restaurantId,
            addressId: address.id,
            status: 'CONFIRMED',
            // подписка оплачена заранее: заказ на кухню не должен висеть «ждёт оплаты»
            paymentStatus: 'PAID',
            paymentMethod: 'SUBSCRIPTION',
            paymentOptionSlug: 'SUBSCRIPTION',
            itemsCount: orderItems.reduce((n, it) => n + it.quantity, 0),
            totalAmount: new Prisma.Decimal(String(totalAmount)),
            deliveryTime: scheduled,
            discountDetailsJson: {
              source: 'subscription',
              subscriptionId: sub.id,
              subscriptionDeliveryId: deliveryId,
              subscriptionName: sub.name,
              note: `Подписка · ${clientName} · ${mealNote}`,
            },
            items: {
              create: orderItems.map((it) => ({
                dishId: it.dishId,
                quantity: it.quantity,
                price: new Prisma.Decimal(String(it.price)),
              })),
            },
          },
          select: { id: true },
        })
        const claimed = await tx.subscriptionDelivery.updateMany({
          where: { id: deliveryId, orderId: null },
          data: { orderId: created.id, status: 'CONFIRMED' },
        })
        if (claimed.count !== 1) throw new DuplicateKitchenOrder()
        return created
      })
    } catch (e) {
      if (e instanceof DuplicateKitchenOrder) {
        const fresh = await prisma.subscriptionDelivery.findUnique({ where: { id: deliveryId }, select: { orderId: true } })
        return { ok: true, deliveryId, orderId: fresh?.orderId ?? '', duplicate: true }
      }
      throw e
    }

    void notifySubscriptionKitchenOrderToOwner({
      restaurantId,
      orderId: order.id,
      subscriptionId: sub.id,
      subscriptionName: sub.name,
      clientName,
      mealNote,
      scheduledDate: scheduled,
    }).catch((err) => console.error('[kitchen:notify]', err))

    return { ok: true, deliveryId, orderId: order.id }
  } catch (e) {
    console.error('[kitchen:create]', deliveryId, e)
    return fail('не удалось создать заказ — повторите или создайте вручную')
  }
}

/** Все доставки дня (по одному ресторану или по всем), у которых ещё нет заказа. */
export async function runKitchenForDay(opts: { restaurantId?: string; at?: Date } = {}) {
  const { start, end } = dayWindow(opts.at)
  const deliveries = await prisma.subscriptionDelivery.findMany({
    where: {
      orderId: null,
      status: { in: ['SCHEDULED', 'CONFIRMED'] },
      scheduledDate: { gte: start, lt: end },
      subscription: { status: 'ACTIVE', ...(opts.restaurantId ? { restaurantId: opts.restaurantId } : {}) },
    },
    select: { id: true, subscription: { select: { restaurantId: true } } },
  })

  const results: Array<KitchenResult & { restaurantId: string }> = []
  for (const d of deliveries) {
    const r = await createKitchenOrderForDelivery(d.id, d.subscription.restaurantId)
    results.push({ ...r, restaurantId: d.subscription.restaurantId })
  }

  // одно сообщение владельцу на ресторан: сколько создано и что не получилось
  const byRestaurant = new Map<string, { created: number; failed: string[] }>()
  for (const r of results) {
    const row = byRestaurant.get(r.restaurantId) ?? { created: 0, failed: [] }
    if (r.ok && !r.duplicate) row.created += 1
    if (!r.ok) row.failed.push(r.error)
    byRestaurant.set(r.restaurantId, row)
  }
  for (const [restaurantId, row] of byRestaurant) {
    if (row.created === 0 && row.failed.length === 0) continue
    void notifyOwnersKitchenSummary({ restaurantId, created: row.created, failed: row.failed }).catch((e) =>
      console.error('[kitchen:summary]', e)
    )
  }

  return {
    total: results.length,
    created: results.filter((r) => r.ok && !r.duplicate).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  }
}
