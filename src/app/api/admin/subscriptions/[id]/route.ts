import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRestaurantContext, requireRestaurantAdmin } from '@/lib/restaurant-context'
import {
  notifySubscriptionStatusChangedToCustomer,
  notifySubscriptionStatusChangedToOwner,
} from '@/lib/notifications'
import { activatePendingSubscription, rejectPendingSubscription } from '@/lib/subscription-lifecycle'
import { formatTelegramContact } from '@/lib/telegram-contact'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const action = String(body?.action || '').trim().toLowerCase()

    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json({ ok: false, error: 'action: approve | reject' }, { status: 400 })
    }

    const sub = await prisma.subscription.findFirst({
      where: { id, restaurantId: ctx.restaurantId },
      select: {
        id: true,
        status: true,
        name: true,
        user: { select: { telegramId: true, name: true, telegramUsername: true } },
      },
    })
    if (!sub) return NextResponse.json({ ok: false, error: 'не найдена' }, { status: 404 })
    if (sub.status !== 'PENDING') {
      return NextResponse.json({ ok: false, error: 'подписка уже обработана' }, { status: 400 })
    }

    const userName = formatTelegramContact({
      name: sub.user?.name,
      telegramUsername: sub.user?.telegramUsername,
      telegramId: sub.user?.telegramId,
    })

    if (action === 'approve') {
      await activatePendingSubscription(id, ctx.restaurantId)
      await notifySubscriptionStatusChangedToCustomer({
        restaurantId: ctx.restaurantId,
        subscriptionId: id,
        subscriptionName: sub.name,
        status: 'ACTIVE',
        customerTelegramId: sub.user?.telegramId ?? null,
      }).catch(() => {})
      await notifySubscriptionStatusChangedToOwner({
        restaurantId: ctx.restaurantId,
        subscriptionId: id,
        subscriptionName: sub.name,
        status: 'ACTIVE',
        userName,
      }).catch(() => {})
      return NextResponse.json({ ok: true, status: 'ACTIVE' })
    }

    await rejectPendingSubscription(id, ctx.restaurantId)
    await notifySubscriptionStatusChangedToCustomer({
      restaurantId: ctx.restaurantId,
      subscriptionId: id,
      subscriptionName: sub.name,
      status: 'CANCELLED',
      customerTelegramId: sub.user?.telegramId ?? null,
    }).catch(() => {})
    return NextResponse.json({ ok: true, status: 'CANCELLED' })
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    return NextResponse.json({ ok: false, error: e?.message || 'Ошибка' }, { status })
  }
}
