import { NextResponse } from 'next/server'
import type { OrderStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getRestaurantContext, requireRestaurantAdmin } from '@/lib/restaurant-context'
import {
  notifyOrderStatusChangedToCustomer,
  notifyOrderStatusChangedToOwner,
  type OrderTelegramNotifyResult,
} from '@/lib/notifications'
import { appendOrderStatusLog, asOrderStatus, canTransitionOrderStatus } from '@/lib/order-status'
import { ensureMvpTables } from '@/lib/mvp-db'

function buildOrderNotifyHint(
  customer: OrderTelegramNotifyResult,
  owner: OrderTelegramNotifyResult
): string | undefined {
  const parts: string[] = []
  if (customer === 'failed') parts.push('уведомление клиенту в Telegram не доставлено')
  if (owner === 'failed') parts.push('уведомление команде в Telegram не доставлено')
  if (owner === 'skipped_no_ops') parts.push('нет telegramId у OWNER/ADMIN/STAFF — бот не кому писать')
  if (customer === 'skipped_no_recipient') parts.push('у клиента нет telegramId')
  if (customer === 'skipped_no_token' || owner === 'skipped_no_token') parts.push('не настроен токен бота')
  return parts.length ? parts.join(' · ') : undefined
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DEFAULT_LIMIT = 50

export async function GET(request: Request) {
  const detailId = new URL(request.url).searchParams.get('id')
  if (detailId) return getOrderDetail(detailId)
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())
    try {
      await ensureMvpTables()
    } catch {
      // не блокируем экран заказов, если служебные таблицы недоступны
    }
    const { searchParams } = new URL(request.url)
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || DEFAULT_LIMIT))

    const orders = await prisma.order.findMany({
      where: { restaurantId: ctx.restaurantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        status: true,
        itemsCount: true,
        totalAmount: true,
        paymentStatus: true,
        paymentMethod: true,
        paymentOptionSlug: true,
        paymentAmountRub: true,
        receiptUrl: true,
        receiptUploadedAt: true,
        deliveryTime: true,
        createdAt: true,
        userId: true,
        user: { select: { name: true, telegramFirstName: true } },
        address: {
          select: { street: true, city: true },
        },
        items: { select: { id: true } },
      },
    })

    const ids = orders.map((o) => o.id)
    let logs: Array<{ orderId: string; toStatus: string; createdAt: Date }> = []
    if (ids.length) {
      try {
        logs = await prisma.$queryRawUnsafe<Array<{ orderId: string; toStatus: string; createdAt: Date }>>(
          `SELECT DISTINCT ON ("orderId") "orderId","toStatus","createdAt"
           FROM "OrderStatusLog"
           WHERE "restaurantId"=$1 AND "orderId" = ANY($2::text[])
           ORDER BY "orderId","createdAt" DESC`,
          ctx.restaurantId,
          ids
        )
      } catch {
        logs = []
      }
    }
    const lastLogByOrder = new Map(logs.map((l) => [l.orderId, l]))

    return NextResponse.json({
      ok: true,
      orders: orders.map((o) => ({
        id: o.id,
        status: o.status,
        itemsCount:
          Array.isArray(o.items) && o.items.length > 0
            ? o.items.length
            : Number(o.itemsCount ?? 0),
        totalAmount: Number(o.totalAmount),
        paymentStatus: o.paymentStatus,
        paymentMethod: o.paymentMethod,
        paymentOptionSlug: o.paymentOptionSlug,
        paymentAmountRub: o.paymentAmountRub != null ? Number(o.paymentAmountRub) : null,
        receiptUrl: o.receiptUrl,
        receiptUploadedAt: o.receiptUploadedAt,
        deliveryTime: o.deliveryTime,
        createdAt: o.createdAt,
        lastStatusChangeAt: lastLogByOrder.get(o.id)?.createdAt ?? o.createdAt,
        userName: o.user?.name ?? o.user?.telegramFirstName ?? '—',
        address: o.address,
      })),
    })
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    return NextResponse.json(
      { ok: false, error: status === 403 ? 'forbidden' : 'Ошибка' },
      { status }
    )
  }
}

