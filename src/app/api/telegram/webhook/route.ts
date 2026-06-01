import { NextRequest, NextResponse } from 'next/server'
import { buildWebAppUrl, sendTelegramMessage, answerCallbackQuery } from '@/lib/telegram'
import { prisma } from '@/lib/prisma'
import {
  formatNotificationMessage,
  getOpsTelegramIds,
  notifyOrderStatusChangedToCustomer,
  notifyOrderStatusChangedToOwner,
  notifySubscriptionStatusChangedToCustomer,
  notifySubscriptionStatusChangedToOwner,
} from '@/lib/notifications'
import { activatePendingSubscription, rejectPendingSubscription } from '@/lib/subscription-lifecycle'
import { formatTelegramContact } from '@/lib/telegram-contact'
import { appendOrderStatusLog, asOrderStatus, canTransitionOrderStatus } from '@/lib/order-status'
import { ORDER_STATUSES } from '@/lib/constants'
import { isQrSlug } from '@/lib/payment-methods'

type TelegramUpdate = {
  update_id?: number
  message?: {
    chat?: { id: number }
    from?: unknown
    text?: string
  }
  callback_query?: {
    id: string
    from?: { id: number; username?: string }
    data?: string
    message?: { chat?: { id: number }; message_id?: number }
  }
}

const ORDER_CALLBACK_PREFIX = 'order_'
const ORDER_ACTION_MAP: Record<string, string> = {
  confirm: 'CONFIRMED',
  preparing: 'PREPARING',
  ready: 'READY',
  out: 'OUT_FOR_DELIVERY',
  delivered: 'DELIVERED',
  cancel: 'CANCELLED',
}

async function handleSubscriptionCallback(
  callbackQueryId: string,
  callbackData: string,
  telegramUserId: number
): Promise<boolean> {
  const match = callbackData.match(/^sub_(confirm|reject)_(.+)$/)
  if (!match) return false
  const [, action, subscriptionId] = match
  if (!subscriptionId) return false

  const sub = await prisma.subscription.findFirst({
    where: { id: subscriptionId },
    select: {
      id: true,
      restaurantId: true,
      status: true,
      name: true,
      user: { select: { telegramId: true, name: true, telegramUsername: true } },
    },
  })
  if (!sub || sub.status !== 'PENDING') {
    await answerCallbackQuery(callbackQueryId, { text: 'Заявка не найдена или уже обработана' }, null)
    return true
  }

  const botToken = await prisma.botIntegration
    .findFirst({ where: { restaurantId: sub.restaurantId }, select: { botToken: true } })
    .then((b) => b?.botToken ?? null)

  const tgStr = String(telegramUserId)
  const opsTelegramIds = await getOpsTelegramIds(sub.restaurantId)
  const user = await prisma.user.findFirst({ where: { telegramId: tgStr }, select: { id: true } })
  const member = user
    ? await prisma.restaurantMember.findFirst({
        where: { restaurantId: sub.restaurantId, userId: user.id, role: { in: ['OWNER', 'ADMIN', 'STAFF'] } },
        select: { id: true },
      })
    : null
  if (!opsTelegramIds.includes(tgStr) && !member) {
    await answerCallbackQuery(callbackQueryId, { text: 'Нет доступа' }, botToken)
    return true
  }

  const userName = formatTelegramContact({
    name: sub.user?.name,
    telegramUsername: sub.user?.telegramUsername,
    telegramId: sub.user?.telegramId,
  })

  if (action === 'confirm') {
    await activatePendingSubscription(subscriptionId, sub.restaurantId)
    await answerCallbackQuery(callbackQueryId, { text: 'Подписка подтверждена' }, botToken)
    await notifySubscriptionStatusChangedToCustomer({
      restaurantId: sub.restaurantId,
      subscriptionId,
      subscriptionName: sub.name,
      status: 'ACTIVE',
      customerTelegramId: sub.user?.telegramId ?? null,
    }).catch(() => {})
    await notifySubscriptionStatusChangedToOwner({
      restaurantId: sub.restaurantId,
      subscriptionId,
      subscriptionName: sub.name,
      status: 'ACTIVE',
      userName,
    }).catch(() => {})
  } else {
    await rejectPendingSubscription(subscriptionId, sub.restaurantId)
    await answerCallbackQuery(callbackQueryId, { text: 'Заявка отклонена' }, botToken)
    await notifySubscriptionStatusChangedToCustomer({
      restaurantId: sub.restaurantId,
      subscriptionId,
      subscriptionName: sub.name,
      status: 'CANCELLED',
      customerTelegramId: sub.user?.telegramId ?? null,
    }).catch(() => {})
  }
  return true
}

