/**
 * Уведомления в Telegram: заказы, подписки.
 * Единый шаблон: [emoji] Заголовок | Метрики | bullet-список | закрывающая фраза | кнопки.
 */
import { prisma } from '@/lib/prisma'
import { buildWebAppUrl, escapeHtml, sendTelegramMessage, sendTelegramPhotoUrl } from '@/lib/telegram'
import { formatPrice } from '@/lib/utils'
import { ORDER_STATUSES, PAYMENT_STATUSES } from '@/lib/constants'
import { isQrSlug } from '@/lib/payment-methods'
import { canCancelOrderStatus, getOrderNextAction } from '@/lib/order-status'

/** Результат попытки отправить сообщение в Telegram (для API и логов). */
export type OrderTelegramNotifyResult =
  | 'sent'
  | 'skipped_no_recipient'
  | 'skipped_no_token'
  | 'skipped_no_ops'
  | 'failed'

/** Общий шаблон для клиентских и владельческих нотификаций */
export interface NotificationMessage {
  lines: string[]
  closingPhrase?: string
}

export function formatNotificationMessage(params: {
  emoji: string
  title: string
  metricsLine?: string
  bulletLines?: string[]
  closingPhrase?: string
}): string {
  const { emoji, title, metricsLine, bulletLines = [], closingPhrase } = params
  const parts: string[] = [`<b>${emoji} ${title}</b>`]
  if (metricsLine) parts.push(metricsLine)
  if (bulletLines.length > 0) parts.push(...bulletLines)
  if (closingPhrase) parts.push(closingPhrase)
  return parts.join('\n')
}

/** Данные акции для чека в Telegram (заказ создан). */
export type OrderPromoNotifyInfo = {
  campaignCode?: string | null
  discountAmount?: number
  giftTitle?: string | null
}

function buildPromoReceiptLines(promo: OrderPromoNotifyInfo | null | undefined): string[] {
  if (!promo) return []
  const lines: string[] = []
  const code = String(promo.campaignCode || '').trim()
  const disc = Number(promo.discountAmount ?? 0)
  const gift = String(promo.giftTitle || '').trim()
  if (code) lines.push(`• Промокод: <code>${escapeHtml(code)}</code>`)
  if (Number.isFinite(disc) && disc > 0.009) lines.push(`• Скидка: <b>−${escapeHtml(formatPrice(disc))}</b>`)
  if (gift) lines.push(`• Подарок: ${escapeHtml(gift)}`)
  return lines
}

/**
 * Заказ в Telegram: секции с пустыми строками (визуально как чек), без сплошной «простыни».
 * summaryHtml / detailLines / itemLines — уже с escapeHtml там, где нужен plain-текст.
 */
export function formatOrderCreatedTelegramHtml(params: {
  emoji: string
  title: string
  summaryHtml: string
  detailLines: string[]
  promo?: OrderPromoNotifyInfo | null
  itemLines: string[]
  closingPhrase?: string
}): string {
  const blocks: string[] = []
  blocks.push(`<b>${params.emoji} ${escapeHtml(params.title)}</b>`)
  blocks.push('')
  blocks.push(`<i>${params.summaryHtml}</i>`)

  if (params.detailLines.length > 0) {
    blocks.push('')
    blocks.push('<b>Условия</b>')
    blocks.push(...params.detailLines)
  }

  const promoLines = buildPromoReceiptLines(params.promo)
  if (promoLines.length > 0) {
    blocks.push('')
    blocks.push('<b>Акция</b>')
    blocks.push(...promoLines)
  }

  if (params.itemLines.length > 0) {
    blocks.push('')
    blocks.push('<b>Позиции</b>')
    blocks.push(...params.itemLines)
  }

  if (params.closingPhrase) {
    blocks.push('')
    blocks.push(`<i>${escapeHtml(params.closingPhrase)}</i>`)
  }

  return blocks.join('\n')
}

const ORDER_STATUS_LABEL: Record<string, string> = ORDER_STATUSES as Record<string, string>

const ORDER_STATUS_NEXT_STEP_CUSTOMER: Record<string, string> = {
  PENDING: 'Мы сообщим, когда заказ подтвердят.',
  CONFIRMED: 'Заказ подтверждён. Скоро начнём готовить — пришлём уведомление.',
  PREPARING: 'Готовим заказ — сообщим, когда будет готов к передаче в доставку.',
  READY: 'Заказ готов. Передаём курьеру.',
  OUT_FOR_DELIVERY: 'Курьер уже в пути.',
  DELIVERED: 'Заказ доставлен. Приятного аппетита!',
  CANCELLED: 'Заказ отменен. Если это ошибка — оформите заказ снова.',
}

function ownerClosingPhraseAfterStatus(status: string): string | undefined {
  const next = getOrderNextAction(status)
  if (next) {
    return `Следующий шаг: нажмите «${next.label}» ниже или в приложении «Заказы».`
  }
  return 'Откройте заказ в приложении при необходимости.'
}

