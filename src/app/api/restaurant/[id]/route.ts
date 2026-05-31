import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getRestaurantContext, requireRestaurantAdmin } from '@/lib/restaurant-context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Update restaurant (name). Only OWNER/ADMIN of that venue or SUPERADMIN. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())
    const id = (await params).id
    if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 })
    if (id !== ctx.restaurantId && ctx.platformRole !== 'SUPERADMIN') {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
    }
    const body = await request.json().catch(() => ({} as any))
    const data: { name?: string; address?: string | null } = {}
    if (typeof body?.name === 'string' && body.name.trim()) data.name = body.name.trim()
    if ('address' in body) data.address = typeof body.address === 'string' ? body.address.trim() || null : null
    if (Object.keys(data).length === 0) return NextResponse.json({ ok: false, error: 'name or address required' }, { status: 400 })
    const updated = await prisma.restaurant.update({
      where: { id },
      data,
      select: { id: true, name: true, address: true },
    })
    const res = NextResponse.json({ ok: true, restaurant: updated })
    // Синхронизация: cookie для consumer API (меню, подписки) — единый контекст ЛК ↔ витрина
    res.cookies.set('ufo_restaurant', updated.id, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    })
    return res
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    return NextResponse.json({ ok: false, error: status === 403 ? 'forbidden' : 'Ошибка' }, { status })
  }
}

/** Delete a restaurant. Only OWNER/ADMIN of that venue or SUPERADMIN. Forbidden for id "default". */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const id = (await params).id
  if (!id || id === 'default') {
    return NextResponse.json({ ok: false, error: 'cannot_delete_default' }, { status: 400 })
  }

  const platformRole = (session?.user as any)?.platformRole
  const isSuperAdmin = platformRole === 'SUPERADMIN'

  if (!isSuperAdmin) {
    const member = await prisma.restaurantMember.findUnique({
      where: { restaurantId_userId: { restaurantId: id, userId } },
      select: { role: true },
    })
    const role = member?.role
    if (role !== 'OWNER' && role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
    }
  }

  const existing = await prisma.restaurant.findUnique({
    where: { id },
    select: { id: true },
  })
  if (!existing) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  await prisma.restaurant.delete({
    where: { id },
  })

  return NextResponse.json({ ok: true })
}
