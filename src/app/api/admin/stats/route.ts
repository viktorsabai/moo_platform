import { NextResponse } from 'next/server'
import { getRestaurantContext, requireRestaurantAdmin } from '@/lib/restaurant-context'
import { getAdminStats } from '@/lib/admin-stats'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())
    const stats = await getAdminStats(ctx.restaurantId)
    return NextResponse.json({ ok: true, ...stats })
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    return NextResponse.json(
      { ok: false, error: status === 403 ? 'forbidden' : 'Ошибка' },
      { status }
    )
  }
}
