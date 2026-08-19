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

  let event: Stripe.Event
  try {
    const body = await request.text()
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET)
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_webhook' }, { status: 400 })
  }

  try {
    await prisma.webhookEvent.create({
      data: { provider: 'stripe', eventId: event.id, eventType: event.type },
    })
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ ok: true, replaySafe: true, duplicate: true, eventId: event.id })
    }
    console.error('[payment/webhook] ledger reservation failed', { eventId: event.id, error })
    return NextResponse.json({ ok: false, error: 'webhook_ledger_unavailable' }, { status: 503 })
  }

  try {
    let updatedOrders = 0
    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object as Stripe.PaymentIntent
      const result = await prisma.order.updateMany({
        where: { paymentIntentId: intent.id, paymentStatus: { not: 'PAID' } },
        data: { paymentStatus: 'PAID' },
      })
      updatedOrders = result.count
    }

    if (event.type === 'payment_intent.payment_failed') {
      const intent = event.data.object as Stripe.PaymentIntent
      const result = await prisma.order.updateMany({
        where: { paymentIntentId: intent.id, paymentStatus: { not: 'FAILED' } },
        data: { paymentStatus: 'FAILED' },
      })
      updatedOrders = result.count
    }

    await prisma.webhookEvent.update({
      where: { provider_eventId: { provider: 'stripe', eventId: event.id } },
      data: { status: 'PROCESSED', processedAt: new Date(), error: null },
    })

    return NextResponse.json({ ok: true, replaySafe: true, duplicate: false, updatedOrders })
  } catch (error) {
    await prisma.webhookEvent.updateMany({
      where: { provider: 'stripe', eventId: event.id },
      data: { status: 'FAILED', error: error instanceof Error ? error.message.slice(0, 1000) : 'processing_failed' },
    }).catch((ledgerError) => console.error('[payment/webhook] failed to mark event', { eventId: event.id, ledgerError }))
    console.error('[payment/webhook] processing failed', { eventId: event.id, type: event.type, error })
    return NextResponse.json({ ok: false, error: 'webhook_processing_failed' }, { status: 500 })
  }
}