const SUB_STATUS_LABEL: Record<string, string> = {
  PENDING: 'На подтверждении',
  ACTIVE: 'Активна',
  PAUSED: 'На паузе',
  CANCELLED: 'Отменена',
  EXPIRED: 'Истекла',
  DRAFT: 'Черновик',
}

const SUB_STATUS_NEXT_CUSTOMER: Record<string, string> = {
  PENDING: 'Заведение проверит рацион и подтвердит подписку.',
  ACTIVE: 'Подписка активна — следите за доставками в приложении.',
  CANCELLED: 'Подписка отменена. Можно оформить новую.',
}

const LEAD_TYPE_LABEL: Record<string, string> = {
  catering: 'Кейтеринг',
  banquet: 'Банкет',
  corporate: 'Корпоратив',
  custom: 'Заявка',
}

/** Получить telegramId операционной команды ресторана (OWNER/ADMIN/STAFF). */
export async function getOpsTelegramIds(restaurantId: string): Promise<string[]> {
  const parseTelegramIds = (value: string) =>
    String(value || '')
      .split(',')
      .map((s) => s.trim().replace(/^['"]+|['"]+$/g, ''))
      .filter(Boolean)

  const fromEnv = [
    ...parseTelegramIds(String(process.env.UFO_OWNER_NOTIFY_TELEGRAM_IDS || '')),
    ...parseTelegramIds(String(process.env.UFO_SUPERADMIN_TELEGRAM_ID || process.env.SUPERADMIN_TELEGRAM_IDS || '')),
  ]

  const members = await prisma.restaurantMember.findMany({
    where: { restaurantId, role: { in: ['OWNER', 'ADMIN', 'STAFF'] } },
    select: { user: { select: { telegramId: true } } },
  })
  const fromDb = members.map((m) => m.user?.telegramId).filter((id): id is string => Boolean(id))

  // Always include platform superadmins from DB (even when team members exist).
  const superadmins = await prisma.user.findMany({
    where: {
      telegramId: { not: null },
      OR: [{ platformRole: 'SUPERADMIN' }, { role: 'SUPERADMIN' }],
    },
    select: { telegramId: true },
    take: 20,
  })
  const fromSuperadmins = superadmins
    .map((u) => String(u.telegramId || '').trim())
    .filter(Boolean)
  return [...new Set([...fromDb, ...fromSuperadmins, ...fromEnv])]
}

async function getBotToken(restaurantId: string): Promise<string | null> {
  const bot = await prisma.botIntegration.findFirst({
    where: { restaurantId },
    select: { botToken: true },
  })
  return bot?.botToken ?? process.env.BOT_TOKEN ?? process.env.TELEGRAM_BOT_TOKEN ?? null
}

/** Уведомление владельцу: новый заказ. */
export async function notifyOrderCreatedToOwner(params: {
  restaurantId: string
  orderId: string
  status?: string
  userName: string
  totalAmount: number
  itemsCount: number
  prettyLines: string[]
  addressLine?: string | null
  deliveryEtaText?: string | null
  paymentLine?: string | null
  notes?: string | null
  paymentStatus?: string | null
  paymentOptionSlug?: string | null
  promo?: OrderPromoNotifyInfo | null
}): Promise<void> {
  const {
    restaurantId,
    orderId,
    status = 'PENDING',
    userName,
    totalAmount,
    itemsCount,
    prettyLines,
    addressLine,
    deliveryEtaText,
    paymentLine,
    notes,
    paymentStatus,
    paymentOptionSlug,
    promo,
  } = params
  const ownerIds = await getOpsTelegramIds(restaurantId)
  const botToken = await getBotToken(restaurantId)
  if (!botToken) {
    console.warn('[notifyOrderCreatedToOwner] skipped: no bot token', { restaurantId })
    return
  }
  if (ownerIds.length === 0) {
    console.warn(
      '[notifyOrderCreatedToOwner] skipped: no ops telegram ids (RestaurantMember or UFO_OWNER_NOTIFY_TELEGRAM_IDS)',
      { restaurantId }
    )
    return
  }

  const shortId = orderId.slice(-8)
  const summaryHtml = `${escapeHtml(userName)} · ${escapeHtml(formatPrice(totalAmount))} · ${escapeHtml(String(itemsCount))} поз.`
  const itemLines = prettyLines.slice(0, 8)
  const details: string[] = []
  if (paymentLine) details.push(`• ${escapeHtml(paymentLine)}`)
  if (addressLine) details.push(`• Адрес: ${escapeHtml(addressLine)}`)
  if (deliveryEtaText) details.push(`• Доставка: ${escapeHtml(deliveryEtaText)}`)
  if (notes) details.push(`• Комментарий: ${escapeHtml(notes)}`)
  const text = formatOrderCreatedTelegramHtml({
    emoji: '🆕',
    title: `Новый заказ #${shortId}`,
    summaryHtml,
    detailLines: details,
    promo: promo ?? null,
    itemLines,
    closingPhrase: 'Выберите следующий шаг ниже.',
  })

  const paySt = String(paymentStatus || '').toUpperCase()
  const slug = String(paymentOptionSlug || '').toUpperCase()
  const awaitingQr = paySt === 'AWAITING_RECEIPT' && isQrSlug(slug)
  const next = awaitingQr ? null : getOrderNextAction(status)
  const inline_keyboard: any[][] = []
  if (next) inline_keyboard.push([{ text: next.label, callback_data: `order_${next.action}_${orderId}` }])
  if (canCancelOrderStatus(status)) inline_keyboard.push([{ text: 'Отменить', callback_data: `order_cancel_${orderId}` }])
  if (awaitingQr) {
    inline_keyboard.push([
      { text: 'Экран оплаты и чека', web_app: { url: buildWebAppUrl(`/orders/${orderId}/pay`) } },
    ])
  }
  inline_keyboard.push([{ text: 'Перейти к заказам', web_app: { url: buildWebAppUrl(`/admin/orders`) } }])
  const keyboard = {
    inline_keyboard,
  }

  for (const chatId of ownerIds) {
    const sent = await sendTelegramMessage(chatId, { text, parse_mode: 'HTML', reply_markup: keyboard }, botToken)
    if (!sent.ok) {
      console.error('[notifyOrderCreatedToOwner] Telegram sendMessage failed', { restaurantId, orderId, chatId, sent })
    }
  }
}

/** Уведомление клиенту: статус заказа изменился. */
export async function notifyOrderStatusChangedToCustomer(params: {
  restaurantId: string
  orderId: string
  status: string
  customerTelegramId: string | null
}): Promise<OrderTelegramNotifyResult> {
  const { restaurantId, orderId, status, customerTelegramId } = params
  if (!customerTelegramId) return 'skipped_no_recipient'
  const botToken = await getBotToken(restaurantId)
  if (!botToken) return 'skipped_no_token'

  const label = ORDER_STATUS_LABEL[status] ?? status
  const text = formatNotificationMessage({
    emoji: '📦',
    title: 'Заказ обновлён',
    metricsLine: `Статус: ${escapeHtml(label)}`,
    closingPhrase: ORDER_STATUS_NEXT_STEP_CUSTOMER[status] ?? 'Мы сообщим о следующем шаге.',
  })

  const sent = await sendTelegramMessage(
    customerTelegramId,
    {
      text,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Перейти к заказу', web_app: { url: buildWebAppUrl(`/orders/${orderId}`) } }],
          [{ text: 'Мои заказы', web_app: { url: buildWebAppUrl('/orders') } }],
        ],
      },
    },
    botToken
  )
  if (!sent.ok) {
    console.error('[notifyOrderStatusChangedToCustomer] Telegram sendMessage failed', { orderId, status, sent })
    return 'failed'
  }
  return 'sent'
}

/** Уведомление владельцу: статус заказа изменился. */
export async function notifyOrderStatusChangedToOwner(params: {
  restaurantId: string
  orderId: string
  status: string
  userName: string
}): Promise<OrderTelegramNotifyResult> {
  const { restaurantId, orderId, status, userName } = params
  const ownerIds = await getOpsTelegramIds(restaurantId)
  const botToken = await getBotToken(restaurantId)
  if (!ownerIds.length) return 'skipped_no_ops'
  if (!botToken) return 'skipped_no_token'

  const shortId = orderId.slice(-8)
  const label = ORDER_STATUS_LABEL[status] ?? status
  const text = formatNotificationMessage({
    emoji: '📦',
    title: `Заказ #${escapeHtml(shortId)} обновлён`,
    metricsLine: `${escapeHtml(userName)} — ${escapeHtml(label)}`,
    closingPhrase: ownerClosingPhraseAfterStatus(status),
  })
  const next = getOrderNextAction(status)
  const inline_keyboard: any[][] = []
  if (next) inline_keyboard.push([{ text: next.label, callback_data: `order_${next.action}_${orderId}` }])
  if (canCancelOrderStatus(status)) inline_keyboard.push([{ text: 'Отменить', callback_data: `order_cancel_${orderId}` }])
  inline_keyboard.push([{ text: 'Перейти к заказам', web_app: { url: buildWebAppUrl(`/admin/orders`) } }])

  let failures = 0
  for (const chatId of ownerIds) {
    const sent = await sendTelegramMessage(
      chatId,
      {
        text,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard,
        },
      },
      botToken
    )
    if (!sent.ok) {
      failures += 1
      console.error('[notifyOrderStatusChangedToOwner] Telegram sendMessage failed', { orderId, status, chatId, sent })
    }
  }
  if (failures === ownerIds.length) return 'failed'
  if (failures > 0) return 'failed'
  return 'sent'
}

