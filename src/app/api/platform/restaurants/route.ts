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

export async function GET() {
  try {
    requirePlatformAdmin(await getRestaurantContext())
    const restaurants = await prisma.restaurant.findMany({
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        botIntegrations: { select: { id: true, botUsername: true, startParam: true } },
      },
    })
    return NextResponse.json({ ok: true, restaurants })
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    return NextResponse.json({ ok: false, error: status === 403 ? 'forbidden' : 'Ошибка' }, { status })
  }
}

export async function POST(request: Request) {
  try {
    requirePlatformAdmin(await getRestaurantContext())
    const body = await request.json().catch(() => ({} as any))
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    const slug = typeof body?.slug === 'string' ? body.slug.trim() : ''
    const startParamRaw = typeof body?.startParam === 'string' ? body.startParam.trim() : ''
    const startParam = startParamRaw || slug
    const botUsername = typeof body?.botUsername === 'string' ? body.botUsername.trim() : ''
    const botToken = typeof body?.botToken === 'string' ? body.botToken.trim() : ''
    const ownerTelegramId = typeof body?.ownerTelegramId === 'string' ? body.ownerTelegramId.trim() : ''
    if (!name || !slug) return NextResponse.json({ ok: false, error: 'name/slug required' }, { status: 400 })
    if (!startParam) return NextResponse.json({ ok: false, error: 'startParam required' }, { status: 400 })

    const created = await prisma.restaurant.create({
      data: { name, slug, isActive: true },
      select: { id: true },
    })

    // Create bot integration immediately so QR/deeplink exists from day 1.
    await prisma.botIntegration.create({
      data: {
        restaurant: { connect: { id: created.id } },
        startParam,
        botUsername: botUsername || null,
        botToken: botToken || null,
      },
      select: { id: true },
    })

    // Optional: set restaurant owner (requires that user has opened mini app at least once)
    if (ownerTelegramId) {
      const owner = await prisma.user.findFirst({ where: { telegramId: ownerTelegramId }, select: { id: true } })
      if (owner?.id) {
        await prisma.restaurantMember.upsert({
          where: { restaurantId_userId: { restaurantId: created.id, userId: owner.id } },
          create: { restaurantId: created.id, userId: owner.id, role: 'OWNER' },
          update: { role: 'OWNER' },
          select: { id: true },
        })
      }
    }

    return NextResponse.json({ ok: true, restaurantId: created.id, startParam })
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    return NextResponse.json({ ok: false, error: status === 403 ? 'forbidden' : String(e?.message || 'Ошибка') }, { status })
  }
}

