import { prisma } from '@/lib/prisma'

/** При первом входе в Mini App: принять все ожидающие приглашения по telegram id. */
export async function acceptPendingRestaurantInvites(params: { userId: string; telegramId: string }): Promise<number> {
  const tg = String(params.telegramId || '').trim()
  if (!tg || !params.userId) return 0

  const pending = await prisma.restaurantInvite.findMany({
    where: { invitedTelegramId: tg, status: 'PENDING' },
    select: { id: true, restaurantId: true, role: true },
  })
  if (!pending.length) return 0

  let accepted = 0
  for (const inv of pending) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.restaurantMember.upsert({
          where: { restaurantId_userId: { restaurantId: inv.restaurantId, userId: params.userId } },
          create: { restaurantId: inv.restaurantId, userId: params.userId, role: inv.role },
          update: { role: inv.role },
        })
        await tx.restaurantInvite.update({
          where: { id: inv.id },
          data: { status: 'ACCEPTED', resolvedAt: new Date() },
        })
      })
      accepted += 1
    } catch {
      // ignore single invite failure
    }
  }
  return accepted
}