/** Уведомление клиенту: заказ создан. */
export async function notifyOrderCreatedToCustomer(params: {
  restaurantId: string
  orderId: string
  totalAmount: number
  itemsCount: number
  prettyLines: string[]
  customerTelegramId: string | null
  addressLine?: string | null
  deliveryEtaText?: string | null
  paymentLine?: string | null
  notes?: string | null
  /** Если QR — ведём на экран оплаты и чека */
  customerOrderPath?: string | null
  promo?: OrderPromoNotifyInfo | null
}): Promise<void> {
  const {
    restaurantId,
    orderId,
    totalAmount,
    itemsCount,
    prettyLines,
    customerTelegramId,
    addressLine,
    deliveryEtaText,
    paymentLine,
    notes,
    customerOrderPath,
    promo,
  } = params
  if (!customerTelegramId) return
  const botToken = await getBotToken(restaurantId)
  if (!botToken) return

  const details: string[] = []
  if (addressLine) details.push(`• Адрес: ${escapeHtml(addressLine)}`)
  if (deliveryEtaText) details.push(`• Доставка: ${escapeHtml(deliveryEtaText)}`)
  if (paymentLine) details.push(`• ${escapeHtml(paymentLine)}`)
  if (notes) details.push(`• Комментарий: ${escapeHtml(notes)}`)
  const summaryHtml = `Сумма: ${escapeHtml(formatPrice(totalAmount))} · ${escapeHtml(String(itemsCount))} поз.`
  const text = formatOrderCreatedTelegramHtml({
    emoji: '✅',
    title: 'Заказ принят',
    summaryHtml,
    detailLines: details,
    promo: promo ?? null,
    itemLines: prettyLines.slice(0, 8),
    closingPhrase: ORDER_STATUS_NEXT_STEP_CUSTOMER.PENDING,
  })

  const orderPath = customerOrderPath?.startsWith('/') ? customerOrderPath : `/orders/${orderId}`
  await sendTelegramMessage(
    customerTelegramId,
    {
      text,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Перейти к заказу', web_app: { url: buildWebAppUrl(orderPath) } }],
          [{ text: 'Мои заказы', web_app: { url: buildWebAppUrl('/orders') } }],
          [{ text: 'Открыть приложение', web_app: { url: buildWebAppUrl('/') } }],
        ],
      },
    },
    botToken
  )
}

