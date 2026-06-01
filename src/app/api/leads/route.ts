import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRestaurantContext } from '@/lib/restaurant-context'
import { prisma } from '@/lib/prisma'
import {
  notifyServiceLeadCreatedToCustomer,
  notifyServiceLeadCreatedToOps,
} from '@/lib/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED_TYPES = new Set(['catering', 'banquet', 'corporate', 'custom'])

function normalizeType(input: unknown): string {
  const value = String(input || '').trim().toLowerCase()
  return ALLOWED_TYPES.has(value) ? value : 'custom'
}

function parseEventDate(input: unknown): Date | null {
  if (typeof input !== 'string' || !input.trim()) return null
  const date = new Date(input)
  return Number.isNaN(date.getTime()) ? null : date
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'нужна авторизация через Telegram' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({} as any))
    const type = normalizeType(body?.type)
    const title = typeof body?.title === 'string' ? body.title.trim().slice(0, 120) : ''
    const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 800) : ''
    const guestCountRaw = Number(body?.guestCount)
    const guestCount = Number.isFinite(guestCountRaw) && guestCountRaw > 0
      ? Math.min(10000, Math.floor(guestCountRaw))
      : null
    const eventDate = parseEventDate(body?.eventDate)

    if (!title && !note) {
      return NextResponse.json({ ok: false, error: 'напишите пару слов о заявке' }, { status: 400 })
    }

    const ctx = await getRestaurantContext()
    const restaurantId = String(ctx?.restaurantId || (session as any)?.restaurantId || 'default')
    const customerTelegramId = ((session?.user as any)?.telegramId as string | undefined) ?? null
    const userName =
      (session?.user as any)?.name ??
      (session?.user as any)?.telegramUsername ??
      (session?.user as any)?.telegramFirstName ??
      'Клиент'

    const lead = await prisma.serviceLead.create({
      data: {
        restaurantId,
        userId,
        telegramId: customerTelegramId,
        name: String(userName),
        phone: null,
        type,
        title: title || null,
        guestCount,
        eventDate,
        note: note || null,
        source: typeof body?.source === 'string' ? body.source.trim().slice(0, 50) || 'home' : 'home',
      },
      select: { id: true, type: true },
    })

    const customerAckSent = await notifyServiceLeadCreatedToCustomer({
      restaurantId,
      customerTelegramId,
      type,
    }).then(() => true).catch(() => false)

    const opsNotified = await notifyServiceLeadCreatedToOps({
      restaurantId,
      leadId: lead.id,
      type,
      userName: String(userName),
      customerTelegramId,
      title,
      guestCount,
      eventDate,
      note,
    }).then(() => true).catch(() => false)

    return NextResponse.json({
      ok: true,
      id: lead.id,
      customerAckSent,
      opsNotified,
      warning: opsNotified ? null : 'Команда пока не получила уведомление. Проверьте Telegram-привязку сотрудников.',
    })
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: 'Не удалось отправить заявку. Обновите mini app и попробуйте ещё раз.' },
      { status: 500 }
    )
  }
}
