import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRestaurantContext, requireRestaurantAdmin } from '@/lib/restaurant-context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'активная',
  PAUSED: 'на паузе',
  CANCELLED: 'отменена',
  EXPIRED: 'закончилась',
}

export async function GET() {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())

    const subs = await prisma.subscription.findMany({
      where: { restaurantId: ctx.restaurantId },
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

    const mapped = subs.map((s) => ({
      ...s,
      price: Number(s.price),
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
        scheduledDate: d.scheduledDate,
        status: d.status,
      })),
    }))

    return NextResponse.json({ ok: true, subscriptions: mapped })
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    return NextResponse.json({ ok: false, error: status === 403 ? 'forbidden' : 'Ошибка' }, { status })
  }
}

/** DELETE: удалить подписку по id, или все подписки ресторана (resetAll=1) */
export async function DELETE(request: Request) {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const resetAll = searchParams.get('resetAll') === '1'

    if (resetAll) {
      const deleted = await prisma.subscription.deleteMany({
        where: { restaurantId: ctx.restaurantId },
      })
      return NextResponse.json({ ok: true, deleted: deleted.count })
    }

    if (!id) return NextResponse.json({ ok: false, error: 'id обязателен' }, { status: 400 })
    const sub = await prisma.subscription.findFirst({
      where: { id, restaurantId: ctx.restaurantId },
      select: { id: true },
    })
    if (!sub) return NextResponse.json({ ok: false, error: 'не найдена' }, { status: 404 })
    await prisma.subscription.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    return NextResponse.json({ ok: false, error: status === 403 ? 'forbidden' : 'Ошибка' }, { status })
  }
}
