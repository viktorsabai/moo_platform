import { NextResponse } from 'next/server'
import { getConsumerRestaurantId } from '@/lib/restaurant-context'
import { listRestaurantContentSyncEvents, type ContentSyncDomain } from '@/lib/content-sync'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED_DOMAINS = new Set<ContentSyncDomain>(['MENU', 'SUBSCRIPTION'])

export async function GET(request: Request) {
  try {
    const restaurantId = await getConsumerRestaurantId()
    const url = new URL(request.url)
    const domains = url.searchParams
      .getAll('domain')
      .flatMap((value) => value.split(','))
      .map((value) => value.trim().toUpperCase())
      .filter((value): value is ContentSyncDomain => ALLOWED_DOMAINS.has(value as ContentSyncDomain))

    const events = await listRestaurantContentSyncEvents({
      restaurantId,
      after: url.searchParams.get('after'),
      domains: domains.length ? domains : undefined,
      limit: Number(url.searchParams.get('limit') || 50),
    })

    return NextResponse.json(
      { ok: true, restaurantId, events, nextCursor: events.at(-1)?.id ?? url.searchParams.get('after') ?? null },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  } catch {
    return NextResponse.json({ ok: false, error: 'Ошибка событий синхронизации' }, { status: 500 })
  }
}
