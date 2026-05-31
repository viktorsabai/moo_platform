// API Route: POST /api/payment/intent - создание платежного интента
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { getConsumerRestaurantId } from '@/lib/restaurant-context'
import { computeTrustedItemsAndSubtotal } from '@/lib/order-pricing'
import { resolveApiUser } from '@/lib/tg-auth-resolver'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
})

export async function POST(request: Request) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ ok: false, error: 'stripe_not_configured' }, { status: 503 })
    }
    const authUser = await resolveApiUser(headers())
    if (!authUser.userId) {
      return NextResponse.json(
        { ok: false, error: 'Необходима авторизация (Telegram или сессия)' },
        { status: 401 }
      )
    }

    const body = await request.json().catch(() => ({} as any))
    const restaurantId = await getConsumerRestaurantId()
    const rawItems = Array.isArray(body?.items) ? body.items : []
    const deliveryFee = Math.max(0, Number(body?.deliveryFee ?? 0))
    const { items, subtotal } = await computeTrustedItemsAndSubtotal(restaurantId, rawItems)
    if (!items.length) {
      return NextResponse.json({ ok: false, error: 'empty_items' }, { status: 400 })
    }
    const amount = Math.round((subtotal + deliveryFee) * 100)
    if (amount <= 0) {
      return NextResponse.json({ ok: false, error: 'invalid_amount' }, { status: 400 })
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'thb',
      automatic_payment_methods: { enabled: true },
      metadata: {
        userId: authUser.userId,
        restaurantId,
      },
    })

    return NextResponse.json({
      ok: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      totalAmount: subtotal + deliveryFee,
      subtotal,
      deliveryFee,
    })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: 'Ошибка при создании платежа' },
      { status: 500 }
    )
  }
}







