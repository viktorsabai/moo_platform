import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
})

function getSignature(req: Request): string {
  return req.headers.get('stripe-signature') || ''
}

export async function POST(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false, error: 'stripe_not_configured' }, { status: 503 })
  }
  const signature = getSignature(request)
  if (!signature) {
    return NextResponse.json({ ok: false, error: 'missing_signature' }, { status: 400 })
  }

  try {
    const body = await request.text()
    const event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET)

    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object as Stripe.PaymentIntent
      await prisma.order.updateMany({
        where: { paymentIntentId: intent.id },
        data: { paymentStatus: 'PAID' },
      })
    }

    if (event.type === 'payment_intent.payment_failed') {
      const intent = event.data.object as Stripe.PaymentIntent
      await prisma.order.updateMany({
        where: { paymentIntentId: intent.id },
        data: { paymentStatus: 'FAILED' },
      })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_webhook' }, { status: 400 })
  }
}
