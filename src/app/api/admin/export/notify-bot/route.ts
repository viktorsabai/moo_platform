import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRestaurantContext, requireRestaurantAdmin } from '@/lib/restaurant-context'
import { sendTelegramDocument } from '@/lib/telegram'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function escapeCsvCell(val: string | number | null | undefined): string {
  const s = String(val ?? '').replace(/"/g, '""')
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s
}

const MENU_HEADER =
  'category_slug,category_name,name,slug,price,description,emoji,tags,cost_price,is_available,prep_time_minutes,max_order_quantity,subscription_eligible,option_value_slugs,modifier_names'
const STORE_HEADER = 'category_slug,category_name,product_name,product_slug,description,variant_name,price,qty'

function parseTelegramInitData(headersObj: Headers): { telegramId: string; startParam: string } {
  const initData = String(headersObj.get('x-telegram-init-data') || '').trim()
  if (!initData) return { telegramId: '', startParam: '' }
  try {
    const params = new URLSearchParams(initData)
    const userRaw = String(params.get('user') || '')
    const startParam = String(params.get('start_param') || params.get('startapp') || '').trim()
    let telegramId = ''
    if (userRaw) {
      const parsed = JSON.parse(userRaw)
      telegramId = String(parsed?.id || '').trim()
    }
    return { telegramId, startParam }
  } catch {
    return { telegramId: '', startParam: '' }
  }
}

/** POST: generate CSV and send to owner's Telegram. Returns { ok, sent, error? } */
export async function POST(request: Request) {
  try {
    const ctx = await requireRestaurantAdmin(await getRestaurantContext())
    const { searchParams } = new URL(request.url)
    const type = (searchParams.get('type') || 'menu').toLowerCase()
    const isStore = type === 'store'

    const { telegramId: initTelegramId, startParam } = parseTelegramInitData(request.headers)
    const integrations = await prisma.botIntegration.findMany({
      where: { restaurantId: ctx.restaurantId },
      select: { botToken: true, startParam: true, updatedAt: true },
      orderBy: [{ updatedAt: 'desc' }],
      take: 20,
    })
    const prioritizedIntegrationTokens = [
      ...integrations
        .filter((b) => String(b.startParam || '').trim() === startParam && String(b.botToken || '').trim())
        .map((b) => String(b.botToken || '').trim()),
      ...integrations
        .filter((b) => String(b.botToken || '').trim())
        .map((b) => String(b.botToken || '').trim()),
    ]
    const envTokens = [
      String(process.env.BOT_TOKEN || '').trim(),
      String(process.env.TELEGRAM_BOT_TOKEN || '').trim(),
    ].filter(Boolean)
    const botTokens = [...new Set([...prioritizedIntegrationTokens, ...envTokens].filter(Boolean))]

    const members = await prisma.restaurantMember.findMany({
      where: { restaurantId: ctx.restaurantId, role: { in: ['OWNER', 'ADMIN'] } },
      select: { user: { select: { telegramId: true } } },
      take: 50,
    })
    const memberChatIds = members
      .map((m) => String(m.user?.telegramId || '').trim())
      .filter(Boolean)
    const currentUser = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { telegramId: true },
    })
    const currentUserChatId = String(currentUser?.telegramId || '').trim() || initTelegramId
    const envChatIds = String(
      process.env.UFO_OWNER_NOTIFY_TELEGRAM_IDS ||
        process.env.UFO_SUPERADMIN_TELEGRAM_ID ||
        process.env.SUPERADMIN_TELEGRAM_IDS ||
        ''
    )
      .split(',')
      .map((x) => x.trim().replace(/^['"]+|['"]+$/g, ''))
      .filter(Boolean)
    const chatIds = [...new Set([currentUserChatId, initTelegramId, ...memberChatIds, ...envChatIds].filter(Boolean))]

    if (!chatIds.length) {
      return NextResponse.json({ ok: true, sent: false, error: 'Откройте mini app через бота (кнопка в чате), чтобы получить выгрузку.' })
    }
    if (!botTokens.length) {
      return NextResponse.json({ ok: true, sent: false, error: 'Бот не настроен. Добавьте BOT_TOKEN в настройки.' })
    }

    let csv: string

    if (isStore) {
      const cats = await prisma.storeCategory.findMany({
        where: { restaurantId: ctx.restaurantId },
        orderBy: { order: 'asc' },
        select: { id: true, name: true, slug: true },
      })
      const products = await prisma.storeProduct.findMany({
        where: { restaurantId: ctx.restaurantId },
        include: { variants: true, category: true },
        orderBy: { createdAt: 'asc' },
      })
      const slugById = new Map(cats.map((c) => [c.id, c]))
      const rows: string[] = [STORE_HEADER]
      for (const p of products) {
        const cat = p.categoryId ? slugById.get(p.categoryId) : null
        const catSlug = cat?.slug ?? 'uncat'
        const catName = cat?.name ?? catSlug
        if (p.variants.length === 0) {
          rows.push([catSlug, catName, p.name, p.slug, p.description ?? '', '', 0, 0].map(escapeCsvCell).join(','))
        } else {
          for (const v of p.variants) {
            const vPrice = v.price != null ? Number(v.price) : 0
            rows.push([catSlug, catName, p.name, p.slug, p.description ?? '', v.name ?? '', vPrice, v.qty ?? 0].map(escapeCsvCell).join(','))
          }
        }
      }
      csv = rows.join('\n')
    } else {
      const cats = await prisma.category.findMany({
        where: { restaurantId: ctx.restaurantId },
        orderBy: { order: 'asc' },
        select: { id: true, name: true, slug: true, emoji: true },
      })
      const dishes = await prisma.dish.findMany({
        where: { restaurantId: ctx.restaurantId },
        include: {
          category: true,
          optionValues: {
            include: { optionValue: { select: { slug: true, name: true } } },
          },
          modifiers: {
            select: { name: true },
            orderBy: { order: 'asc' },
          },
        },
        orderBy: { createdAt: 'asc' },
      })
      const catById = new Map(cats.map((c) => [c.id, c]))
      const rows: string[] = [MENU_HEADER]
      for (const d of dishes) {
        const cat = d.categoryId ? catById.get(d.categoryId) : null
        const catSlug = cat?.slug ?? 'uncat'
        const catName = cat?.name ?? catSlug
        const tags = Array.isArray(d.tags) ? d.tags.join(';') : ''
        const priceNum = d.price != null ? Number(d.price) : 0
        const costPrice = d.costPrice != null ? Number(d.costPrice) : ''
        const optionValueSlugs = Array.isArray(d.optionValues)
          ? d.optionValues
              .map((ov) => String(ov.optionValue?.slug || '').trim())
              .filter(Boolean)
              .join(';')
          : ''
        const modifierNames = Array.isArray(d.modifiers)
          ? d.modifiers
              .map((m) => String(m.name || '').trim())
              .filter(Boolean)
              .join(';')
          : ''
        rows.push([
          catSlug,
          catName,
          d.name,
          d.slug,
          priceNum,
          d.description ?? '',
          d.emoji ?? '',
          tags,
          costPrice,
          d.isAvailable ? 'true' : 'false',
          d.prepTimeMinutes ?? '',
          d.maxOrderQuantity ?? '',
          d.subscriptionEligible ? 'true' : 'false',
          optionValueSlugs,
          modifierNames,
        ].map(escapeCsvCell).join(','))
      }
      csv = rows.join('\n')
    }

    const filename = isStore ? 'магазин-выгрузка.csv' : 'меню-выгрузка.csv'
    const successChatIds: string[] = []
    let lastError = ''
    for (const chatId of chatIds) {
      let delivered = false
      for (const botToken of botTokens) {
        const result = await sendTelegramDocument(
          chatId,
          Buffer.from(csv, 'utf-8'),
          filename,
          { caption: '📋 Выгрузка из ЛК: ' + (isStore ? 'магазин' : 'меню') },
          botToken
        )
        if (result.ok) {
          delivered = true
          break
        }
        lastError = result.error || lastError
      }
      if (delivered) {
        successChatIds.push(chatId)
      }
    }

    if (!successChatIds.length) {
      return NextResponse.json({ ok: true, sent: false, error: lastError || 'Не удалось отправить' })
    }
    const sentToCurrent = Boolean(currentUserChatId && successChatIds.includes(currentUserChatId))
    const mask = (id: string) => (id.length > 4 ? `***${id.slice(-4)}` : `***${id}`)
    return NextResponse.json({
      ok: true,
      sent: true,
      sentToCurrent,
      sentTo: successChatIds.map(mask),
      currentChatMasked: currentUserChatId ? mask(currentUserChatId) : null,
    })
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    return NextResponse.json({ ok: false, error: status === 403 ? 'forbidden' : 'Ошибка', sent: false }, { status })
  }
}