async function handleOrderCallback(
  callbackQueryId: string,
  callbackData: string,
  telegramUserId: number,
  request: Request
): Promise<boolean> {
  const match = callbackData.match(/^order_(confirm|preparing|ready|out|delivered|cancel)_(.+)$/)
  if (!match) return false
  const [, action, orderId] = match
  const status = ORDER_ACTION_MAP[action]
  if (!status || !orderId) return false

  const order = await prisma.order.findFirst({
    where: { id: orderId },
    select: {
      id: true,
      restaurantId: true,
      status: true,
      paymentStatus: true,
      paymentOptionSlug: true,
      user: { select: { telegramId: true, name: true, telegramFirstName: true } },
    },
  })
  if (!order || order.status === status) {
    await answerCallbackQuery(callbackQueryId, { text: 'Заказ не найден или статус уже обновлён' }, null)
    return true
  }

  const botToken = await prisma.botIntegration.findFirst({
    where: { restaurantId: order.restaurantId },
    select: { botToken: true },
  }).then((b) => b?.botToken ?? null)

  const tgStr = String(telegramUserId)
  const opsTelegramIds = await getOpsTelegramIds(order.restaurantId)
  const allowedByNotifyList = opsTelegramIds.includes(tgStr)

  const user = await prisma.user.findFirst({
    where: { telegramId: tgStr },
    select: { id: true },
  })
  const member = user
    ? await prisma.restaurantMember.findFirst({
        where: {
          restaurantId: order.restaurantId,
          userId: user.id,
          role: { in: ['OWNER', 'ADMIN', 'STAFF'] },
        },
        select: { id: true },
      })
    : null

  if (!allowedByNotifyList && !member) {
    await answerCallbackQuery(
      callbackQueryId,
      { text: 'Нет доступа к этому заказу' },
      botToken
    )
    return true
  }
  if (!canTransitionOrderStatus(order.status, status)) {
    await answerCallbackQuery(callbackQueryId, { text: `Нельзя: ${order.status} -> ${status}` }, botToken)
    return true
  }

  if (
    status === 'CONFIRMED' &&
    isQrSlug(order.paymentOptionSlug) &&
    String(order.paymentStatus || '').toUpperCase() !== 'PAID'
  ) {
    await answerCallbackQuery(
      callbackQueryId,
      { text: 'Сначала подтвердите оплату по чеку (кнопки в сообщении со снимком)' },
      botToken
    )
    return true
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { status: asOrderStatus(status) },
  })
  await appendOrderStatusLog({
    orderId,
    restaurantId: order.restaurantId,
    fromStatus: order.status,
    toStatus: status,
    changedByUserId: user?.id ?? null,
    source: 'BOT',
  }).catch(() => {})

  const statusLabel = (ORDER_STATUSES as Record<string, string>)[String(status).toUpperCase()] ?? status
  await answerCallbackQuery(callbackQueryId, { text: `Статус: ${statusLabel}` }, botToken)

  const userName = (order.user as any)?.name ?? (order.user as any)?.telegramFirstName ?? 'Клиент'
  try {
    const c = await notifyOrderStatusChangedToCustomer({
      restaurantId: order.restaurantId,
      orderId,
      status,
      customerTelegramId: (order.user as any)?.telegramId ?? null,
    })
    const o = await notifyOrderStatusChangedToOwner({
      restaurantId: order.restaurantId,
      orderId,
      status,
      userName,
    })
    if (c === 'failed' || o === 'failed') {
      console.error('[telegram/webhook] order status notify incomplete', { orderId, status, customer: c, owner: o })
    }
  } catch (e) {
    console.error('[telegram/webhook] order status notify error', { orderId, status, e })
  }

  return true
}

