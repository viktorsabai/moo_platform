import { NextResponse } from 'next/server'
import { getRestaurantContext, requireRestaurantAdmin } from '@/lib/restaurant-context'
import { getOwnerInbox } from '@/lib/owner-inbox-count'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Счётчик и список входящих для короны и блока «входящие» в ЛК. */
export async function GET() {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())
    const { total, breakdown, items } = await getOwnerInbox(ctx.restaurantId)
    return NextResponse.json(
      { ok: true, total, breakdown, items },
      { headers: { 'Cache-Control': 'private, no-store' } }
    )
  } catch (e: unknown) {
    const status = Number((e as { statusCode?: number })?.statusCode || 500)
    if (status === 401 || status === 403) {
      return NextResponse.json(
        { ok: false, total: 0, breakdown: { orders: 0, subscriptions: 0, leads: 0 }, items: [] },
        { status }
      )
    }
    return NextResponse.json({ ok: false, total: 0, items: [] }, { status: 500 })
  }
}
