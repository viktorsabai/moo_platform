import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRestaurantContext, requireRestaurantAdmin } from '@/lib/restaurant-context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function toDate(value: string | null, fallback: Date) {
  if (!value) return fallback
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? fallback : parsed
}

export async function GET(request: Request) {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())
    const url = new URL(request.url)
    const now = new Date()
    const fromFallback = new Date(now)
    fromFallback.setUTCDate(fromFallback.getUTCDate() - 30)
    const from = toDate(url.searchParams.get('from'), fromFallback)
    const to = toDate(url.searchParams.get('to'), now)
    const redemptions = await prisma.campaignRedemption.findMany({
      where: { restaurantId: ctx.restaurantId, createdAt: { gte: from, lte: to } },
      select: {
        campaignId: true,
        discountAmount: true,
        status: true,
        campaign: { select: { name: true, code: true, kind: true } },
        order: {
          select: {
            totalAmount: true,
            status: true,
            items: { select: { quantity: true, dish: { select: { costPrice: true } } } },
          },
        },
      },
    })
    const grouped = new Map<string, { name: string; code: string | null; kind: string; applied: number; reversed: number; discount: number; gross: number; cost: number }>()
    for (const redemption of redemptions) {
      const key = redemption.campaignId
      const row = grouped.get(key) ?? { name: redemption.campaign.name, code: redemption.campaign.code, kind: redemption.campaign.kind, applied: 0, reversed: 0, discount: 0, gross: 0, cost: 0 }
      if (redemption.status === 'REVERSED') {
        row.reversed += 1
        grouped.set(key, row)
        continue
      }
      row.applied += 1
      row.discount += Number(redemption.discountAmount)
      if (redemption.order.status !== 'CANCELLED') {
        row.gross += Number(redemption.order.totalAmount)
        row.cost += redemption.order.items.reduce((sum, item) => {
          const unitCost = item.dish?.costPrice ?? 0
          return sum + Number(unitCost) * item.quantity
        }, 0)
      }
      grouped.set(key, row)
    }
    const campaigns = [...grouped.entries()].map(([campaignId, row]) => {
      const netRevenue = Math.max(0, row.gross)
      const contribution = netRevenue - row.cost
      return {
        campaignId,
        ...row,
        grossRevenue: Number(row.gross.toFixed(2)),
        discountAmount: Number(row.discount.toFixed(2)),
        estimatedCost: Number(row.cost.toFixed(2)),
        netRevenue: Number(netRevenue.toFixed(2)),
        contribution: Number(contribution.toFixed(2)),
        contributionMarginPercent: netRevenue > 0 ? Number(((contribution / netRevenue) * 100).toFixed(1)) : null,
      }
    }).sort((a, b) => b.contribution - a.contribution)
    return NextResponse.json({ ok: true, period: { from: from.toISOString(), to: to.toISOString(), timezone: 'UTC' }, campaigns, definitions: { grossRevenue: 'Сумма неотменённых заказов с применённой акцией', discountAmount: 'Сумма скидок по applied redemption', estimatedCost: 'Себестоимость по заполненным costPrice блюд/вариантов', contribution: 'netRevenue минус estimatedCost' } })
  } catch (error: any) {
    const status = Number(error?.statusCode || 500)
    return NextResponse.json({ ok: false, error: status === 403 ? 'forbidden' : 'Ошибка отчёта по акциям' }, { status })
  }
}
