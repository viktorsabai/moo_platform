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

/** CSV template for menu (extended contract). Keep first 6 columns backward-compatible for import. */
const MENU_HEADER =
  'category_slug,category_name,name,slug,price,description,emoji,tags,cost_price,is_available,prep_time_minutes,max_order_quantity,subscription_eligible,option_value_slugs,modifier_names'

/** CSV template for store: category_slug, category_name, product_name, product_slug, description, variant_name, price, qty */
const STORE_HEADER = 'category_slug,category_name,product_name,product_slug,description,variant_name,price,qty'

/** Static sample for empty menu */
const MENU_SAMPLE = `soups,супы,борщ,borsch,180,свекла мясо сметана,,,90,true,25,5,true,,без лука
soups,супы,том ям,tom-yam,220,креветки имбирь лимонная трава,,,120,true,30,3,true,spicy-medium;size-large,
mains,горячее,паста карбонара,carbonara,280,бекон сливки пармезан,,,140,true,20,4,true,size-large,доп. сыр
`

/** Static sample for empty store */
const STORE_SAMPLE = `frozen,заморозка,вареники с картошкой,vareniki,домашние вареники,500 г,159,10
frozen,заморозка,вареники с картошкой,vareniki,домашние вареники,1 кг,299,5
`

export async function GET(request: Request) {
  try {
    const ctx = await requireRestaurantAdmin(await getRestaurantContext())
    const { searchParams } = new URL(request.url)
    const type = (searchParams.get('type') || 'menu').toLowerCase()
    const withData = searchParams.get('data') === '1' || searchParams.get('filled') === '1'
    const sendBot = searchParams.get('sendBot') === '1'
    const isStore = type === 'store'

    let csv: string

    if (isStore) {
      if (withData) {
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
        if (rows.length === 1) rows.push(...STORE_SAMPLE.trim().split('\n'))
        csv = rows.join('\n')
      } else {
        csv = STORE_HEADER + '\n' + STORE_SAMPLE
      }
    } else {
      if (withData) {
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
        if (rows.length === 1) rows.push(...MENU_SAMPLE.trim().split('\n'))
        csv = rows.join('\n')
      } else {
        csv = MENU_HEADER + '\n' + MENU_SAMPLE
      }
    }

    const filename = isStore ? 'шаблон-магазин.csv' : 'шаблон-меню.csv'

    if (sendBot) {
      const bot = await prisma.botIntegration.findFirst({ where: { restaurantId: ctx.restaurantId }, select: { botToken: true } })
      const owner = await prisma.restaurantMember.findFirst({
        where: { restaurantId: ctx.restaurantId, role: 'OWNER' },
        include: { user: { select: { telegramId: true } } },
      })
      const chatId = owner?.user?.telegramId
      if (chatId && bot?.botToken) {
        sendTelegramDocument(chatId, Buffer.from(csv, 'utf-8'), filename, { caption: '📋 Выгрузка из ЛК: ' + (isStore ? 'магазин' : 'меню') }, bot.botToken).catch(() => {})
      }
    }

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    })
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    return NextResponse.json({ ok: false, error: status === 403 ? 'forbidden' : 'Ошибка' }, { status })
  }
}
