import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  buildWebAppUrl,
  escapeHtml,
  sendTelegramMessage,
  type TelegramSendMessageOptions,
} from '@/lib/telegram'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const lastSendAt = new Map<string, number>()
const COOLDOWN_MS = 120_000

function primarySuperadminTelegramId(): string | null {
  const raw = String(process.env.UFO_SUPERADMIN_TELEGRAM_ID || process.env.SUPERADMIN_TELEGRAM_IDS || '').trim()
  const first = raw
    .split(/[\s,]+/)
    .map((s) => s.trim().replace(/^['"]+|['"]+$/g, ''))
    .find(Boolean)
  return first || null
}

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    const userId = String((session?.user as any)?.id || '').trim()
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Войдите в аккаунт' }, { status: 401 })
    }

    const now = Date.now()
    const prev = lastSendAt.get(userId) || 0
    if (now - prev < COOLDOWN_MS) {
      return NextResponse.json({ ok: true, cooldown: true })
    }

    const chatId = primarySuperadminTelegramId()
    if (!chatId) {
      return NextResponse.json({ ok: false, error: 'Не настроен UFO_SUPERADMIN_TELEGRAM_ID' }, { status: 503 })
    }

    const telegramId = String((session?.user as any)?.telegramId || '').trim()
    const name = String(session?.user?.name || '').trim() || '—'
    let headerRestaurant = ''
    try {
      headerRestaurant = String(headers().get('x-ufo-restaurant') || '').trim()
    } catch {
      // ignore
    }
    let restaurantLabel = ''
    if (headerRestaurant && headerRestaurant !== 'default') {
      try {
        const r = await prisma.restaurant.findUnique({
          where: { id: headerRestaurant },
          select: { name: true },
        })
        restaurantLabel = r?.name ? `${r.name} (${headerRestaurant})` : headerRestaurant
      } catch {
        restaurantLabel = headerRestaurant
      }
    }

    const lines = [
      '<b>Заявка: подключить заведение</b>',
      '',
      `Пользователь: ${escapeHtml(name)}`,
      telegramId ? `Telegram ID: <code>${escapeHtml(telegramId)}</code>` : 'Telegram: не привязан',
      `User id: <code>${escapeHtml(userId)}</code>`,
    ]
    if (restaurantLabel) lines.push(`Контекст витрины: ${escapeHtml(restaurantLabel)}`)
    lines.push('', `<i>${escapeHtml(new Date().toISOString())}</i>`)

    const inline_keyboard: NonNullable<
      NonNullable<TelegramSendMessageOptions['reply_markup']>['inline_keyboard']
    > = []

    if (/^\d{5,}$/.test(telegramId)) {
      inline_keyboard.push([{ text: '💬 Написать пользователю', url: `tg://user?id=${telegramId}` }])
    }
    const helpUrl = String(process.env.UFO_BUSINESS_INQUIRY_HELP_URL || '').trim()
    if (helpUrl) {
      inline_keyboard.push([{ text: '❓ Поддержка / FAQ', url: helpUrl }])
    }
    inline_keyboard.push([{ text: '📱 Открыть MOO', web_app: { url: buildWebAppUrl('/profile') } }])

    const result = await sendTelegramMessage(chatId, {
      text: lines.join('\n'),
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard },
    })
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: 'Не удалось отправить в Telegram' }, { status: 502 })
    }

    lastSendAt.set(userId, now)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[profile/business-inquiry]', e)
    return NextResponse.json({ ok: false, error: 'Ошибка сервера' }, { status: 500 })
  }
}
