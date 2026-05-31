import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { resolveApiUser } from '@/lib/tg-auth-resolver'
import { getConsumerRestaurantId } from '@/lib/restaurant-context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_request: Request, ctx: { params: { orderId: string } }) {
  try {
    const authUser = await resolveApiUser(headers())
    const userId = authUser.userId
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'нужна авторизация' }, { status: 401 })
    }
    const restaurantId = await getConsumerRestaurantId()
    const { orderId } = ctx.params
    const order = await prisma.order.findFirst({
      where: { id: orderId, userId, restaurantId },
      select: {
        id: true,
        status: true,
        totalAmount: true,
        paymentStatus: true,
        paymentMethod: true,
        paymentOptionSlug: true,
        paymentAmountRub: true,
        fxRubPerThb: true,
        receiptUrl: true,
        receiptUploadedAt: true,
        createdAt: true,
        restaurant: { select: { name: true } },
      },
    })
    if (!order) {
      return NextResponse.json({ ok: false, error: 'не найден' }, { status: 404 })
    }
    return NextResponse.json({
      ok: true,
      order: {
        ...order,
        totalAmount: Number(order.totalAmount),
        paymentAmountRub: order.paymentAmountRub != null ? Number(order.paymentAmountRub) : null,
        fxRubPerThb: order.fxRubPerThb != null ? Number(order.fxRubPerThb) : null,
      },
    })
  } catch {
    return NextResponse.json({ ok: false, error: 'Ошибка' }, { status: 500 })
  }
}
