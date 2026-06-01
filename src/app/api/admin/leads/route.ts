import { NextResponse } from 'next/server'
import { getRestaurantContext, requireRestaurantAdmin } from '@/lib/restaurant-context'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type LeadStatus = 'NEW' | 'IN_PROGRESS' | 'DONE'

const ALLOWED: LeadStatus[] = ['NEW', 'IN_PROGRESS', 'DONE']

export async function GET() {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())
    const leads = await prisma.serviceLead.findMany({
      where: { restaurantId: ctx.restaurantId },
      orderBy: [{ createdAt: 'desc' }],
      take: 200,
      select: {
        id: true,
        type: true,
        title: true,
        note: true,
        guestCount: true,
        eventDate: true,
        status: true,
        telegramId: true,
        name: true,
        createdAt: true,
        user: { select: { name: true, telegramUsername: true, telegramId: true } },
      },
    })
    return NextResponse.json({ ok: true, leads })
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    const message = status === 401 || status === 403 ? 'Недостаточно прав' : 'Не удалось загрузить заявки'
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())
    const body = await request.json().catch(() => ({} as any))
    const id = String(body?.id || '').trim()
    const status = String(body?.status || '').trim().toUpperCase() as LeadStatus
    if (!id || !ALLOWED.includes(status)) {
      return NextResponse.json({ ok: false, error: 'id and valid status required' }, { status: 400 })
    }
    const existing = await prisma.serviceLead.findFirst({
      where: { id, restaurantId: ctx.restaurantId },
      select: { id: true },
    })
    if (!existing) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })
    await prisma.serviceLead.update({
      where: { id },
      data: { status },
    })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    const message = status === 401 || status === 403 ? 'Недостаточно прав' : 'Не удалось обновить статус заявки'
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
