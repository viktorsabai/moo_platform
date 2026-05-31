import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { randomUUID } from 'crypto'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getConsumerRestaurantId } from '@/lib/restaurant-context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED_TYPES = new Set([
  'VIEW_PAGE',
  'VIEW_DISH',
  'CART_WITH_ITEMS',
  'ADD_TO_CART',
  'REMOVE_FROM_CART',
  'START_CHECKOUT',
  'ADD_FAVORITE',
  'REMOVE_FAVORITE',
  'SUBMIT_ORDER',
  'SUBMIT_LEAD',
  'VIEW_SUBSCRIPTION',
  'SUBSCRIPTION_LEAD',
])

function safeMetadata(input: unknown) {
  if (!input || typeof input !== 'object') return null
  try {
    return JSON.stringify(input).slice(0, 4000)
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({} as any))
    const type = String(body?.type || '').trim().toUpperCase()
    if (!ALLOWED_TYPES.has(type)) return NextResponse.json({ ok: false }, { status: 400 })

    const resolvedRestaurantId = await getConsumerRestaurantId()
    const bodyRestaurantId = String(body?.restaurantId || '').trim()
    let restaurantId = resolvedRestaurantId
    if (bodyRestaurantId && bodyRestaurantId !== resolvedRestaurantId) {
      const exists = await prisma.restaurant.findUnique({
        where: { id: bodyRestaurantId },
        select: { id: true },
      })
      if (exists?.id) restaurantId = exists.id
    }
    const session = await getServerSession(authOptions).catch(() => null)
    const userId = typeof session?.user?.id === 'string' ? session.user.id : null
    const telegramId = String((session?.user as any)?.telegramId || body?.telegramId || '').trim() || null
    const path = String(body?.path || '').slice(0, 240) || null

    await prisma.$executeRawUnsafe(
      `
      INSERT INTO "UserActivityEvent" ("id", "restaurantId", "userId", "telegramId", "type", "path", "metadata", "createdAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW())
      `,
      randomUUID(),
      restaurantId,
      userId,
      telegramId,
      type,
      path,
      safeMetadata(body?.metadata)
    )

    return NextResponse.json({ ok: true })
  } catch {
    // Tracking should never break the product.
    return NextResponse.json({ ok: true, skipped: true })
  }
}
