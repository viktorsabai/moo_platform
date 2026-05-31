// API Route: POST /api/orders - создание заказа
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { randomUUID } from 'crypto'
import { escapeHtml } from '@/lib/telegram'
import {
  formatOrderPaymentLine,
  notifyOrderCreatedToCustomer,
  notifyOrderCreatedToOwner,
  type OrderPromoNotifyInfo,
} from '@/lib/notifications'
import { getConsumerRestaurantId } from '@/lib/restaurant-context'
import { ensureMvpTables } from '@/lib/mvp-db'
import { appendOrderStatusLog } from '@/lib/order-status'
import { computeTrustedItemsAndSubtotal } from '@/lib/order-pricing'
import { resolveApiUser } from '@/lib/tg-auth-resolver'
import {
  computeRubTotal,
  isQrSlug,
  mergePaymentMethodsWithDefaults,
  methodsAvailableForConsumer,
} from '@/lib/payment-methods'
import { evaluateCampaign, giftDishIdFromPayload, parseCampaignCode, pickBestCampaign } from '@/lib/campaigns'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const authUser = await resolveApiUser(headers())
  const userId = authUser.userId
  const restaurantId = await getConsumerRestaurantId()
  if (!userId) {
    return NextResponse.json({ error: 'нужна авторизация через telegram' }, { status: 401 })
  }

  const orders = await prisma.order.findMany({
    where: { userId, restaurantId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      itemsCount: true,
      totalAmount: true,
      paymentStatus: true,
      paymentMethod: true,
      paymentOptionSlug: true,
      campaignCode: true,
      discountAmount: true,
      discountDetailsJson: true,
      paymentAmountRub: true,
      receiptUrl: true,
      deliveryTime: true,
      createdAt: true,
      address: {
        select: {
          id: true,
          street: true,
          city: true,
          zipCode: true,
          country: true,
          isDefault: true,
        },
      },
      items: {
        select: {
          id: true,
          quantity: true,
          price: true,
          modifierIds: true,
          dish: { select: { id: true, name: true } },
          storeVariant: { select: { id: true, name: true } },
        },
      },
    },
  })

  const allModifierIds = Array.from(
    new Set(
      orders
        .flatMap((o) => o.items ?? [])
        .flatMap((it: any) => (Array.isArray(it?.modifierIds) ? it.modifierIds : []))
        .map((id) => String(id || '').trim())
        .filter(Boolean)
    )
  )
  let modifierLabelById: Record<string, string> = {}
  if (allModifierIds.length > 0) {
    const [dishModifiers, menuOptionValues] = await Promise.all([
      prisma.dishModifier.findMany({
        where: { dish: { restaurantId }, id: { in: allModifierIds } },
        select: { id: true, name: true },
      }),
      prisma.menuOptionValue.findMany({
        where: { restaurantId, id: { in: allModifierIds } },
        select: { id: true, name: true },
      }),
    ])
    modifierLabelById = Object.fromEntries(
      [...dishModifiers, ...menuOptionValues]
        .map((x) => [String(x.id), String(x.name || '').trim()] as const)
        .filter(([, name]) => Boolean(name))
    )
  }

  return NextResponse.json({
    ok: true,
    orders: orders.map((o) => ({
      ...o,
      totalAmount: Number(o.totalAmount),
      discountAmount: o.discountAmount != null ? Number(o.discountAmount) : null,
      paymentAmountRub: o.paymentAmountRub != null ? Number(o.paymentAmountRub) : null,
      itemsCount: Number.isFinite(o.itemsCount) && o.itemsCount > 0 ? o.itemsCount : o.items.length,
      items: (o.items ?? []).map((it: any) => ({
        ...it,
        price: Number(it?.price ?? 0),
        modifierIds: Array.isArray(it?.modifierIds)
          ? it.modifierIds.map((id: unknown) => String(id || '').trim()).filter(Boolean)
          : [],
        modifierLabels: Array.isArray(it?.modifierIds)
          ? it.modifierIds
              .map((id: unknown) => modifierLabelById[String(id || '').trim()])
              .filter(Boolean)
          : [],
      })),
    })),
  })
}