const VALID_ORDER_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
] as const

export async function PATCH(request: Request) {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())
    const body = await request.json().catch(() => ({} as any))
    const orderId = typeof body?.orderId === 'string' ? body.orderId.trim() : ''
    const paymentDecision = typeof body?.paymentDecision === 'string' ? body.paymentDecision.trim().toLowerCase() : ''
    if (orderId && (paymentDecision === 'approve' || paymentDecision === 'reject')) {
      const existing = await prisma.order.findFirst({
        where: { id: orderId, restaurantId: ctx.restaurantId },
        select: {
          id: true,
          status: true,
          paymentStatus: true,
          user: { select: { telegramId: true, name: true, telegramFirstName: true } },
        },
      })
      if (!existing) {
        return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })
      }
      if (String(existing.paymentStatus || '').toUpperCase() !== 'UNDER_REVIEW') {
        return NextResponse.json({ ok: false, error: 'заказ не на проверке оплаты' }, { status: 400 })
      }
      const approve = paymentDecision === 'approve'
      const toStatus = approve ? 'CONFIRMED' : 'CANCELLED'
      await prisma.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: approve ? 'PAID' : 'FAILED',
          status: asOrderStatus(toStatus),
        },
      })
      await appendOrderStatusLog({
        orderId,
        restaurantId: ctx.restaurantId,
        fromStatus: existing.status,
        toStatus,
        changedByUserId: ctx.userId,
        source: 'ADMIN',
        comment: approve ? 'manual_payment_approved_lk' : 'manual_payment_rejected_lk',
      }).catch(() => {})

      const userName = (existing.user as any)?.name ?? (existing.user as any)?.telegramFirstName ?? 'Клиент'
      const customerNotify = await notifyOrderStatusChangedToCustomer({
        restaurantId: ctx.restaurantId,
        orderId,
        status: toStatus,
        customerTelegramId: (existing.user as any)?.telegramId ?? null,
      })
      const ownerNotify = await notifyOrderStatusChangedToOwner({
        restaurantId: ctx.restaurantId,
        orderId,
        status: toStatus,
        userName,
      })
      const notifyHint = buildOrderNotifyHint(customerNotify, ownerNotify)
      return NextResponse.json({
        ok: true,
        status: toStatus,
        paymentStatus: approve ? 'PAID' : 'FAILED',
        notify: { customer: customerNotify, owner: ownerNotify },
        ...(notifyHint ? { notifyHint } : {}),
      })
    }

    const status = typeof body?.status === 'string' ? (body.status as string).toUpperCase() : ''
    if (!orderId || !status) {
      return NextResponse.json({ ok: false, error: 'orderId and status required' }, { status: 400 })
    }
    if (!VALID_ORDER_STATUSES.includes(status as (typeof VALID_ORDER_STATUSES)[number])) {
      return NextResponse.json({ ok: false, error: 'invalid status' }, { status: 400 })
    }
    const existing = await prisma.order.findFirst({
      where: { id: orderId, restaurantId: ctx.restaurantId },
      select: {
        id: true,
        status: true,
        user: { select: { telegramId: true, name: true, telegramFirstName: true } },
      },
    })
    if (!existing) {
      return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })
    }
    if (!canTransitionOrderStatus(existing.status, status)) {
      return NextResponse.json({ ok: false, error: `invalid transition ${existing.status} -> ${status}` }, { status: 400 })
    }
    await prisma.order.update({
      where: { id: orderId },
      data: { status: asOrderStatus(status) },
      select: { id: true, status: true },
    })
    await appendOrderStatusLog({
      orderId,
      restaurantId: ctx.restaurantId,
      fromStatus: existing.status,
      toStatus: status,
      changedByUserId: ctx.userId,
      source: 'ADMIN',
    }).catch(() => {})
    const userName = (existing.user as any)?.name ?? (existing.user as any)?.telegramFirstName ?? 'Клиент'
    const customerNotify = await notifyOrderStatusChangedToCustomer({
      restaurantId: ctx.restaurantId,
      orderId,
      status,
      customerTelegramId: (existing.user as any)?.telegramId ?? null,
    })
    const ownerNotify = await notifyOrderStatusChangedToOwner({
      restaurantId: ctx.restaurantId,
      orderId,
      status,
      userName,
    })

    const notifyHint = buildOrderNotifyHint(customerNotify, ownerNotify)

    return NextResponse.json({
      ok: true,
      status,
      notify: { customer: customerNotify, owner: ownerNotify },
      ...(notifyHint ? { notifyHint } : {}),
    })
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    return NextResponse.json(
      { ok: false, error: status === 403 ? 'forbidden' : 'Ошибка' },
      { status }
    )
  }
}