/** Уведомление владельцу: новая подписка / заявка на подтверждение. */
export async function notifySubscriptionCreatedToOwner(params: {
  restaurantId: string
  subscriptionId: string
  userName: string
  name: string
  price: number
  itemsSummary: string
  nextDeliveryLabel?: string
  pendingApproval?: boolean
}): Promise<void> {
  const { restaurantId, subscriptionId, userName, name, price, itemsSummary, nextDeliveryLabel, pendingApproval } = params
  const ownerIds = await getOpsTelegramIds(restaurantId)
  const botToken = await getBotToken(restaurantId)
  if (!botToken) {
    console.warn('[notifySubscriptionCreatedToOwner] skipped: no bot token', { restaurantId })
    return
  }
  if (ownerIds.length === 0) {
    console.warn('[notifySubscriptionCreatedToOwner] skipped: no ops telegram ids', { restaurantId })
    return
  }

  const shortId = subscriptionId.slice(-8)
  const metricsLine = `${escapeHtml(userName)} · «${escapeHtml(name)}» · ${escapeHtml(formatPrice(price))}/мес`
  const bulletLines = itemsSummary
    ? itemsSummary
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 8)
        .map((l) => (l.startsWith('•') || l.startsWith('-') ? l : `• ${l}`))
    : undefined
  const text = formatNotificationMessage({
    emoji: pendingApproval ? '⏳' : '🆕',
    title: pendingApproval
      ? `Подписка ждёт подтверждения #${escapeHtml(shortId)}`
      : `Новая подписка #${escapeHtml(shortId)}`,
    metricsLine,
    bulletLines: bulletLines?.map((l) => escapeHtml(l)),
    closingPhrase: pendingApproval
      ? 'Подтвердите или отклоните заявку.'
      : nextDeliveryLabel
        ? `След. доставка: ${escapeHtml(nextDeliveryLabel)}`
        : undefined,
  })

  const inline_keyboard: Array<
    Array<
      | { text: string; callback_data: string }
      | { text: string; web_app: { url: string } }
    >
  > = []
  if (pendingApproval) {
    inline_keyboard.push([
      { text: '✓ Подтвердить', callback_data: `sub_confirm_${subscriptionId}` },
      { text: '✕ Отклонить', callback_data: `sub_reject_${subscriptionId}` },
    ])
  }
  inline_keyboard.push([
    {
      text: 'Заявка в админке',
      web_app: {
        url: buildWebAppUrl(`/admin/subscriptions/clients?subscriptionId=${subscriptionId}`),
      },
    },
    { text: 'Панель владельца', web_app: { url: buildWebAppUrl('/admin') } },
  ])

  for (const chatId of ownerIds) {
    const sent = await sendTelegramMessage(
      chatId,
      {
        text,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard },
      },
      botToken
    )
    if (!sent.ok) {
      console.error('[notifySubscriptionCreatedToOwner] Telegram send failed', { restaurantId, subscriptionId, chatId })
    }
  }
}

