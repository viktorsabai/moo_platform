import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRestaurantContext, requireRestaurantContext } from '@/lib/restaurant-context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function requirePlatformAdmin(ctx: Awaited<ReturnType<typeof getRestaurantContext>>) {
  const c = requireRestaurantContext(ctx)
  if (c.platformRole !== 'SUPERADMIN') {
    const err = new Error('forbidden')
    ;(err as any).statusCode = 403
    throw err
  }
  return c
}

export async function POST(request: Request) {
  try {
    requirePlatformAdmin(await getRestaurantContext())
    const body = await request.json().catch(() => ({} as any))
    const restaurantId = typeof body?.restaurantId === 'string' ? body.restaurantId : ''
    const startParam = typeof body?.startParam === 'string' ? body.startParam.trim() : ''
    const botUsername = typeof body?.botUsername === 'string' ? body.botUsername.trim() : ''
    const botToken = typeof body?.botToken === 'string' ? body.botToken.trim() : ''

    if (!restaurantId || !startParam) {
      return NextResponse.json({ ok: false, error: 'restaurantId/startParam required' }, { status: 400 })
    }

    const exists = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { id: true } })
    if (!exists?.id) return NextResponse.json({ ok: false, error: 'restaurant not found' }, { status: 404 })

    const created = await prisma.botIntegration.create({
      data: {
        restaurant: { connect: { id: restaurantId } },
        startParam,
        botUsername: botUsername || null,
        botToken: botToken || null,
      },
      select: { id: true },
    })

    return NextResponse.json({ ok: true, botIntegrationId: created.id })
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    return NextResponse.json({ ok: false, error: status === 403 ? 'forbidden' : String(e?.message || 'Ошибка') }, { status })
  }
}