async function handleManualPaymentCallback(
  callbackQueryId: string,
  callbackData: string,
  telegramUserId: number
): Promise<boolean> {
  const ok = callbackData.match(/^payok_(.+)$/)
  const no = callbackData.match(/^payno_(.+)$/)
  if (!ok && !no) return false
  const orderId = String(ok?.[1] || no?.[1] || '').trim()
  const approve = Boolean(ok)

  const order = await prisma.order.findFirst({
    where: { id: orderId },
    select: {
      id: true,
      restaurantId: true,
      paymentStatus: true,
      user: { select: { telegramId: true, name: true, telegramFirstName: true } },
    },
  })
  if (!order || order.paymentStatus !== 'UNDER_REVIEW') {
    await answerCallbackQuery(callbackQueryId, { text: 'Заказ не на проверке оплаты' }, null)
    return true
  }

  const botToken = await prisma.botIntegration
    .findFirst({
      where: { restaurantId: order.restaurantId },
      select: { botToken: true },
    })
    .then((b) => b?.botToken ?? null)

  const tgStr = String(telegramUserId)
  const opsTelegramIds = await getOpsTelegramIds(order.restaurantId)
  const allowedByNotifyList = opsTelegramIds.includes(tgStr)
  const user = await prisma.user.findFirst({
    where: { telegramId: tgStr },
    select: { id: true },
  })
  const member = user
    ? await prisma.restaurantMember.findFirst({
        where: {
          restaurantId: order.restaurantId,
          userId: user.id,
          role: { in: ['OWNER', 'ADMIN', 'STAFF'] },
        },
        select: { id: true },
      })
    : null

  if (!allowedByNotifyList && !member) {
    await answerCallbackQuery(callbackQueryId, { text: 'Нет доступа' }, botToken)
    return true
  }

  if (approve) {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: 'PAID',
        status: 'CONFIRMED',
      },
    })
    await appendOrderStatusLog({
      orderId,
      restaurantId: order.restaurantId,
      fromStatus: 'PENDING',
      toStatus: 'CONFIRMED',
      changedByUserId: user?.id ?? null,
      source: 'BOT',
      comment: 'manual_payment_approved',
    }).catch(() => {})
    await answerCallbackQuery(callbackQueryId, { text: 'Оплата подтверждена' }, botToken)
    const userName = (order.user as any)?.name ?? (order.user as any)?.telegramFirstName ?? 'Клиент'
    try {
      await notifyOrderStatusChangedToCustomer({
        restaurantId: order.restaurantId,
        orderId,
        status: 'CONFIRMED',
        customerTelegramId: (order.user as any)?.telegramId ?? null,
      })
      await notifyOrderStatusChangedToOwner({
        restaurantId: order.restaurantId,
        orderId,
        status: 'CONFIRMED',
        userName,
      })
    } catch {
      // ignore
    }
  } else {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: 'FAILED',
        status: 'CANCELLED',
      },
    })
    await appendOrderStatusLog({
      orderId,
      restaurantId: order.restaurantId,
      fromStatus: 'PENDING',
      toStatus: 'CANCELLED',
      changedByUserId: user?.id ?? null,
      source: 'BOT',
      comment: 'manual_payment_rejected',
    }).catch(() => {})
    await answerCallbackQuery(callbackQueryId, { text: 'Оплата отклонена' }, botToken)
    const userName = (order.user as any)?.name ?? (order.user as any)?.telegramFirstName ?? 'Клиент'
    try {
      await notifyOrderStatusChangedToCustomer({
        restaurantId: order.restaurantId,
        orderId,
        status: 'CANCELLED',
        customerTelegramId: (order.user as any)?.telegramId ?? null,
      })
      await notifyOrderStatusChangedToOwner({
        restaurantId: order.restaurantId,
        orderId,
        status: 'CANCELLED',
        userName,
      })
    } catch {
      // ignore
    }
  }

  return true
}

export async function GET(request: NextRequest) {
  const base = request.nextUrl.origin
  const webhookUrl = `${base}/api/telegram/webhook`
  return new NextResponse(
    `Telegram webhook endpoint. POST only.\n\nTo enable /start (opens mini app in guest context), set webhook:\n\nPOST https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=${encodeURIComponent(webhookUrl)}\n\nReplace <BOT_TOKEN> with your bot token. BOT_TOKEN or TELEGRAM_BOT_TOKEN must be set in env.`,
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
  )
}

