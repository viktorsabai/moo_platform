import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getRestaurantContext } from '@/lib/restaurant-context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function setVenueCookie(res: NextResponse, restaurantId: string) {
  res.cookies.set('ufo_restaurant', restaurantId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    secure: process.env.NODE_ENV === 'production',
  })
}

async function verifyAndSwitch(restaurantId: string): Promise<{ ok: boolean; error?: string; status?: number }> {
  const ctx = await getRestaurantContext()
  if (!ctx?.userId) return { ok: false, error: 'unauthorized', status: 401 }
  const exists = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { id: true } })
  if (!exists?.id) return { ok: false, error: 'not found', status: 404 }
  const isSuperAdmin = ctx.platformRole === 'SUPERADMIN'
  if (!isSuperAdmin) {
    const member = await prisma.restaurantMember.findUnique({
      where: { restaurantId_userId: { restaurantId, userId: ctx.userId } },
      select: { role: true },
    })
    const canManage = member?.role === 'OWNER' || member?.role === 'ADMIN'
    if (canManage) return { ok: true }

    // JWT OWNER/ADMIN, а RestaurantMember ещё нет — upsert. Важно: сравниваем не только с ctx.restaurantId
    // (single-tenant / forced id может расходиться с JWT и с venue из списка), но и с restaurantId из сессии.
    const session = await getServerSession(authOptions)
    const sessRole = (session?.user as any)?.memberRole as string | undefined
    const sessionElevated = sessRole === 'OWNER' || sessRole === 'ADMIN'
    const sessionRid = String((session as any)?.restaurantId || (session?.user as any)?.restaurantId || '').trim()
    const ctxRid = String(ctx.restaurantId || '').trim()
    const alignsWithCtx = Boolean(ctxRid && restaurantId === ctxRid)
    const alignsWithSession = Boolean(sessionRid && restaurantId === sessionRid)
    const ctxElevated = ctx.memberRole === 'OWNER' || ctx.memberRole === 'ADMIN'

    if ((sessionElevated || ctxElevated) && (alignsWithCtx || alignsWithSession)) {
      try {
        const role = (sessRole === 'ADMIN' || ctx.memberRole === 'ADMIN' ? 'ADMIN' : 'OWNER') as 'OWNER' | 'ADMIN'
        await prisma.restaurantMember.upsert({
          where: { restaurantId_userId: { restaurantId, userId: ctx.userId } },
          create: { restaurantId, userId: ctx.userId, role },
          update: { role },
        })
      } catch {
        // гонка — всё равно разрешаем смену cookie
      }
      return { ok: true }
    }

    return { ok: false, error: 'forbidden', status: 403 }
  }
  return { ok: true }
}

/** GET ?venue=xxx&redirect=/admin — for fallback when cookie missing (e.g. from middleware). Verifies, sets cookie, redirects. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const restaurantId = searchParams.get('venue')?.trim() ?? ''
  const redirectTo = searchParams.get('redirect')?.trim() || '/admin'
  if (!restaurantId) {
    return NextResponse.redirect(new URL('/profile/owner', request.url))
  }
  const result = await verifyAndSwitch(restaurantId)
  if (!result.ok) {
    return NextResponse.redirect(new URL('/profile/owner', request.url))
  }
  const res = NextResponse.redirect(new URL(redirectTo, request.url), 307)
  setVenueCookie(res, restaurantId)
  return res
}

/** Switch active venue: OWNER/ADMIN can switch to their venue; SUPERADMIN to any. Sets cookie server-side. */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({} as any))
    const restaurantId = typeof body?.restaurantId === 'string' ? body.restaurantId.trim() : ''
    if (!restaurantId) {
      return NextResponse.json({ ok: false, error: 'restaurantId required' }, { status: 400 })
    }

    const result = await verifyAndSwitch(restaurantId)
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error || 'forbidden' },
        { status: result.status ?? 403 }
      )
    }

    const res = NextResponse.json({ ok: true, restaurantId })
    setVenueCookie(res, restaurantId)
    return res
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    return NextResponse.json(
      { ok: false, error: status === 403 ? 'forbidden' : status === 401 ? 'unauthorized' : 'Ошибка' },
      { status }
    )
  }
}
