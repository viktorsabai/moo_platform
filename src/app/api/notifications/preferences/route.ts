import { NextResponse } from 'next/server'
import { getRestaurantContext, requireRestaurantContext } from '@/lib/restaurant-context'
import { prisma } from '@/lib/prisma'
import { NOTIFICATION_EVENTS } from '@/lib/notification-registry'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type PreferenceMode = 'INSTANT' | 'DIGEST' | 'OFF'
const MODES = new Set<PreferenceMode>(['INSTANT', 'DIGEST', 'OFF'])

function isTeamMember(ctx: { memberRole?: string; platformRole: string }) {
  return ctx.platformRole === 'SUPERADMIN' || Boolean(ctx.memberRole)
}

function allowedEventsFor(ctx: { memberRole?: string; platformRole: string }) {
  const audience = isTeamMember(ctx) ? 'owner' : 'guest'
  return NOTIFICATION_EVENTS.filter((event) => event.audience === audience)
}

function serializeEvent(event: (typeof NOTIFICATION_EVENTS)[number], mode: PreferenceMode) {
  return {
    id: event.id,
    category: event.category,
    title: event.title,
    description: event.description,
    audience: event.audience,
    defaultMode: 'INSTANT' as PreferenceMode,
    mode,
    canDigest: event.category === 'marketing' || event.category === 'system',
  }
}

export async function GET() {
  try {
    const ctx = requireRestaurantContext(await getRestaurantContext())
    const allowed = allowedEventsFor(ctx)
    const rows = await prisma.notificationPreference.findMany({
      where: { restaurantId: ctx.restaurantId, userId: ctx.userId },
      select: { eventId: true, mode: true },
    })
    const modeByEvent = new Map(rows.map((row) => [row.eventId, String(row.mode || 'INSTANT') as PreferenceMode]))
    return NextResponse.json({
      ok: true,
      audience: isTeamMember(ctx) ? 'owner' : 'guest',
      role: ctx.memberRole || 'CUSTOMER',
      events: allowed.map((event) => serializeEvent(event, modeByEvent.get(event.id) || 'INSTANT')),
    })
  } catch (error: unknown) {
    const status = Number((error as { statusCode?: number })?.statusCode || 500)
    return NextResponse.json({ ok: false, error: status === 401 ? 'unauthorized' : 'failed' }, { status })
  }
}

export async function PUT(request: Request) {
  try {
    const ctx = requireRestaurantContext(await getRestaurantContext())
    const body = await request.json().catch(() => ({} as Record<string, unknown>))
    const eventId = String(body.eventId || '').trim()
    const mode = String(body.mode || '').trim().toUpperCase() as PreferenceMode
    const event = allowedEventsFor(ctx).find((candidate) => candidate.id === eventId)
    if (!event) return NextResponse.json({ ok: false, error: 'invalid_event' }, { status: 400 })
    if (!MODES.has(mode)) return NextResponse.json({ ok: false, error: 'invalid_mode' }, { status: 400 })
    if (mode === 'DIGEST' && event.category !== 'marketing' && event.category !== 'system') {
      return NextResponse.json({ ok: false, error: 'digest_not_supported' }, { status: 400 })
    }

    const row = await prisma.notificationPreference.upsert({
      where: {
        restaurantId_userId_eventId: {
          restaurantId: ctx.restaurantId,
          userId: ctx.userId,
          eventId,
        },
      },
      create: { restaurantId: ctx.restaurantId, userId: ctx.userId, eventId, mode },
      update: { mode },
      select: { eventId: true, mode: true, updatedAt: true },
    })
    return NextResponse.json({ ok: true, preference: row })
  } catch (error: unknown) {
    const status = Number((error as { statusCode?: number })?.statusCode || 500)
    return NextResponse.json({ ok: false, error: status === 401 ? 'unauthorized' : 'failed' }, { status })
  }
}