export async function POST(request: Request) {
  const token = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    return NextResponse.json({ ok: false, error: 'missing_bot_token' }, { status: 500 })
  }

  let body: TelegramUpdate
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const callbackQuery = body?.callback_query
  if (callbackQuery?.id && callbackQuery?.data && callbackQuery?.from?.id != null) {
    const data = String(callbackQuery.data)
    if (data.startsWith('payok_') || data.startsWith('payno_')) {
      await handleManualPaymentCallback(callbackQuery.id, data, callbackQuery.from.id)
      return NextResponse.json({ ok: true })
    }
    if (data.startsWith('sub_confirm_') || data.startsWith('sub_reject_')) {
      await handleSubscriptionCallback(callbackQuery.id, data, callbackQuery.from.id)
      return NextResponse.json({ ok: true })
    }
    if (data.startsWith(ORDER_CALLBACK_PREFIX)) {
      const handled = await handleOrderCallback(
        callbackQuery.id,
        data,
        callbackQuery.from.id,
        request
      )
      return NextResponse.json({ ok: true })
    }
  }

  const chatId = body?.message?.chat?.id
  const text = body?.message?.text?.trim()

  if (chatId == null) {
    return NextResponse.json({ ok: true })
  }

  const isStart = text === '/start' || (typeof text === 'string' && text.startsWith('/start'))

  if (!isStart) {
    return NextResponse.json({ ok: true })
  }

  const startPayload = (() => {
    if (typeof text !== 'string') return ''
    const m = text.match(/^\/start(?:\s+(.+))?$/)
    return String(m?.[1] || '').trim()
  })()

  let resolvedStartParam = startPayload
  let shouldShowChooserHint = false
  if (!resolvedStartParam) {
    try {
      // MVP behavior:
      // - 1 venue on this bot token => auto-open that venue
      // - multiple venues => open generic app (it can ask user to choose)
      const integrationsByToken = await prisma.botIntegration.findMany({
        where: { botToken: token },
        select: { startParam: true, restaurant: { select: { isActive: true } } },
        orderBy: { createdAt: 'asc' },
      })
      const activeByToken = integrationsByToken.filter((i) => i.restaurant?.isActive !== false)
      if (activeByToken.length === 1) {
        resolvedStartParam = String(activeByToken[0]?.startParam || '').trim()
      } else if (activeByToken.length > 1) {
        shouldShowChooserHint = true
      } else {
        // Legacy fallback: some integrations were created without per-row botToken.
        const allActive = await prisma.botIntegration.findMany({
          select: { startParam: true, restaurant: { select: { isActive: true } } },
          orderBy: { createdAt: 'asc' },
        })
        const active = allActive.filter((i) => i.restaurant?.isActive !== false)
        if (active.length === 1) {
          resolvedStartParam = String(active[0]?.startParam || '').trim()
        } else if (active.length > 1) {
          shouldShowChooserHint = true
        }
      }
    } catch (e) {
      console.error('[telegram/webhook] start resolution fallback', e)
      // Keep empty start param fallback so /start still replies with open-app button.
      resolvedStartParam = ''
      shouldShowChooserHint = false
    }
  }

  const appUrl = buildWebAppUrl(
    resolvedStartParam ? `/?startapp=${encodeURIComponent(resolvedStartParam)}` : '/'
  )
  const startText = formatNotificationMessage({
    emoji: '🚀',
    title: 'MOO mini app',
    metricsLine: 'Заказы, подписки и управление заведением в одном месте.',
    bulletLines: shouldShowChooserHint
      ? ['• Откройте приложение кнопкой ниже.', '• Если появится выбор, выберите нужное заведение.']
      : ['• Открывайте приложение кнопкой ниже.'],
  })
  const startMessagePayload = {
    text: startText,
    parse_mode: 'HTML' as const,
    reply_markup: {
      inline_keyboard: [[{ text: 'Перейти в приложение', web_app: { url: appUrl } }]],
    },
  }
  let result = await sendTelegramMessage(String(chatId), startMessagePayload, token)
  if (!result.ok) {
    // Fallback: if env BOT_TOKEN is stale, retry with botIntegration tokens.
    // This keeps /start alive in single-tenant and mixed migration states.
    const fallbackRows = await prisma.botIntegration.findMany({
      where: { restaurant: { isActive: true } },
      select: { botToken: true },
      orderBy: { createdAt: 'asc' },
      take: 5,
    })
    const fallbackTokens = Array.from(
      new Set(
        fallbackRows
          .map((r) => String(r.botToken || '').trim())
          .filter((t) => t && t !== token)
      )
    )
    for (const fallbackToken of fallbackTokens) {
      result = await sendTelegramMessage(String(chatId), startMessagePayload, fallbackToken)
      if (result.ok) break
    }
  }

  if (!result.ok) {
    try {
      await fetch(new URL('/api/client-error', request.url).origin + '/api/client-error', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'telegram_webhook_send_failed',
          chatId,
          ok: result.ok,
          ts: Date.now(),
        }),
      })
    } catch {}
  }

  if (!result.ok) {
    console.error('[telegram/webhook] /start send failed', {
      chatId,
      hasStartPayload: Boolean(startPayload),
      resolvedStartParam,
    })
    return NextResponse.json({ ok: false, error: 'send_failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
