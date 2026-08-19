import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOpsTelegramIds } from '@/lib/notifications'
import { getRestaurantContext, requireRestaurantAdmin } from '@/lib/restaurant-context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())
    const [database, bot, opsIds, members] = await Promise.all([
      prisma.$queryRaw`SELECT 1`.then(() => 'ok' as const).catch(() => 'error' as const),
      prisma.botIntegration.findFirst({ where: { restaurantId: ctx.restaurantId }, select: { botToken: true, botUsername: true } }),
      getOpsTelegramIds(ctx.restaurantId),
      prisma.restaurantMember.findMany({ where: { restaurantId: ctx.restaurantId, role: { in: ['OWNER', 'ADMIN', 'STAFF'] } }, select: { user: { select: { telegramId: true } } } }),
    ])
    const teamWithTelegram = members.filter((member) => Boolean(member.user?.telegramId)).length
    const checks = [
      { id: 'database', label: 'База данных', ok: database === 'ok' },
      { id: 'bot', label: 'BotIntegration', ok: Boolean(bot?.botToken) },
      { id: 'ops_recipients', label: 'Получатели owner-уведомлений', ok: opsIds.length > 0 },
      { id: 'team_telegram', label: 'Команда с Telegram ID', ok: teamWithTelegram > 0 },
    ]
    return NextResponse.json({
      ok: true,
      ready: checks.every((check) => check.ok),
      generatedAt: new Date().toISOString(),
      restaurantId: ctx.restaurantId,
      checks,
      summary: { botUsername: bot?.botUsername ?? null, opsRecipientCount: opsIds.length, teamTotal: members.length, teamWithTelegram },
    })
  } catch (error: any) {
    const status = Number(error?.statusCode || 500)
    return NextResponse.json({ ok: false, error: status === 403 ? 'forbidden' : 'Ошибка operational health' }, { status })
  }
}
