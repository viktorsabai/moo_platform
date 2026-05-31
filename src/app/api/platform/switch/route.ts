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
    if (!restaurantId) return NextResponse.json({ ok: false, error: 'restaurantId required' }, { status: 400 })

    const exists = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { id: true } })
    if (!exists?.id) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })

    const res = NextResponse.json({ ok: true, restaurantId })
    res.cookies.set('ufo_restaurant', restaurantId, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })
    return res
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    return NextResponse.json({ ok: false, error: status === 403 ? 'forbidden' : 'Ошибка' }, { status })
  }
}

