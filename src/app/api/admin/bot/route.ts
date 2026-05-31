import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRestaurantContext, requireRestaurantAdmin } from '@/lib/restaurant-context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Owner/Admin updates their venue's bot (username, token). Creates BotIntegration if missing. */
export async function POST(request: Request) {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())
    const body = await request.json().catch(() => ({} as any))
    const botUsername = typeof body?.botUsername === 'string' ? body.botUsername.trim() : null
    const botToken = typeof body?.botToken === 'string' ? body.botToken.trim() : null

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: ctx.restaurantId },
      select: { id: true, slug: true },
    })
    if (!restaurant) {
      return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })
    }

    const existing = await prisma.botIntegration.findFirst({
      where: { restaurantId: ctx.restaurantId },
      select: { id: true, startParam: true },
    })

    if (existing) {
      await prisma.botIntegration.update({
        where: { id: existing.id },
        data: {
          ...(botUsername !== null ? { botUsername: botUsername || null } : {}),
          ...(botToken !== null ? { botToken: botToken || null } : {}),
        },
      })
    } else {
      await prisma.botIntegration.create({
        data: {
          restaurantId: ctx.restaurantId,
          startParam: restaurant.slug,
          botUsername: botUsername || null,
          botToken: botToken || null,
        },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    return NextResponse.json(
      { ok: false, error: status === 403 ? 'forbidden' : 'Ошибка' },
      { status }
    )
  }
}
