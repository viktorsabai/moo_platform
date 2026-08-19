import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getConsumerRestaurantId } from '@/lib/restaurant-context'
import { ensureMvpTables, newId } from '@/lib/mvp-db'
import { notifySubscriptionRequestToCustomer, notifySubscriptionRequestToOps } from '@/lib/notifications'
import { prisma } from '@/lib/prisma'
import { resolveApiUser } from '@/lib/tg-auth-resolver'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const authUser = await resolveApiUser(headers())
    const userId = authUser.userId
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'нужна авторизация' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({} as any))
    const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 500) : ''

    const restaurantId = await getConsumerRestaurantId()
    const userName = authUser.name?.trim() || 'Клиент'
    const customerTelegramId = authUser.telegramId ?? null

    // DB lead — best effort (не блокируем CTA, если с БД/DDL проблема).
    const id = newId('subreq')
    try {
      await ensureMvpTables()
      await prisma.$executeRawUnsafe(
        `INSERT INTO "SubscriptionRequestLead" ("id","restaurantId","userId","telegramId","note","status")
         VALUES ($1,$2,$3,$4,$5,'NEW')`,
        id,
        restaurantId,
        userId,
        customerTelegramId,
        note || null
      )
    } catch {}

    // Подтверждаем клиенту, что запрос принят (если есть telegramId).
    let customerAckSent = false
    if (customerTelegramId) {
      const ack = await notifySubscriptionRequestToCustomer({
        restaurantId,
        customerTelegramId,
      }).catch(() => ({ ok: false as const }))
      customerAckSent = ack.ok
    }

    // В serverless важно дождаться отправок до ответа, иначе сообщения могут не уйти.
    const notifyResult = await notifySubscriptionRequestToOps({
      restaurantId,
      userName,
      customerTelegramId,
      note: note || undefined,
    }).catch(() => ({ ok: false, sentCount: 0, failedCount: 1 as number, reason: undefined }))

    const warning = notifyResult.ok
      ? null
      : notifyResult.reason === 'no_token'
        ? 'Заявка сохранена, но Telegram-бот заведения не подключён. Владелец увидит её в ЛК.'
        : notifyResult.reason === 'no_recipients'
          ? 'Заявка сохранена, но у команды нет Telegram-получателя. Владелец увидит её в ЛК.'
          : 'Заявка сохранена, но Telegram-сообщение не доставлено. Владелец увидит её в ЛК.'

    return NextResponse.json({
      ok: true,
      id,
      customerAckSent,
      opsNotified: notifyResult.ok,
      delivery: { sentCount: notifyResult.sentCount, failedCount: notifyResult.failedCount },
      warning,
    })
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: 'Не удалось отправить запрос. Обновите mini app и попробуйте ещё раз.' },
      { status: 500 }
    )
  }
}