/** Карточка заказа для кабинета: позиции с названиями и опциями, адрес, заметка гостя, контакт. */
async function getOrderDetail(id: string) {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())
    const o = await prisma.order.findFirst({
      where: { id, restaurantId: ctx.restaurantId },
      select: {
        id: true,
        status: true,
        totalAmount: true,
        discountAmount: true,
        discountDetailsJson: true,
        paymentStatus: true,
        paymentOptionSlug: true,
        paymentAmountRub: true,
        receiptUrl: true,
        receiptUploadedAt: true,
        deliveryTime: true,
        createdAt: true,
        userId: true,
        user: { select: { name: true, telegramFirstName: true, telegramUsername: true, phone: true } },
        address: { select: { street: true, city: true } },
        items: {
          select: {
            id: true,
            quantity: true,
            price: true,
            modifierIds: true,
            dish: { select: { name: true } },
            storeVariant: { select: { name: true, product: { select: { name: true } } } },
          },
        },
      },
    })
    if (!o) return NextResponse.json({ ok: false, error: 'не найден' }, { status: 404 })
    const modIds = [...new Set(o.items.flatMap((it) => it.modifierIds ?? []))]
    const [values, legacy] = modIds.length
      ? await Promise.all([
          prisma.menuOptionValue.findMany({ where: { id: { in: modIds } }, select: { id: true, name: true } }),
          prisma.dishModifier.findMany({ where: { id: { in: modIds } }, select: { id: true, name: true } }).catch(() => []),
        ])
      : [[], []]
    const labelById = new Map<string, string>([...values, ...legacy].map((v) => [v.id, v.name]))
    const details = (o.discountDetailsJson ?? {}) as Record<string, unknown>
    const prior = await prisma.order.count({ where: { restaurantId: ctx.restaurantId, userId: o.userId } })
    return NextResponse.json({
      ok: true,
      order: {
        id: o.id,
        status: o.status,
        totalAmount: Number(o.totalAmount),
        discountAmount: o.discountAmount != null ? Number(o.discountAmount) : 0,
        paymentStatus: o.paymentStatus,
        paymentOptionSlug: o.paymentOptionSlug,
        paymentAmountRub: o.paymentAmountRub != null ? Number(o.paymentAmountRub) : null,
        receiptUrl: o.receiptUrl,
        receiptUploadedAt: o.receiptUploadedAt,
        deliveryTime: o.deliveryTime,
        createdAt: o.createdAt,
        guestNote: typeof details.guestNote === 'string' ? details.guestNote : (typeof details.note === 'string' ? details.note : null),
        source: details.source === 'subscription' ? 'subscription' : 'order',
        customer: {
          name: o.user?.name ?? o.user?.telegramFirstName ?? '—',
          username: o.user?.telegramUsername ?? null,
          phone: o.user?.phone ?? null,
          ordersCount: prior,
        },
        address: o.address,
        items: o.items.map((it) => ({
          id: it.id,
          name: it.dish?.name ?? [it.storeVariant?.product?.name, it.storeVariant?.name].filter(Boolean).join(' · ') ?? '—',
          quantity: it.quantity,
          price: Number(it.price),
          options: (it.modifierIds ?? []).map((m) => labelById.get(m)).filter(Boolean),
        })),
      },
    })
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    return NextResponse.json({ ok: false, error: status === 403 ? 'forbidden' : 'Ошибка' }, { status })
  }
}
