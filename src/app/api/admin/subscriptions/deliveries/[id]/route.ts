import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getRestaurantContext, requireRestaurantAdmin } from '@/lib/restaurant-context'
import {
  notifySubscriptionDeliveryDeliveredToCustomer,
  notifySubscriptionKitchenOrderToOwner,
} from '@/lib/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function itemsForDeliveryDay(
  items: Array<{ quantity: number; dayOfWeek: number | null; dishId: string; dish: { name: string; price: unknown } | null }>,
  deliveryDate: Date
) {
  const dow = deliveryDate.getDay()
  return items.filter((it) => it.dayOfWeek == null || it.dayOfWeek === dow)
}

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
      if (delivery.orderId) {
        return NextResponse.json({ ok: true, orderId: delivery.orderId, duplicate: true })
      }
      if (delivery.status === 'CANCELLED' || delivery.status === 'DELIVERED') {
        return NextResponse.json({ ok: false, error: 'доставка уже закрыта' }, { status: 400 })
      }

      const sub = delivery.subscription
      const userId = sub.user?.id
      if (!userId) {
        return NextResponse.json({ ok: false, error: 'нет пользователя подписки' }, { status: 400 })
      }

      const address =
        (await prisma.address.findFirst({ where: { userId, isDefault: true }, orderBy: { createdAt: 'desc' } })) ??
        (await prisma.address.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } }))

      if (!address) {
        return NextResponse.json(
          { ok: false, error: 'у гостя нет адреса — попросите указать в профиле' },
          { status: 400 }
        )
      }

      const scheduled = new Date(delivery.scheduledDate)
      const rationItems = itemsForDeliveryDay(sub.items, scheduled)
      if (!rationItems.length) {
        return NextResponse.json({ ok: false, error: 'нет блюд в рационе на этот день' }, { status: 400 })
      }

      const orderItems = rationItems
        .filter((it) => it.dish?.id)
        .map((it) => ({
          dishId: it.dish!.id,
          quantity: Math.max(1, it.quantity || 1),
          price: Number(it.dish!.price) || 0,
        }))

      const totalAmount = orderItems.reduce((n, it) => n + it.price * it.quantity, 0)
      const clientName = sub.user?.name?.trim() || 'подписчик'
      const mealNote = rationItems
        .map((it) => `${it.quantity}× ${it.dish?.name ?? '—'}`)
        .join(', ')

      const order = await prisma.$transaction(async (tx) => {
        const created = await tx.order.create({
          data: {
            userId,
            restaurantId: ctx.restaurantId,
            addressId: address.id,
            status: 'CONFIRMED',
            paymentStatus: 'PENDING',
            paymentMethod: 'SUBSCRIPTION',
            paymentOptionSlug: 'SUBSCRIPTION',
            itemsCount: orderItems.reduce((n, it) => n + it.quantity, 0),
            totalAmount: new Prisma.Decimal(String(totalAmount)),
            deliveryTime: scheduled,
            discountDetailsJson: {
              source: 'subscription',
              subscriptionId: sub.id,
              subscriptionDeliveryId: id,
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

        await tx.subscriptionDelivery.update({
          where: { id },
          data: { orderId: created.id, status: 'CONFIRMED' },
        })

        return created
      })

      void notifySubscriptionKitchenOrderToOwner({
        restaurantId: ctx.restaurantId,
        orderId: order.id,
        subscriptionId: sub.id,
        subscriptionName: sub.name,
        clientName,
        mealNote,
        scheduledDate: scheduled,
      }).catch((err) => console.error('[deliveries:create_kitchen_order:notify]', err))

      return NextResponse.json({ ok: true, orderId: order.id, status: 'CONFIRMED' })
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