/** Уведомление клиенту: заявка на подписку отправлена. */
export async function notifySubscriptionCreatedToCustomer(params: {
  restaurantId: string
  subscriptionId: string
  subscriptionName: string
  price: number
  itemsSummary: string
  customerTelegramId: string | null
}): Promise<void> {
  const { restaurantId, subscriptionId, subscriptionName, price, itemsSummary, customerTelegramId } = params
  if (!customerTelegramId) return
  const botToken = await getBotToken(restaurantId)
  if (!botToken) return

  const bulletLines = itemsSummary
    .split('\n')
    .filter(Boolean)
    .slice(0, 6)
    .map((line) => `• ${escapeHtml(line.startsWith('•') || line.startsWith('-') ? line.replace(/^[•-]\s*/, '') : line)}`)

  const text = formatNotificationMessage({
    emoji: '📋',
    title: 'Заявка на подписку отправлена',
    metricsLine: `«${escapeHtml(subscriptionName)}» · ${escapeHtml(formatPrice(price))}`,
    bulletLines: bulletLines.length ? bulletLines : undefined,
    closingPhrase: 'Заведение подтвердит рацион — мы напишем в Telegram.',
  })

  await sendTelegramMessage(
    customerTelegramId,
    {
      text,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Открыть эту подписку', web_app: { url: buildWebAppUrl(`/subscriptions/${subscriptionId}`) } }],
          [{ text: 'Мои подписки', web_app: { url: buildWebAppUrl('/subscriptions') } }],
          [{ text: 'Открыть mini app', web_app: { url: buildWebAppUrl('/') } }],
        ],
      },
    },
    botToken
  )
}

/** Уведомление клиенту: запрос «Хочу подписку» принят. */
export async function notifySubscriptionRequestToCustomer(params: {
  restaurantId: string
  customerTelegramId: string | null
}): Promise<{ ok: boolean }> {
  const { restaurantId, customerTelegramId } = params
  if (!customerTelegramId) return { ok: false }
  const botToken = await getBotToken(restaurantId)
  if (!botToken) return { ok: false }

  const text = formatNotificationMessage({
    emoji: '✅',
    title: 'Запрос на подписку отправлен',
    closingPhrase: 'Команда заведения получила его и свяжется с вами в Telegram.',
  })

  const sent = await sendTelegramMessage(
    customerTelegramId,
    {
      text,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: 'Подписки', web_app: { url: buildWebAppUrl('/subscriptions') } }]],
      },
    },
    botToken
  )
  return { ok: sent.ok }
}

/** Уведомление команде: заказ на кухню из подписки. */
export async function notifySubscriptionKitchenOrderToOwner(params: {
  restaurantId: string
  orderId: string
  subscriptionId: string
  subscriptionName: string
  clientName: string
  mealNote: string
  scheduledDate: Date
}): Promise<void> {
  const { restaurantId, orderId, subscriptionId, subscriptionName, clientName, mealNote, scheduledDate } = params
  const ownerIds = await getOpsTelegramIds(restaurantId)
  const botToken = await getBotToken(restaurantId)
  if (!botToken || ownerIds.length === 0) return

  const shortOrderId = orderId.slice(-8)
  const dateLabel = scheduledDate.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  const text = formatNotificationMessage({
    emoji: '🍳',
    title: `Заказ на кухню #${escapeHtml(shortOrderId)}`,
    metricsLine: `${escapeHtml(clientName)} · «${escapeHtml(subscriptionName)}»`,
    bulletLines: [`• ${escapeHtml(mealNote)}`, `• Доставка: ${escapeHtml(dateLabel)}`],
    closingPhrase: 'Заказ создан из подписки — откройте в разделе «Заказы».',
  })

  for (const chatId of ownerIds) {
    const sent = await sendTelegramMessage(
      chatId,
      {
        text,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Открыть заказ', web_app: { url: buildWebAppUrl(`/admin/orders`) } }],
            [
              {
                text: 'Подписчики',
                web_app: { url: buildWebAppUrl(`/admin/subscriptions/clients?subscriptionId=${subscriptionId}`) },
              },
            ],
          ],
        },
      },
      botToken
    )
    if (!sent.ok) {
      console.error('[notifySubscriptionKitchenOrderToOwner] failed', { restaurantId, orderId, chatId })
    }
  }
}

