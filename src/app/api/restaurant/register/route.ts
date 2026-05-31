import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRestaurantContext } from '@/lib/restaurant-context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Self-serve: any authenticated user can create a restaurant and become OWNER. */
export async function POST(request: Request) {
  try {
    const ctx = await getRestaurantContext()
    if (!ctx?.userId) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({} as any))
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    const slug = typeof body?.slug === 'string' ? body.slug.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '') : ''
    const startParamRaw = typeof body?.startParam === 'string' ? body.startParam.trim() : ''
    const startParam = startParamRaw || slug

    if (!name || !slug) {
      return NextResponse.json({ ok: false, error: 'name and slug required' }, { status: 400 })
    }

    const existing = await prisma.restaurant.findFirst({
      where: { OR: [{ slug }, { id: slug }] },
      select: { id: true },
    })
    if (existing) {
      return NextResponse.json({ ok: false, error: 'slug already used' }, { status: 400 })
    }

    const created = await prisma.restaurant.create({
      data: { name, slug, isActive: true },
      select: { id: true },
    })

    await prisma.botIntegration.create({
      data: {
        restaurant: { connect: { id: created.id } },
        startParam: startParam || slug,
        botUsername: null,
        botToken: null,
      },
      select: { id: true },
    })

    await prisma.restaurantMember.upsert({
      where: { restaurantId_userId: { restaurantId: created.id, userId: ctx.userId } },
      create: { restaurantId: created.id, userId: ctx.userId, role: 'OWNER' },
      update: { role: 'OWNER' },
      select: { id: true },
    })

    const res = NextResponse.json({
      ok: true,
      restaurantId: created.id,
      startParam: startParam || slug,
    })
    res.cookies.set('ufo_restaurant', created.id, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    })
    return res
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || 'Ошибка') },
      { status: 500 }
    )
  }
}
