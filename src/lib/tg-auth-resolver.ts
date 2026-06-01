import crypto from 'crypto'
import { getServerSession } from 'next-auth'
import type { ReadonlyHeaders } from 'next/dist/server/web/spec-extension/adapters/headers'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { acceptPendingRestaurantInvites } from '@/lib/restaurant-invites'
import { fieldsFromTelegramWebAppUser } from '@/lib/telegram-user-fields'

function parseTelegramIds(value: string): string[] {
  return String(value || '')
    .split(',')
    .map((v) => v.trim().replace(/^['"]+|['"]+$/g, ''))
    .filter(Boolean)
}

const SUPERADMIN_TELEGRAM_IDS = parseTelegramIds(
  process.env.UFO_SUPERADMIN_TELEGRAM_ID || process.env.SUPERADMIN_TELEGRAM_IDS || ''
)

async function resolvePrimaryRestaurantId(): Promise<string> {
  const pinned = String(process.env.UFO_SINGLE_RESTAURANT_ID || '').trim()
  if (pinned) return pinned
  const first = await prisma.restaurant.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  return first?.id || 'default'
}

function verifyTelegramInitData(initData: string, botToken: string): { tgUser: any } | null {
  if (!initData || !botToken) return null
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) return null
  params.delete('hash')
  const dataCheckString = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n')
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest()
  const hmac = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex')
  if (hmac !== hash) return null
  try {
    const tgUser = JSON.parse(params.get('user') || '')
    return { tgUser }
  } catch {
    return null
  }
}

function readStartParam(initData: string, hdrs: ReadonlyHeaders): string {
  const fromHeader = String(hdrs.get('x-telegram-start-param') || '').trim()
  if (fromHeader) return fromHeader
  if (!initData) return ''
  try {
    return String(new URLSearchParams(initData).get('start_param') || '').trim()
  } catch {
    return ''
  }
}

export async function resolveApiUser(hdrs: ReadonlyHeaders): Promise<{
  userId?: string
  telegramId?: string
  name?: string
}> {
  const initData = String(hdrs.get('x-telegram-init-data') || '').trim()
  const rawStartParam = readStartParam(initData, hdrs)

  if (initData) {
    const envToken = String(process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '')
    const integration = rawStartParam
      ? await prisma.botIntegration.findUnique({
          where: { startParam: rawStartParam },
          select: { botToken: true },
        })
      : null
    const verified = verifyTelegramInitData(initData, String(integration?.botToken || envToken))
    if (verified?.tgUser?.id) {
      const tgFields = fieldsFromTelegramWebAppUser(verified.tgUser)
      const email = `tg_${tgFields.telegramId}@telegram.local`
      const name = tgFields.name
      const user = await prisma.user.upsert({
        where: { email },
        create: {
          email,
          name,
          passwordHash: crypto.randomBytes(32).toString('hex'),
          telegramId: tgFields.telegramId,
          telegramUsername: tgFields.telegramUsername,
          telegramFirstName: tgFields.telegramFirstName,
          telegramLastName: tgFields.telegramLastName,
          telegramPhotoUrl: tgFields.telegramPhotoUrl,
        },
        update: {
          name,
          telegramId: tgFields.telegramId,
          telegramUsername: tgFields.telegramUsername,
          telegramFirstName: tgFields.telegramFirstName,
          telegramLastName: tgFields.telegramLastName,
          telegramPhotoUrl: tgFields.telegramPhotoUrl,
        },
        select: { id: true },
      })
      const isFixedSuperadmin = SUPERADMIN_TELEGRAM_IDS.includes(tgFields.telegramId)
      if (isFixedSuperadmin) {
        const restaurantId = await resolvePrimaryRestaurantId()
        await prisma.user.update({
          where: { id: user.id },
          data: { role: 'SUPERADMIN', platformRole: 'SUPERADMIN' },
        }).catch(() => {})
        await prisma.restaurantMember.upsert({
          where: { restaurantId_userId: { restaurantId, userId: user.id } },
          create: { restaurantId, userId: user.id, role: 'OWNER' },
          update: { role: 'OWNER' },
          select: { id: true },
        }).catch(() => {})
      }
      void acceptPendingRestaurantInvites({ userId: user.id, telegramId: tgFields.telegramId }).catch(() => {})
      return { userId: user.id, telegramId: tgFields.telegramId, name }
    }
  }

  const session = await getServerSession(authOptions)
  if (session?.user?.id) {
    return {
      userId: session.user.id,
      telegramId: (session.user as any)?.telegramId ? String((session.user as any).telegramId) : undefined,
      name: session.user.name || undefined,
    }
  }
  return {}
}
