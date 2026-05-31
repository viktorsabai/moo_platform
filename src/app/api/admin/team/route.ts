import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { getRestaurantContext, requireRestaurantAdmin } from '@/lib/restaurant-context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isMissingTableError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === 'P2021' || error.code === 'P2022')
  )
}

async function getRestaurantBotToken(restaurantId: string): Promise<string | null> {
  const row = await prisma.botIntegration.findFirst({
    where: { restaurantId },
    select: { botToken: true },
    orderBy: { createdAt: 'asc' },
  })
  return row?.botToken || process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || null
}

async function resolveTelegramContact(
  telegramId: string,
  restaurantId: string
): Promise<{ name?: string; telegramUsername?: string } | null> {
  const botToken = await getRestaurantBotToken(restaurantId)
  if (!botToken) return null
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getChat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: telegramId }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.ok || !data?.result) return null
    const first = String(data.result.first_name || '').trim()
    const last = String(data.result.last_name || '').trim()
    const username = String(data.result.username || '').trim()
    const name = [first, last].filter(Boolean).join(' ').trim()
    return {
      name: name || undefined,
      telegramUsername: username || undefined,
    }
  } catch {
    return null
  }
}

export async function GET() {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())
    const members = await prisma.restaurantMember.findMany({
      where: { restaurantId: ctx.restaurantId },
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true,
        role: true,
        user: { select: { id: true, name: true, email: true, telegramId: true, telegramUsername: true } },
      },
    })

    let invites: Array<{
      id: string
      invitedTelegramId: string
      role: 'OWNER' | 'ADMIN' | 'STAFF'
      status: 'PENDING' | 'ACCEPTED' | 'DECLINED'
      createdAt: Date
      resolvedAt: Date | null
      createdBy: { name: string | null; telegramUsername: string | null; telegramId: string | null }
    }> = []
    try {
      invites = await prisma.restaurantInvite.findMany({
        where: { restaurantId: ctx.restaurantId },
        orderBy: [{ createdAt: 'desc' }],
        take: 80,
        select: {
          id: true,
          invitedTelegramId: true,
          role: true,
          status: true,
          createdAt: true,
          resolvedAt: true,
          createdBy: { select: { name: true, telegramUsername: true, telegramId: true } },
        },
      })
    } catch (e) {
      if (!isMissingTableError(e)) throw e
    }

    return NextResponse.json({ ok: true, members, invites })
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    return NextResponse.json({ ok: false, error: status === 403 ? 'forbidden' : 'Ошибка' }, { status })
  }
}

export async function POST(request: Request) {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())
    const body = await request.json().catch(() => ({} as any))
    const telegramId = typeof body?.telegramId === 'string' ? body.telegramId.trim() : ''
    const role = String(body?.role || 'STAFF').toUpperCase()
    if (!telegramId) return NextResponse.json({ ok: false, error: 'telegramId required' }, { status: 400 })
    if (!['STAFF', 'ADMIN', 'OWNER'].includes(role)) return NextResponse.json({ ok: false, error: 'bad role' }, { status: 400 })

    const me = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { telegramId: true } })
    if (me?.telegramId && me.telegramId === telegramId) {
      return NextResponse.json({ ok: false, error: 'нельзя пригласить самого себя' }, { status: 400 })
    }

    const user = await prisma.user.findFirst({
      where: { telegramId },
      select: { id: true, name: true },
    })
    if (user?.id) {
      const hasPlaceholderName = !String(user.name || '').trim() || String(user.name || '').trim().toLowerCase().startsWith('telegram ')
      if (hasPlaceholderName) {
        const contact = await resolveTelegramContact(telegramId, ctx.restaurantId)
        if (contact?.name || contact?.telegramUsername) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              ...(contact.name ? { name: contact.name } : {}),
              ...(contact.telegramUsername ? { telegramUsername: contact.telegramUsername } : {}),
            },
          })
        }
      }
      const member = await prisma.restaurantMember.upsert({
        where: { restaurantId_userId: { restaurantId: ctx.restaurantId, userId: user.id } },
        create: { restaurantId: ctx.restaurantId, userId: user.id, role: role as any },
        update: { role: role as any },
        select: { id: true, role: true },
      })
      return NextResponse.json({ ok: true, kind: 'member' as const, member })
    }

    try {
      const existingPending = await prisma.restaurantInvite.findFirst({
        where: { restaurantId: ctx.restaurantId, invitedTelegramId: telegramId, status: 'PENDING' },
        select: { id: true },
      })
      if (existingPending?.id) {
        const invite = await prisma.restaurantInvite.update({
          where: { id: existingPending.id },
          data: { role: role as any },
          select: {
            id: true,
            invitedTelegramId: true,
            role: true,
            status: true,
            createdAt: true,
            resolvedAt: true,
          },
        })
        return NextResponse.json({ ok: true, kind: 'invite_pending' as const, invite })
      }

      const invite = await prisma.restaurantInvite.create({
        data: {
          restaurantId: ctx.restaurantId,
          invitedTelegramId: telegramId,
          role: role as any,
          status: 'PENDING',
          createdByUserId: ctx.userId,
        },
        select: {
          id: true,
          invitedTelegramId: true,
          role: true,
          status: true,
          createdAt: true,
          resolvedAt: true,
        },
      })
      return NextResponse.json({ ok: true, kind: 'invite_created' as const, invite })
    } catch (e) {
      if (isMissingTableError(e)) {
        // Fallback mode without RestaurantInvite table:
        // create/update user by telegramId and immediately add to team.
        const contact = await resolveTelegramContact(telegramId, ctx.restaurantId)
        const email = `tg_${telegramId}@telegram.local`
        const fallbackUser = await prisma.user.upsert({
          where: { email },
          create: {
            email,
            name: contact?.name || `telegram ${telegramId}`,
            passwordHash: crypto.randomBytes(32).toString('hex'),
            telegramId,
            telegramUsername: contact?.telegramUsername || null,
          },
          update: {
            telegramId,
            ...(contact?.name ? { name: contact.name } : {}),
            ...(contact?.telegramUsername ? { telegramUsername: contact.telegramUsername } : {}),
          },
          select: { id: true },
        })
        const member = await prisma.restaurantMember.upsert({
          where: { restaurantId_userId: { restaurantId: ctx.restaurantId, userId: fallbackUser.id } },
          create: { restaurantId: ctx.restaurantId, userId: fallbackUser.id, role: role as any },
          update: { role: role as any },
          select: { id: true, role: true },
        })
        return NextResponse.json({
          ok: true,
          kind: 'member_bootstrap' as const,
          member,
          warning: 'invite_module_missing_fallback_member_created',
        })
      }
      throw e
    }
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    return NextResponse.json({ ok: false, error: status === 403 ? 'forbidden' : 'Ошибка' }, { status })
  }
}