/** Рассылка гостям при публикации публичной акции. */
export async function broadcastPublicCampaign(opts: {
  restaurantId: string
  campaignName: string
  campaignCode?: string | null
  validTo?: Date | null
}): Promise<{ recipientCount: number }> {
  const botToken = await getBotToken(opts.restaurantId)
  if (!botToken) return { recipientCount: 0 }

  const [orderUsers, favUsers] = await Promise.all([
    prisma.user.findMany({
      where: {
        telegramId: { not: null },
        orders: { some: { restaurantId: opts.restaurantId } },
      },
      select: { telegramId: true },
      take: 5000,
    }),
    prisma.user.findMany({
      where: {
        telegramId: { not: null },
        favoriteDishes: { some: { restaurantId: opts.restaurantId } },
      },
      select: { telegramId: true },
      take: 5000,
    }),
  ])

  const chatIds = new Set<string>()
  for (const u of [...orderUsers, ...favUsers]) {
    const t = String(u.telegramId || '').trim()
    if (t) chatIds.add(t)
  }

  const expiresLine = opts.validTo
    ? `\nДействует до: <b>${escapeHtml(opts.validTo.toLocaleString('ru-RU'))}</b>`
    : ''
  const codeLine = opts.campaignCode ? `\nПромокод: <code>${escapeHtml(opts.campaignCode)}</code>` : ''
  const text = `<b>🎁 Новая акция: ${escapeHtml(opts.campaignName)}</b>${codeLine}${expiresLine}\n\n<i>Откройте меню и примените промокод при оформлении.</i>`

  await Promise.all(
    [...chatIds].map((chatId) =>
      sendTelegramMessage(
        chatId,
        {
          text,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[{ text: 'Открыть меню', web_app: { url: buildWebAppUrl('/menu') } }]],
          },
        },
        botToken
      ).catch(() => null)
    )
  )

  return { recipientCount: chatIds.size }
}

/** Уведомление клиенту: доставка по подписке выполнена. */
export async function notifySubscriptionDeliveryDeliveredToCustomer(params: {
  restaurantId: string
  subscriptionId: string
  subscriptionName: string
  deliveryId: string
  scheduledDate: Date
  customerTelegramId: string | null
}): Promise<OrderTelegramNotifyResult> {
  const { restaurantId, subscriptionId, subscriptionName, deliveryId, scheduledDate, customerTelegramId } = params
  if (!customerTelegramId) return 'skipped_no_recipient'
  const botToken = await getBotToken(restaurantId)
  if (!botToken) return 'skipped_no_token'

  const dayLabel = scheduledDate.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
  })
  const text = formatNotificationMessage({
    emoji: '✅',
    title: 'Доставка по подписке',
    metricsLine: `«${escapeHtml(subscriptionName)}» · ${escapeHtml(dayLabel)}`,
    closingPhrase: 'Рацион доставлен. Приятного аппетита!',
  })

  const sent = await sendTelegramMessage(
    customerTelegramId,
    {
      text,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Моя подписка', web_app: { url: buildWebAppUrl(`/subscriptions/${subscriptionId}`) } }],
          [{ text: 'Мои подписки', web_app: { url: buildWebAppUrl('/subscriptions') } }],
        ],
      },
    },
    botToken
  )
  if (!sent.ok) {
    console.error('[notifySubscriptionDeliveryDeliveredToCustomer] failed', { subscriptionId, deliveryId, sent })
    return 'failed'
  }
  return 'sent'
}

/** Уведомление клиенту: статус подписки изменился. */
export async function notifySubscriptionStatusChangedToCustomer(params: {
  restaurantId: string
  subscriptionId: string
  subscriptionName: string
  status: string
  customerTelegramId: string | null
}): Promise<void> {
  const { restaurantId, subscriptionId, subscriptionName, status, customerTelegramId } = params
  if (!customerTelegramId) return
  const botToken = await getBotToken(restaurantId)
  if (!botToken) return

  const label = SUB_STATUS_LABEL[status] ?? status
  const text = formatNotificationMessage({
    emoji: status === 'ACTIVE' ? '✅' : '📋',
    title: 'Подписка обновлена',
    metricsLine: `«${escapeHtml(subscriptionName)}»: ${escapeHtml(label)}`,
    closingPhrase: SUB_STATUS_NEXT_CUSTOMER[status] ?? 'Откройте подписку для деталей.',
  })

  await sendTelegramMessage(
    customerTelegramId,
    {
      text,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Открыть подписку', web_app: { url: buildWebAppUrl(`/subscriptions/${subscriptionId}`) } }],
          [{ text: 'Мои подписки', web_app: { url: buildWebAppUrl('/subscriptions') } }],
        ],
      },
    },
    botToken
  )
}

