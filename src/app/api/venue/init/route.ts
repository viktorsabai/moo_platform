import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveSingleTenantRestaurantId } from '@/lib/restaurant-context'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function verifyTelegramInitData(initData: string, botToken: string): { startParam: string } | null {
  if (!initData || !botToken) return null
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) return null
  const startParam = String(params.get('start_param') || '').trim()
  params.delete('hash')
  const dataCheckString = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n')
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest()
  const hmac = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex')
  if (hmac !== hash) return null
  return { startParam }
}

/** Set ufo_restaurant cookie from Telegram initData (startParam → restaurant). Safe for pre-auth. */
export async function POST(request: Request) {
  try {
    const singleTenantRestaurantId = await resolveSingleTenantRestaurantId()
    if (singleTenantRestaurantId) {
      const pinned = await prisma.restaurant.findUnique({
        where: { id: singleTenantRestaurantId },
        select: { id: true, name: true },
      })
      if (pinned?.id) {
        const res = NextResponse.json({ ok: true, restaurantId: pinned.id, name: pinned.name ?? undefined })
        res.cookies.set('ufo_restaurant', pinned.id, {
          path: '/',
          maxAge: 60 * 60 * 24 * 365,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
        })
        return res
      }
    }

    const body = await request.json().catch(() => ({} as any))
    const initData = typeof body?.initData === 'string' ? body.initData.trim() : ''
    if (!initData) {
      return NextResponse.json({ ok: false, error: 'initData required' }, { status: 400 })
    }

    const rawStartParam = (() => {
      try {
        return String(new URLSearchParams(initData).get('start_param') || '').trim()
      } catch {
        return ''
      }
    })()

    const envToken = String(process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '')
    const integration = rawStartParam
      ? await prisma.botIntegration.findUnique({
          where: { startParam: rawStartParam },
          select: { restaurantId: true, botToken: true },
        })
      : null

    const verifyToken = String(integration?.botToken || envToken)
    const verified = verifyTelegramInitData(initData, verifyToken)
    const startParam = verified?.startParam || rawStartParam
    if (!startParam) return NextResponse.json({ ok: false, error: 'invalid initData' }, { status: 400 })

    let restaurantId: string | null = integration?.restaurantId ?? null
    if (!restaurantId) {
      const bot = await prisma.botIntegration.findUnique({
        where: { startParam },
        select: { restaurantId: true },
      })
      restaurantId = bot?.restaurantId ?? null
    }

    const exists = restaurantId
      ? await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { id: true, name: true } })
      : null
    if (!exists?.id) return NextResponse.json({ ok: false, error: 'venue not found' }, { status: 404 })

    const res = NextResponse.json({ ok: true, restaurantId: exists.id, name: exists.name ?? undefined })
    res.cookies.set('ufo_restaurant', exists.id, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    })
    return res
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: process.env.NODE_ENV === 'development' ? String(e?.message || e) : 'Ошибка' },
      { status: 500 }
    )
  }
}
