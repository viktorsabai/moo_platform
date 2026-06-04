import { NextResponse } from 'next/server'
import { getAdminSubscriptions } from '@/lib/get-admin-subscriptions'
import { getRestaurantContext, requireRestaurantAdmin } from '@/lib/restaurant-context'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())
    const subscriptions = await getAdminSubscriptions(ctx.restaurantId)
    return NextResponse.json({ ok: true, subscriptions })
  } catch (e: unknown) {
    const status = Number((e as { statusCode?: number })?.statusCode || 500)
    return NextResponse.json({ ok: false, error: status === 403 ? 'forbidden' : 'Ошибка' }, { status })
  }
}

/** DELETE: удалить подписку по id, или все подписки ресторана (resetAll=1) */
export async function DELETE(request: Request) {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())
    const url = new URL(request.url)
    const resetAll = url.searchParams.get('resetAll') === '1'
    const id = url.searchParams.get('id')?.trim()

    if (resetAll) {
      await prisma.subscription.deleteMany({ where: { restaurantId: ctx.restaurantId } })
      return NextResponse.json({ ok: true })
    }
    if (!id) {
      return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 })
    }
    await prisma.subscription.delete({ where: { id, restaurantId: ctx.restaurantId } })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const status = Number((e as { statusCode?: number })?.statusCode || 500)
    return NextResponse.json({ ok: false, error: 'Ошибка' }, { status })
  }
}
