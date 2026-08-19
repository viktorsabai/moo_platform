import { NextResponse } from 'next/server'
import { getConsumerRestaurantId } from '@/lib/restaurant-context'
import { getRestaurantContentSyncState } from '@/lib/content-sync'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const restaurantId = await getConsumerRestaurantId()
    const state = await getRestaurantContentSyncState(restaurantId)

    return NextResponse.json(
      {
        ok: true,
        restaurantId,
        menuVersion: state.menuVersion,
        subscriptionVersion: state.subscriptionVersion,
        lastEventId: state.lastEventId,
        lastPublishedAt: state.lastPublishedAt,
        serverTime: new Date().toISOString(),
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  } catch {
    return NextResponse.json({ ok: false, error: 'Ошибка состояния синхронизации' }, { status: 500 })
  }
}
