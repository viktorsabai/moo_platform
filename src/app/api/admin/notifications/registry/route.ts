import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOpsTelegramIds } from '@/lib/notifications'
import {
  AUDIENCE_LABEL,
  CATEGORY_LABEL,
  groupNotificationsByCategory,
  NOTIFICATION_SETUP,
} from '@/lib/notification-registry'
import { getRestaurantContext, requireRestaurantAdmin } from '@/lib/restaurant-context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())

    const [bot, opsIds, teamMembers] = await Promise.all([
      prisma.botIntegration.findFirst({
        where: { restaurantId: ctx.restaurantId },
        select: { botToken: true, botUsername: true },
      }),
      getOpsTelegramIds(ctx.restaurantId),
      prisma.restaurantMember.findMany({
        where: { restaurantId: ctx.restaurantId, role: { in: ['OWNER', 'ADMIN', 'STAFF'] } },
        select: {
          role: true,
          user: { select: { name: true, telegramId: true, telegramUsername: true } },
        },
      }),
    ])

    const teamWithTelegram = teamMembers.filter((m) => Boolean(m.user?.telegramId))

    return NextResponse.json({
      ok: true,
      setup: {
        botConnected: Boolean(bot?.botToken),
        botUsername: bot?.botUsername ?? null,
        webhookConfigured: Boolean(bot?.botToken),
        opsRecipientCount: opsIds.length,
        teamTotal: teamMembers.length,
        teamWithTelegram: teamWithTelegram.length,
        envOwnerIds: Boolean(process.env.UFO_OWNER_NOTIFY_TELEGRAM_IDS?.trim()),
      },
      team: teamMembers.map((m) => ({
        role: m.role,
        name: m.user?.name ?? null,
        telegramUsername: m.user?.telegramUsername ?? null,
        hasTelegram: Boolean(m.user?.telegramId),
      })),
      setupGuide: NOTIFICATION_SETUP,
      categories: groupNotificationsByCategory().map((g) => ({
        category: g.category,
        label: CATEGORY_LABEL[g.category],
        events: g.events.map((e) => ({
          ...e,
          audienceLabel: AUDIENCE_LABEL[e.audience],
        })),
      })),
    })
  } catch (e: unknown) {
    const status = Number((e as { statusCode?: number })?.statusCode || 500)
    return NextResponse.json({ ok: false, error: status === 403 ? 'forbidden' : 'failed' }, { status })
  }
}
