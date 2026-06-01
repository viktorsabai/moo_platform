import { NextResponse } from 'next/server'
import { getRestaurantContext, requireRestaurantAdmin } from '@/lib/restaurant-context'
import { ensureMvpTables } from '@/lib/mvp-db'
import { prisma } from '@/lib/prisma'

type LeadStatus = 'NEW' | 'IN_PROGRESS' | 'DONE'

const ALLOWED: LeadStatus[] = ['NEW', 'IN_PROGRESS', 'DONE']

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())
    await ensureMvpTables()
    const rows = await prisma.$queryRawUnsafe<
      Array<{
        id: string
        userId: string
        telegramId: string | null
        note: string | null
        status: LeadStatus
        createdAt: Date
        name: string | null
        telegramUsername: string | null
      }>
    >(
      `SELECT l."id", l."userId", l."telegramId", l."note", l."status", l."createdAt",
              u."name", u."telegramUsername"
       FROM "SubscriptionRequestLead" l
       LEFT JOIN "User" u ON u."id" = l."userId"
       WHERE l."restaurantId" = $1
       ORDER BY l."createdAt" DESC`,
      ctx.restaurantId
    )
    return NextResponse.json({ ok: true, leads: rows })
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    const message = status === 401 || status === 403 ? 'Недостаточно прав' : 'Не удалось загрузить лиды подписки'
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())
    await ensureMvpTables()
    const body = await request.json().catch(() => ({} as any))
    const id = String(body?.id || '').trim()
    const status = String(body?.status || '').trim().toUpperCase() as LeadStatus
    if (!id || !ALLOWED.includes(status)) {
      return NextResponse.json({ ok: false, error: 'id and valid status required' }, { status: 400 })
    }
    const updated = await prisma.$executeRawUnsafe(
      `UPDATE "SubscriptionRequestLead"
       SET "status" = $1
       WHERE "id" = $2 AND "restaurantId" = $3`,
      status,
      id,
      ctx.restaurantId
    )
    if (!updated) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    const message = status === 401 || status === 403 ? 'Недостаточно прав' : 'Не удалось обновить статус лида'
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