/** Уведомление владельцу: статус подписки изменился. */
export async function notifySubscriptionStatusChangedToOwner(params: {
  restaurantId: string
  subscriptionId: string
  subscriptionName: string
  status: string
  userName: string
}): Promise<void> {
  const { restaurantId, subscriptionId, subscriptionName, status, userName } = params
  const ownerIds = await getOpsTelegramIds(restaurantId)
  const botToken = await getBotToken(restaurantId)
  if (!botToken) {
    console.warn('[notifySubscriptionStatusChangedToOwner] skipped: no bot token', { restaurantId })
    return
  }
  if (ownerIds.length === 0) {
    console.warn('[notifySubscriptionStatusChangedToOwner] skipped: no ops telegram ids', { restaurantId })
    return
  }

  const shortId = subscriptionId.slice(-8)
  const label = SUB_STATUS_LABEL[status] ?? status
  const text = formatNotificationMessage({
    emoji: '📋',
    title: `Подписка #${escapeHtml(shortId)} обновлена`,
    metricsLine: `«${escapeHtml(subscriptionName)}» · ${escapeHtml(userName)} — ${escapeHtml(label)}`,
  })

  for (const chatId of ownerIds) {
    await sendTelegramMessage(
      chatId,
      {
        text,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: 'Клиенты и заявки',
                web_app: {
                  url: buildWebAppUrl(`/admin/subscriptions/clients?subscriptionId=${subscriptionId}`),
                },
              },
            ],
          ],
        },
      },
      botToken
    )
  }
}

export async function notifySubscriptionRequestToOps(params: {
  restaurantId: string
  userName: string
  customerTelegramId: string | null
  note?: string
}) {
  const { restaurantId, userName, customerTelegramId, note } = params
  const teamIds = await getOpsTelegramIds(restaurantId)
  const botToken = await getBotToken(restaurantId)
  if (!botToken || teamIds.length === 0) return

  const text = formatNotificationMessage({
    emoji: '📩',
    title: 'Новый запрос на подписку',
    metricsLine: `${escapeHtml(userName)}${customerTelegramId ? ` · tg: ${escapeHtml(customerTelegramId)}` : ''}`,
    bulletLines: note ? [`• ${escapeHtml(note)}`] : undefined,
    closingPhrase: 'Пользователь хочет подключить рационы, свяжитесь с ним в Telegram.',
  })

  for (const chatId of teamIds) {
    await sendTelegramMessage(
      chatId,
      {
        text,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Клиенты и заявки', web_app: { url: buildWebAppUrl('/admin/subscriptions/clients') } }],
          ],
        },
      },
      botToken
    )
  }
}

export async function notifyServiceLeadCreatedToOps(params: {
  restaurantId: string
  leadId: string
  type: string
  userName: string
  customerTelegramId: string | null
  title?: string | null
  guestCount?: number | null
  eventDate?: Date | null
  note?: string | null
}) {
  const { restaurantId, leadId, type, userName, customerTelegramId, title, guestCount, eventDate, note } = params
  const teamIds = await getOpsTelegramIds(restaurantId)
  const botToken = await getBotToken(restaurantId)
  if (!botToken || teamIds.length === 0) return

  const details: string[] = []
  if (title) details.push(`• Что нужно: ${escapeHtml(title)}`)
  if (guestCount) details.push(`• Гостей: ${escapeHtml(String(guestCount))}`)
  if (eventDate && !Number.isNaN(eventDate.getTime())) {
    details.push(`• Дата: ${escapeHtml(eventDate.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }))}`)
  }
  if (note) details.push(`• Комментарий: ${escapeHtml(note)}`)

  const text = formatNotificationMessage({
    emoji: '📩',
    title: `Новая заявка: ${escapeHtml(LEAD_TYPE_LABEL[type] ?? type)}`,
    metricsLine: `${escapeHtml(userName)}${customerTelegramId ? ` · tg: ${escapeHtml(customerTelegramId)}` : ''}`,
    bulletLines: details,
    closingPhrase: 'Свяжитесь с клиентом в Telegram и отметьте статус в ЛК.',
  })

  for (const chatId of teamIds) {
    await sendTelegramMessage(
      chatId,
      {
        text,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: 'Открыть заявки', web_app: { url: buildWebAppUrl('/admin/leads') } }]],
        },
      },
      botToken
    )
  }
}

export async function notifyServiceLeadCreatedToCustomer(params: {
  restaurantId: string
  customerTelegramId: string | null
  type: string
}) {
  const { restaurantId, customerTelegramId, type } = params
  if (!customerTelegramId) return
  const botToken = await getBotToken(restaurantId)
  if (!botToken) return

  const text = formatNotificationMessage({
    emoji: '✅',
    title: 'Заявка отправлена',
    metricsLine: LEAD_TYPE_LABEL[type] ?? 'Заявка',
    closingPhrase: 'Команда заведения получила заявку и свяжется с вами в Telegram.',
  })

  await sendTelegramMessage(
    customerTelegramId,
    {
      text,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: 'Открыть приложение', web_app: { url: buildWebAppUrl('/') } }]],
      },
    },
    botToken
  )
}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  CASH: 'Наличные',
  STRIPE: 'Карта (Stripe)',
  QR_THB: 'QR · ฿',
  QR_RUB: 'QR · ₽',
}

