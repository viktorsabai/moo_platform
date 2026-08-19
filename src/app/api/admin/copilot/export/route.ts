import { NextResponse } from 'next/server'
import { getRestaurantContext, requireRestaurantAdmin } from '@/lib/restaurant-context'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function csvCell(value: unknown) {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

export async function GET(request: Request) {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())
    const url = new URL(request.url)
    const days = Math.min(90, Math.max(1, Number(url.searchParams.get('days') || 7) || 7))
    const to = new Date()
    const from = new Date(to)
    from.setUTCDate(from.getUTCDate() - days)
    const orders = await prisma.order.findMany({
      where: { restaurantId: ctx.restaurantId, createdAt: { gte: from, lte: to } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        status: true,
        paymentStatus: true,
        fulfillmentMethod: true,
        itemsCount: true,
        totalAmount: true,
        discountAmount: true,
      },
    })
    const rows = [
      ['order_id', 'created_at_utc', 'status', 'payment_status', 'fulfillment_method', 'items_count', 'total_amount', 'discount_amount'],
      ...orders.map((order) => [
        order.id,
        order.createdAt.toISOString(),
        order.status,
        order.paymentStatus,
        order.fulfillmentMethod,
        order.itemsCount,
        Number(order.totalAmount),
        Number(order.discountAmount || 0),
      ]),
    ]
    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\n')}\n`
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="moo-owner-orders-${days}d.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error: unknown) {
    const status = Number((error as { statusCode?: number })?.statusCode || 500)
    return NextResponse.json({ ok: false, error: status === 403 ? 'forbidden' : 'failed' }, { status })
  }
}
