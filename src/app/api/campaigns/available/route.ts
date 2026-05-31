import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { getConsumerRestaurantId } from '@/lib/restaurant-context'
import { resolveApiUser } from '@/lib/tg-auth-resolver'
import { evaluateCampaign } from '@/lib/campaigns'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const authUser = await resolveApiUser(headers())
    const userId = authUser.userId
    if (!userId) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    const restaurantId = await getConsumerRestaurantId()

    const [campaigns, userOrdersCount, redemptions] = await Promise.all([
      prisma.campaign.findMany({
        where: {
          restaurantId,
          status: 'ACTIVE',
          OR: [{ visibility: 'PUBLIC' }, { visibility: 'ASSIGNED_ONLY' }],
        },
        orderBy: [{ createdAt: 'desc' }],
      }),
      prisma.order.count({ where: { userId, restaurantId } }),
      prisma.campaignRedemption.findMany({
        where: { userId, restaurantId },
        select: { campaignId: true },
      }),
    ])
    const usedMap = redemptions.reduce<Record<string, number>>((acc, x) => {
      acc[x.campaignId] = (acc[x.campaignId] || 0) + 1
      return acc
    }, {})

    const accepted = campaigns
      .map((c) =>
        evaluateCampaign(c, {
          userId,
          userTelegramId: authUser.telegramId,
          subtotal: 1,
          deliveryFee: 0,
          items: [],
          userOrdersCount,
          userUsedCountByCampaignId: usedMap,
          promoListing: true,
        })
      )
      .filter((x) => x.ok)
      .map((x) => ({
        id: x.campaign?.id,
        name: x.campaign?.name,
        code: x.campaign?.code,
        visibility: x.campaign?.visibility,
        targetType: x.campaign?.targetType,
        rewardType: x.campaign?.rewardType,
        rewardValue: x.campaign?.rewardValue,
        rewardCap: x.campaign?.rewardCap,
        giftTitle: x.campaign?.giftTitle,
        validTo: x.campaign?.validTo,
        details: x.details,
      }))

    return NextResponse.json({ ok: true, campaigns: accepted })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || 'Ошибка') }, { status: 500 })
  }
}
