import { NextResponse } from 'next/server'
import { getRestaurantContext, requireRestaurantAdmin } from '@/lib/restaurant-context'
import { getOwnerInboxCount } from '@/lib/owner-inbox-count'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Счётчик входящих для короны в шапке (заказы · подписки · кейтеринг). */
export async function GET() {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())
    const { total, breakdown } = await getOwnerInboxCount(ctx.restaurantId)
    return NextResponse.json(
      { ok: true, total, breakdown },
      { headers: { 'Cache-Control': 'private, no-store' } }
    )
  } catch (e: unknown) {
    const status = Number((e as { statusCode?: number })?.statusCode || 500)
    if (status === 401 || status === 403) {
      return NextResponse.json({ ok: false, total: 0, breakdown: { orders: 0, subscriptions: 0, leads: 0 } }, { status })
    }
    return NextResponse.json({ ok: false, total: 0 }, { status: 500 })
  }
}
