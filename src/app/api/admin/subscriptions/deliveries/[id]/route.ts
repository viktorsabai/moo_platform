import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRestaurantContext, requireRestaurantAdmin } from '@/lib/restaurant-context'
import { notifySubscriptionDeliveryDeliveredToCustomer } from '@/lib/notifications'
import { createKitchenOrderForDelivery } from '@/lib/subscription-kitchen'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Действия владельца по доставке подписки: в готовку · заказ на кухню · доставлено. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const action = String(body?.action || '').trim().toLowerCase()

    const delivery = await prisma.subscriptionDelivery.findFirst({
      where: { id, subscription: { restaurantId: ctx.restaurantId } },
      include: {
        subscription: {
          include: {
            user: { select: { id: true, name: true, telegramId: true } },
            items: { include: { dish: { select: { id: true, name: true, price: true } } } },
          },
        },
      },
    })

    if (!delivery) {
      return NextResponse.json({ ok: false, error: 'доставка не найдена' }, { status: 404 })
    }

    if (action === 'start_prep') {
      if (delivery.status === 'DELIVERED' || delivery.status === 'CANCELLED') {
        return NextResponse.json({ ok: false, error: 'доставка уже закрыта' }, { status: 400 })
      }
      await prisma.subscriptionDelivery.update({
        where: { id },
        data: { status: 'CONFIRMED' },
      })
      return NextResponse.json({ ok: true, status: 'CONFIRMED' })
    }

    if (action === 'mark_delivered') {
      await prisma.subscriptionDelivery.update({
        where: { id },
        data: { status: 'DELIVERED', deliveredAt: new Date() },
      })
      const sub = delivery.subscription
      void notifySubscriptionDeliveryDeliveredToCustomer({
        restaurantId: ctx.restaurantId,
        subscriptionId: sub.id,
        subscriptionName: sub.name,
        deliveryId: id,
        scheduledDate: new Date(delivery.scheduledDate),
        customerTelegramId: sub.user?.telegramId ?? null,
      }).catch((err) => console.error('[deliveries:mark_delivered:notify]', err))
      return NextResponse.json({ ok: true, status: 'DELIVERED' })
    }

    if (action === 'create_kitchen_order') {
      const r = await createKitchenOrderForDelivery(id, ctx.restaurantId)
      if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 400 })
      return NextResponse.json({ ok: true, orderId: r.orderId, status: 'CONFIRMED', duplicate: r.duplicate ?? false })
    }

    return NextResponse.json(
      { ok: false, error: 'action: start_prep | create_kitchen_order | mark_delivered' },
      { status: 400 }
    )
  } catch (e: unknown) {
    const status = Number((e as { statusCode?: number })?.statusCode || 500)
    return NextResponse.json({ ok: false, error: 'Ошибка' }, { status })
  }
}
