import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { getConsumerRestaurantId } from '@/lib/restaurant-context'
import { resolveApiUser } from '@/lib/tg-auth-resolver'
import { evaluateCampaign, giftDishIdFromPayload, parseCampaignCode, pickBestCampaign } from '@/lib/campaigns'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const authUser = await resolveApiUser(headers())
    const userId = authUser.userId
    if (!userId) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    const restaurantId = await getConsumerRestaurantId()
    const body = await request.json().catch(() => ({} as any))
    const code = parseCampaignCode(body?.code)
    const campaignId = typeof body?.campaignId === 'string' ? body.campaignId.trim() : ''
    const subtotal = Math.max(0, Number(body?.subtotal ?? 0))
    const deliveryFee = Math.max(0, Number(body?.deliveryFee ?? 0))
    const items = Array.isArray(body?.items) ? body.items : []

    if (!code && !campaignId) {
      return NextResponse.json({
        ok: true,
        campaign: null,
        discountAmount: 0,
        totalBefore: subtotal + deliveryFee,
        totalAfter: subtotal + deliveryFee,
        finalSubtotal: subtotal,
        finalDeliveryFee: deliveryFee,
        gift: null,
        giftDishId: null,
        details: {},
      })
    }

    const [campaigns, userOrdersCount, redemptions] = await Promise.all([
      campaignId
        ? prisma.campaign.findMany({
            where: {
              id: campaignId,
              restaurantId,
              status: 'ACTIVE',
              visibility: { in: ['PUBLIC', 'ASSIGNED_ONLY'] },
            },
          })
        : prisma.campaign.findMany({
            where: {
              restaurantId,
              status: 'ACTIVE',
              code: { equals: code, mode: 'insensitive' },
            },
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

    const ctxBase = {
      userId,
      userTelegramId: authUser.telegramId,
      code,
      subtotal,
      deliveryFee,
      items,
      userOrdersCount,
      userUsedCountByCampaignId: usedMap,
    }

    if (campaignId && campaigns.length === 0) {
      return NextResponse.json({ ok: false, reason: 'not_found' }, { status: 404 })
    }

    const result =
      campaignId && campaigns.length === 1
        ? evaluateCampaign(campaigns[0], ctxBase)
        : pickBestCampaign(campaigns, ctxBase)

    if (!result.ok) {
      return NextResponse.json({ ok: false, reason: result.reason || 'not_applicable' }, { status: 400 })
    }

    const giftPayload = result.gift?.payload ?? null
    const giftDishId = giftDishIdFromPayload(giftPayload)

    return NextResponse.json({
      ok: true,
      campaign: result.campaign
        ? {
            id: result.campaign.id,
            name: result.campaign.name,
            code: result.campaign.code,
            rewardType: result.campaign.rewardType,
            targetType: result.campaign.targetType,
            giftTitle: result.campaign.giftTitle,
          }
        : null,
      discountAmount: result.discountAmount,
      totalBefore: subtotal + deliveryFee,
      totalAfter: result.finalTotal,
      finalSubtotal: result.finalSubtotal,
      finalDeliveryFee: result.finalDeliveryFee,
      gift: result.gift || null,
      giftDishId: giftDishId || null,
      details: result.details,
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || 'Ошибка') }, { status: 500 })
  }
}
