import { NextResponse } from 'next/server'
import { runKitchenForDay } from '@/lib/subscription-kitchen'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Утренний запуск: по одному заказу на кухню на каждую доставку подписки сегодня. Vercel Cron шлёт Bearer CRON_SECRET. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  const r = await runKitchenForDay()
  return NextResponse.json({ ok: true, total: r.total, created: r.created, failed: r.failed })
}