export async function POST(request: Request) {
  try {
    const authUser = await resolveApiUser(headers())
    const userId = authUser.userId
    const telegramId = authUser.telegramId
    const restaurantId = await getConsumerRestaurantId()

    if (!userId || !telegramId) {
      return NextResponse.json({ error: 'нужна авторизация через telegram' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({} as any))
    const clientRequestId = typeof body?.clientRequestId === 'string' ? body.clientRequestId.trim() : ''
    if (clientRequestId) {
      const existing = await prisma.order.findFirst({
        where: { userId, restaurantId, clientRequestId },
        select: { id: true },
      })
      if (existing?.id) {
        return NextResponse.json({ ok: true, orderId: existing.id, duplicate: true })
      }
    }

    const totalAmountRaw = Number(body?.totalAmount ?? 0)
    const totalAmount = Number.isFinite(totalAmountRaw) ? totalAmountRaw : 0
    const paymentIntentId = typeof body?.paymentIntentId === 'string' ? body.paymentIntentId.trim() : null
    const deliveryFee = Math.max(0, Number(body?.deliveryFee ?? 0))
    const deliveryTime = body?.deliveryTime ? new Date(String(body.deliveryTime)) : undefined
    const address = body?.address || {}
    const notes = typeof body?.notes === 'string' ? body.notes.trim() : ''
    const promoCode = parseCampaignCode(body?.promoCode || body?.campaignCode)
    const promoCampaignId = typeof body?.campaignId === 'string' ? body.campaignId.trim() : ''
    const fulfillmentRaw = String(body?.fulfillment ?? 'DELIVERY').toUpperCase()
    const isPickupOrder = fulfillmentRaw === 'PICKUP'
    const items = Array.isArray(body?.items) ? body.items : []

    let { items: trustedItems, subtotal } = await computeTrustedItemsAndSubtotal(restaurantId, items)
    if (!trustedItems.length) {
      return NextResponse.json({ error: 'корзина пуста или товары недоступны' }, { status: 400 })
    }
    if (!isPickupOrder) {
      await ensureMvpTables()
      const zoneRows = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
        `SELECT COUNT(*)::int AS count FROM "DeliveryZone" WHERE "restaurantId"=$1 AND "isActive"=TRUE`,
        restaurantId
      )
      const activeZones = Math.max(0, Number(zoneRows?.[0]?.count ?? 0))
      if (activeZones === 0) {
        return NextResponse.json({ error: 'доставка недоступна — выберите самовывоз' }, { status: 400 })
      }
    }
    const userOrdersCount = await prisma.order.count({ where: { userId, restaurantId } })
    let campaignApply:
      | {
          campaignId: string
          campaignCode: string | null
          discountAmount: number
          gift: unknown
          details: unknown
          finalTotal: number
        }
      | null = null

    const [campaigns, redemptions] = await Promise.all([
      promoCampaignId
        ? prisma.campaign.findMany({
            where: {
              id: promoCampaignId,
              restaurantId,
              status: 'ACTIVE',
              visibility: { in: ['PUBLIC', 'ASSIGNED_ONLY'] },
            },
          })
        : promoCode
          ? prisma.campaign.findMany({
              where: {
                restaurantId,
                status: 'ACTIVE',
                code: { equals: promoCode, mode: 'insensitive' },
              },
            })
          : prisma.campaign.findMany({
              where: { restaurantId, status: 'ACTIVE', kind: 'AUTO' },
            }),
      prisma.campaignRedemption.findMany({
        where: { userId, restaurantId },
        select: { campaignId: true },
      }),
    ])
    const usedMap = redemptions.reduce<Record<string, number>>((acc, x) => {
      acc[x.campaignId] = (acc[x.campaignId] || 0) + 1
      return acc
    }, {})
    const campaignCtx = {
      userId,
      userTelegramId: telegramId,
      code: promoCode,
      subtotal,
      deliveryFee,
      items: trustedItems.map((it: any) => ({
        kind: it.kind,
        quantity: Number(it.quantity || 1),
        unitPrice: Number(it.unitPrice || 0),
        dishId: it.dishId || null,
        storeVariantId: it.storeVariantId || null,
        categoryId: it.categoryId || null,
      })),
      userOrdersCount,
      userUsedCountByCampaignId: usedMap,
    }
    if (promoCode || promoCampaignId || campaigns.length > 0) {
      const campaignResult =
        promoCampaignId && campaigns.length === 1
          ? evaluateCampaign(campaigns[0], campaignCtx)
          : pickBestCampaign(campaigns, campaignCtx)
      if ((promoCode || promoCampaignId) && !campaignResult.ok) {
        return NextResponse.json({ error: `promo invalid: ${campaignResult.reason || 'not_applicable'}` }, { status: 400 })
      }
      if (campaignResult.ok && campaignResult.campaign) {
        campaignApply = {
          campaignId: String(campaignResult.campaign?.id || ''),
          campaignCode: campaignResult.campaignCode || promoCode || null,
          discountAmount: campaignResult.discountAmount,
          gift: campaignResult.gift || null,
          details: campaignResult.details,
          finalTotal: campaignResult.finalTotal,
        }
      }
    }

    if (campaignApply?.gift) {
      const gid = giftDishIdFromPayload((campaignApply.gift as { payload?: unknown })?.payload)
      if (gid) {
        const already = trustedItems.some((t) => t.kind === 'dish' && t.dishId === gid)
        if (!already) {
          const giftDish = await prisma.dish.findFirst({
            where: { id: gid, restaurantId, isAvailable: true },
            select: { id: true, name: true },
          })
          if (giftDish) {
            trustedItems = [
              ...trustedItems,
              {
                kind: 'dish' as const,
                dishId: giftDish.id,
                storeVariantId: '',
                name: giftDish.name,
                quantity: 1,
                unitPrice: 0,
                modifierIds: [] as string[],
              },
            ]
          }
        }
      }
    }
    const trustedTotal = Number(
      (
        campaignApply?.finalTotal ??
        Number((subtotal + deliveryFee).toFixed(2))
      ).toFixed(2)
    )
    if (Math.abs(trustedTotal - totalAmount) > 0.01) {
      return NextResponse.json(
        { error: `amount mismatch: expected ${trustedTotal}, got ${Number(totalAmount.toFixed(2))}` },
        { status: 400 }
      )
    }

    const appSettings = await prisma.appSettings.findUnique({
      where: { restaurantId },
      select: { paymentMethodsJson: true },
    })
    const mergedMethods = mergePaymentMethodsWithDefaults(appSettings?.paymentMethodsJson)
    const availableForPay = methodsAvailableForConsumer(mergedMethods)
    const allowedSlugs = new Set(availableForPay.map((m) => m.slug))

    const paymentOptionSlug = String(body?.paymentOptionSlug ?? body?.paymentMethod ?? 'CASH')
      .trim()
      .toUpperCase()
    if (!allowedSlugs.has(paymentOptionSlug)) {
      return NextResponse.json({ error: 'способ оплаты недоступен' }, { status: 400 })
    }

    const methodRow = mergedMethods.find((m) => m.slug === paymentOptionSlug)
    if (paymentOptionSlug === 'STRIPE' && !paymentIntentId) {
      return NextResponse.json({ error: 'paymentIntentId required for STRIPE' }, { status: 400 })
    }

    let initialPaymentStatus: 'PENDING' | 'AWAITING_RECEIPT' = 'PENDING'
    if (isQrSlug(paymentOptionSlug)) {
      initialPaymentStatus = 'AWAITING_RECEIPT'
    }

    let paymentAmountRub: Prisma.Decimal | undefined
    let fxRubPerThb: Prisma.Decimal | undefined
    let rubForLine: number | null = null
    if (paymentOptionSlug === 'QR_RUB' && methodRow?.rubPerThb && Number.isFinite(Number(methodRow.rubPerThb))) {
      rubForLine = computeRubTotal(trustedTotal, Number(methodRow.rubPerThb))
      paymentAmountRub = new Prisma.Decimal(String(rubForLine))
      fxRubPerThb = new Prisma.Decimal(String(methodRow.rubPerThb))
    }

    const dishCreates = trustedItems.filter((i) => i.kind === 'dish')
    const storeCreates = trustedItems.filter((i) => i.kind === 'store')
    const validItemsCount = trustedItems.length

    const createData: any = {
      ...(clientRequestId ? { clientRequestId } : {}),
      status: 'PENDING',
      paymentStatus: initialPaymentStatus,
      paymentMethod: paymentOptionSlug,
      paymentOptionSlug,
      ...(paymentIntentId ? { paymentIntentId } : {}),
      ...(paymentAmountRub ? { paymentAmountRub } : {}),
      ...(fxRubPerThb ? { fxRubPerThb } : {}),
      ...(campaignApply?.campaignId ? { campaign: { connect: { id: campaignApply.campaignId } } } : {}),
      ...(campaignApply?.campaignCode ? { campaignCode: campaignApply.campaignCode } : {}),
      ...(campaignApply ? { discountAmount: new Prisma.Decimal(String(campaignApply.discountAmount || 0)) } : {}),
      ...(campaignApply ? { discountDetailsJson: { ...(campaignApply.details as any), gift: campaignApply.gift || null } } : {}),
      itemsCount: Math.max(0, validItemsCount),
      totalAmount: new Prisma.Decimal(String(trustedTotal)),
      deliveryTime: deliveryTime && !Number.isNaN(deliveryTime.getTime()) ? deliveryTime : undefined,
      restaurant: { connect: { id: restaurantId } },
      user: { connect: { id: userId } },
      address: {
        create: {
          street: String(address.street || address.address || ''),
          city: String(address.city || '—'),
          zipCode: String(address.zipCode || ''),
          country: String(address.country || 'Thailand'),
          /** Самовывоз: адрес ресторана — только снимок заказа, не подменяем домашний адрес в профиле. */
          isDefault: !isPickupOrder,
          user: { connect: { id: userId } },
        },
      },
    }

    let order: { id: string }
    try {
      order = await prisma.$transaction(async (tx) => {
        const created = await tx.order.create({
          data: createData,
          select: { id: true },
        })

        // store stock decrement (atomic) before creating order items
        for (const it of storeCreates) {
          const id = String(it.storeVariantId)
          const qty = Math.max(1, Number(it.quantity))
          const updated = await tx.storeVariant.updateMany({
            where: { id, restaurantId, qty: { gte: qty } },
            data: { qty: { decrement: qty } },
          })
          if (updated.count !== 1) {
            throw new Error('out_of_stock')
          }
        }

        if (dishCreates.length || storeCreates.length) {
          await tx.orderItem.createMany({
            data: [
              ...dishCreates.map((it: any) => ({
                orderId: created.id,
                dishId: it.dishId,
                storeVariantId: null,
                quantity: it.quantity,
                price: new Prisma.Decimal(String(it.unitPrice)),
                modifierIds: it.modifierIds ?? [],
              })),
              ...storeCreates.map((it: any) => ({
                orderId: created.id,
                dishId: null,
                storeVariantId: it.storeVariantId,
                quantity: it.quantity,
                price: new Prisma.Decimal(String(it.unitPrice)),
                modifierIds: [],
              })),
            ],
          })
        }
        if (campaignApply?.campaignId) {
          await tx.campaignRedemption.create({
            data: {
              campaignId: campaignApply.campaignId,
              orderId: created.id,
              userId,
              restaurantId,
              codeSnapshot: campaignApply.campaignCode || null,
              discountAmount: new Prisma.Decimal(String(campaignApply.discountAmount || 0)),
              detailsJson: { details: campaignApply.details || null, gift: campaignApply.gift || null },
            },
          })
        }

        return created
      })
    } catch (e: any) {
      // idempotency: if duplicate key, return existing order id (and do NOT send notification twice)
      if (clientRequestId && e?.code === 'P2002') {
        const existing = await prisma.order.findFirst({
          where: { userId, restaurantId, clientRequestId },
          select: { id: true },
        })
        if (existing?.id) {
          return NextResponse.json({ ok: true, orderId: existing.id, duplicate: true })
        }
      }
      if (String(e?.message || '') === 'out_of_stock') {
        return NextResponse.json({ error: 'нет в наличии (остатки изменились)' }, { status: 409 })
      }
      throw e
    }

    const allModifierIds = Array.from(
      new Set(
        trustedItems
          .flatMap((it: any) => (Array.isArray(it?.modifierIds) ? it.modifierIds : []))
          .map((id: unknown) => String(id || '').trim())
          .filter(Boolean)
      )
    )
    let modifierLabelById: Record<string, string> = {}
    if (allModifierIds.length > 0) {
      const [dishModifiers, menuOptionValues] = await Promise.all([
        prisma.dishModifier.findMany({
          where: { dish: { restaurantId }, id: { in: allModifierIds } },
          select: { id: true, name: true },
        }),
        prisma.menuOptionValue.findMany({
          where: { restaurantId, id: { in: allModifierIds } },
          select: { id: true, name: true },
        }),
      ])
      modifierLabelById = Object.fromEntries(
        [...dishModifiers, ...menuOptionValues]
          .map((x) => [String(x.id), String(x.name || '').trim()] as const)
          .filter(([, name]) => Boolean(name))
      )
    }

    const prettyLines = trustedItems.map((it: any) => {
      const variantLabelRaw = String(it?.variantName || '').trim()
      const variantLabel =
        variantLabelRaw && variantLabelRaw.toLowerCase() !== 'по умолчанию' && variantLabelRaw.toLowerCase() !== 'default'
          ? variantLabelRaw
          : ''
      const baseName = String(it?.name || it?.dishName || (it?.kind === 'store' ? 'товар' : 'блюдо'))
      const itemName = variantLabel ? `${baseName} · ${variantLabel}` : baseName
      const labels: string[] = Array.isArray(it?.modifierIds)
        ? it.modifierIds
            .map((id: unknown) => modifierLabelById[String(id || '').trim()])
            .filter((s: string | undefined): s is string => Boolean(s))
        : []
      const suffix = labels.length ? ` (${labels.map((x) => escapeHtml(x)).join(', ')})` : ''
      return `• ${escapeHtml(itemName)} ×${escapeHtml(String(it.quantity))}${suffix}`
    })
    const addressLine = [String(address.street || ''), String(address.city || '')]
      .map((x) => x.trim())
      .filter(Boolean)
      .join(', ')
    const deliveryEtaText =
      deliveryTime && !Number.isNaN(deliveryTime.getTime())
        ? `к ${deliveryTime.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
        : undefined
    const paymentLine = formatOrderPaymentLine(initialPaymentStatus, paymentOptionSlug, {
      rubAmount: rubForLine,
    })

    const promoNotify: OrderPromoNotifyInfo | undefined =
      campaignApply &&
      (String(campaignApply.campaignCode || '').trim() ||
        Number(campaignApply.discountAmount || 0) > 0.009 ||
        (campaignApply.gift && String((campaignApply.gift as { title?: string }).title || '').trim()))
        ? {
            campaignCode: campaignApply.campaignCode,
            discountAmount: Number(campaignApply.discountAmount || 0),
            giftTitle: campaignApply.gift
              ? String((campaignApply.gift as { title?: string }).title || '').trim() || null
              : null,
          }
        : undefined

    await notifyOrderCreatedToCustomer({
      restaurantId,
      orderId: order.id,
      totalAmount: trustedTotal,
      itemsCount: validItemsCount || items.length,
      prettyLines,
      customerTelegramId: String(telegramId),
      addressLine,
      deliveryEtaText,
      paymentLine,
      notes: notes || undefined,
      customerOrderPath: initialPaymentStatus === 'AWAITING_RECEIPT' ? `/orders/${order.id}/pay` : undefined,
      promo: promoNotify,
    }).catch(() => {})

    const userName = authUser.name ?? 'Клиент'
    notifyOrderCreatedToOwner({
      restaurantId,
      orderId: order.id,
      userName,
      totalAmount: trustedTotal,
      itemsCount: validItemsCount || items.length,
      prettyLines,
      addressLine,
      deliveryEtaText,
      paymentLine,
      notes: notes || undefined,
      paymentStatus: initialPaymentStatus,
      paymentOptionSlug,
      promo: promoNotify,
    }).catch((err) => {
      console.error('[orders/create] notifyOrderCreatedToOwner failed', {
        orderId: order.id,
        restaurantId,
        err: String((err as any)?.message || err || ''),
      })
    })
    appendOrderStatusLog({
      orderId: order.id,
      restaurantId,
      fromStatus: null,
      toStatus: 'PENDING',
      changedByUserId: userId,
      source: 'SYSTEM',
    }).catch(() => {})

    prisma.$executeRawUnsafe(
      `INSERT INTO "UserActivityEvent" ("id", "restaurantId", "userId", "telegramId", "type", "path", "metadata", "createdAt")
       VALUES ($1, $2, $3, $4, 'SUBMIT_ORDER', '/checkout', $5::jsonb, NOW())`,
      randomUUID(),
      restaurantId,
      userId,
      String(telegramId),
      JSON.stringify({ orderId: order.id, totalAmount: trustedTotal, itemsCount: validItemsCount })
    ).catch(() => {})

    return NextResponse.json({ ok: true, orderId: order.id })
  } catch (error) {
    return NextResponse.json(
      { error: 'ошибка при создании заказа' },
      { status: 500 }
    )
  }
}
