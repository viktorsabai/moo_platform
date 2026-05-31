import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getConsumerRestaurantId } from '@/lib/restaurant-context'
import { prisma } from '@/lib/prisma'
import { resolveApiUser } from '@/lib/tg-auth-resolver'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function getContext() {
  const authUser = await resolveApiUser(headers())
  const userId = authUser.userId

  if (!userId) {
    return { error: NextResponse.json({ ok: false, error: 'нужна авторизация' }, { status: 401 }) }
  }
  const restaurantId = await getConsumerRestaurantId()
  return { userId, restaurantId }
}

export async function GET() {
  const ctx = await getContext()
  if ('error' in ctx) return ctx.error
  const favorites = await prisma.favoriteDish.findMany({
    where: { userId: ctx.userId, restaurantId: ctx.restaurantId },
    orderBy: { createdAt: 'desc' },
    select: {
      dishId: true,
      createdAt: true,
      dish: {
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          image: true,
          categoryId: true,
          isAvailable: true,
          tags: true,
          updatedAt: true,
          category: { select: { name: true, slug: true } },
        },
      },
    },
  })
  return NextResponse.json({
    ok: true,
    ids: favorites.map((f) => f.dishId),
    favorites: favorites.map((f) => ({
      dishId: f.dishId,
      createdAt: f.createdAt,
      dish: {
        ...f.dish,
        price: Number(f.dish.price),
        image: typeof f.dish.image === 'string' && f.dish.image.startsWith('data:image/')
          ? `/api/dishes/image/${encodeURIComponent(f.dish.id)}?r=${encodeURIComponent(ctx.restaurantId)}&v=${new Date(f.dish.updatedAt).getTime()}`
          : f.dish.image,
      },
    })),
  })
}

export async function POST(request: Request) {
  const ctx = await getContext()
  if ('error' in ctx) return ctx.error
  const body = await request.json().catch(() => ({} as any))
  const dishId = String(body?.dishId || '').trim()
  if (!dishId) return NextResponse.json({ ok: false, error: 'dishId required' }, { status: 400 })

  const dish = await prisma.dish.findFirst({
    where: { id: dishId },
    select: { id: true, restaurantId: true },
  })
  if (!dish) return NextResponse.json({ ok: false, error: 'dish not found' }, { status: 404 })
  const effectiveRestaurantId = String(dish.restaurantId || ctx.restaurantId)

  await prisma.favoriteDish.upsert({
    where: {
      restaurantId_userId_dishId: {
        restaurantId: effectiveRestaurantId,
        userId: ctx.userId,
        dishId,
      },
    },
    update: {},
    create: {
      restaurantId: effectiveRestaurantId,
      userId: ctx.userId,
      dishId,
    },
  })
  return NextResponse.json({ ok: true, dishId, restaurantId: effectiveRestaurantId })
}

export async function DELETE(request: Request) {
  const ctx = await getContext()
  if ('error' in ctx) return ctx.error
  const { searchParams } = new URL(request.url)
  const body = await request.json().catch(() => ({} as any))
  const dishId = String(searchParams.get('dishId') || body?.dishId || '').trim()
  if (!dishId) return NextResponse.json({ ok: false, error: 'dishId required' }, { status: 400 })
  await prisma.favoriteDish.deleteMany({
    where: { userId: ctx.userId, restaurantId: ctx.restaurantId, dishId },
  })
  return NextResponse.json({ ok: true, dishId })
}
