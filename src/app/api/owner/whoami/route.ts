import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getRestaurantContext, resolveSingleTenantRestaurantId } from '@/lib/restaurant-context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Диагностика входа в кабинет: что сервер видит про ТЕКУЩЕГО пользователя.
 * Только свои данные, только с сессией. Открыть в мини-аппе: /api/owner/whoami
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.id) return NextResponse.json({ ok: false, error: 'нет сессии — откройте мини-апп из Telegram' }, { status: 401 })

  const safe = async <T,>(fn: () => Promise<T>) => {
    try {
      return await fn()
    } catch (e) {
      return { error: e instanceof Error ? e.message.slice(0, 200) : String(e) }
    }
  }

  const [ctx, forced, memberships, dbUser] = await Promise.all([
    safe(() => getRestaurantContext()),
    safe(() => resolveSingleTenantRestaurantId()),
    safe(() =>
      prisma.restaurantMember.findMany({
        where: { userId: user.id },
        select: { role: true, restaurant: { select: { id: true, name: true, isActive: true } } },
      })
    ),
    safe(() => prisma.user.findUnique({ where: { id: user.id }, select: { id: true } })),
  ])

  return NextResponse.json({
    ok: true,
    build: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    session: {
      userId: user.id,
      userExistsInDb: Boolean((dbUser as any)?.id),
      platformRole: user.platformRole ?? null,
      memberRole: user.memberRole ?? null,
      restaurantId: (session as any)?.restaurantId ?? user.restaurantId ?? null,
    },
    cookieRestaurantId: cookies().get('ufo_restaurant')?.value ?? null,
    forcedSingleTenantRestaurantId: forced,
    context: ctx,
    memberships,
  })
}