export function formatOrderPaymentLine(
  paymentStatus: string | null | undefined,
  paymentMethodOrSlug: string | null | undefined,
  extras?: { rubAmount?: number | null }
) {
  const status = String(paymentStatus || 'PENDING').toUpperCase()
  const method = String(paymentMethodOrSlug || 'CASH').toUpperCase()
  const statusLabel = (PAYMENT_STATUSES as Record<string, string>)[status] ?? status
  const methodLabel = PAYMENT_METHOD_LABEL[method] || (method === 'STRIPE' ? 'Онлайн' : method)
  const rub =
    typeof extras?.rubAmount === 'number' && Number.isFinite(extras.rubAmount) && extras.rubAmount > 0
      ? ` · ${extras.rubAmount.toFixed(0)} ₽`
      : ''
  return `Оплата: ${methodLabel}${rub} · ${statusLabel}`
}

/** Владельцам: чек загружен, нужно подтвердить или отклонить. */
export async function notifyOwnersManualPaymentReview(params: {
  restaurantId: string
  orderId: string
  receiptUrl: string
  totalThb: number
  rubAmount?: number | null
  userName: string
}): Promise<void> {
  const { restaurantId, orderId, receiptUrl, totalThb, rubAmount, userName } = params
  const ownerIds = await getOpsTelegramIds(restaurantId)
  const botToken = await getBotToken(restaurantId)
  if (!botToken || ownerIds.length === 0) return

  const shortId = orderId.slice(-8)
  const rubLine =
    typeof rubAmount === 'number' && Number.isFinite(rubAmount) && rubAmount > 0
      ? ` · ${rubAmount.toFixed(0)} ₽`
      : ''
  const caption = formatNotificationMessage({
    emoji: '🧾',
    title: `Чек по заказу #${escapeHtml(shortId)}`,
    metricsLine: `${escapeHtml(userName)} · ${escapeHtml(formatPrice(totalThb))}${escapeHtml(rubLine)}`,
    closingPhrase: 'Подтвердите получение или отклоните.',
  })
  const keyboard = {
    inline_keyboard: [
      [
        { text: 'Подтвердить оплату', callback_data: `payok_${orderId}` },
        { text: 'Отклонить', callback_data: `payno_${orderId}` },
      ],
      [{ text: 'Заказ в приложении', web_app: { url: buildWebAppUrl(`/admin/orders`) } }],
    ],
  }

  for (const chatId of ownerIds) {
    const sentPhoto = await sendTelegramPhotoUrl(
      chatId,
      receiptUrl,
      { caption, parse_mode: 'HTML', reply_markup: keyboard },
      botToken
    )
    if (sentPhoto.ok) continue

    const fallbackText = `${caption}\n\nСсылка на чек: ${escapeHtml(receiptUrl)}`
    const sentFallback = await sendTelegramMessage(
      chatId,
      {
        text: fallbackText,
        parse_mode: 'HTML',
        reply_markup: keyboard,
      },
      botToken
    )
    if (!sentFallback.ok) {
      console.error('[notifyOwnersManualPaymentReview] failed for chat', {
        restaurantId,
        orderId,
        chatId,
      })
    }
  }
}

export async function notifyCustomerPaymentConfirmed(params: {
  restaurantId: string
  orderId: string
  customerTelegramId: string | null
}): Promise<void> {
  const { restaurantId, orderId, customerTelegramId } = params
  if (!customerTelegramId) return
  const botToken = await getBotToken(restaurantId)
  if (!botToken) return
  const text = formatNotificationMessage({
    emoji: '✅',
    title: 'Оплата подтверждена',
    metricsLine: `Заказ #${escapeHtml(orderId.slice(-8))}`,
    closingPhrase: 'Заказ принят в работу. Мы сообщим о следующем шаге.',
  })
  await sendTelegramMessage(
    customerTelegramId,
    {
      text,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: 'Открыть заказ', web_app: { url: buildWebAppUrl(`/orders/${orderId}`) } }]],
      },
    },
    botToken
  )
}

export async function notifyCustomerPaymentRejected(params: {
  restaurantId: string
  orderId: string
  customerTelegramId: string | null
}): Promise<void> {
  const { restaurantId, orderId, customerTelegramId } = params
  if (!customerTelegramId) return
  const botToken = await getBotToken(restaurantId)
  if (!botToken) return
  const text = formatNotificationMessage({
    emoji: '⚠️',
    title: 'Оплата не подтверждена',
    metricsLine: `Заказ #${escapeHtml(orderId.slice(-8))}`,
    closingPhrase: 'Свяжитесь с заведением или оформите заказ снова.',
  })
  await sendTelegramMessage(
    customerTelegramId,
    {
      text,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: 'Мои заказы', web_app: { url: buildWebAppUrl('/orders') } }]],
      },
    },
    botToken
  )
}
