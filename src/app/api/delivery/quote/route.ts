import { NextResponse } from 'next/server'
import { getConsumerRestaurantId } from '@/lib/restaurant-context'
import { resolveDeliveryQuote } from '@/lib/delivery-quote'
import { ensureMvpTables } from '@/lib/mvp-db'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    await ensureMvpTables()
    const { searchParams } = new URL(request.url)
    const restaurantId = await getConsumerRestaurantId()
    const subtotal = Math.max(0, Number(searchParams.get('subtotal') || 0))

    const zones = await prisma.$queryRawUnsafe<
      Array<{
        id: string
        name: string
        polygonJson: string | null
        keywords: string[] | null
        zipCodes: string[] | null
        deliveryFee: number
        minOrderAmount: number
        deliveryWindowMin: number
        sortOrder: number
      }>
    >(
      `SELECT "id","name","polygonJson","keywords","zipCodes","deliveryFee","minOrderAmount","deliveryWindowMin","sortOrder"
       FROM "DeliveryZone"
       WHERE "restaurantId"=$1 AND "isActive"=TRUE
       ORDER BY "sortOrder" ASC, "createdAt" ASC`,
      restaurantId
    )

    const quote = resolveDeliveryQuote(zones, {
      address: searchParams.get('address') || '',
      city: searchParams.get('city') || '',
      zipCode: searchParams.get('zipCode') || '',
      lat: Number(searchParams.get('lat') || NaN),
      lng: Number(searchParams.get('lng') || NaN),
      subtotal,
    })

    if (!quote.matched) {
      if (quote.reason === 'no_zone') {
        console.warn('[delivery/quote] no zone matched', {
          restaurantId,
          zonesCount: zones.length,
          districtId: quote.district?.id ?? null,
        })
      }
      return NextResponse.json({ ok: true, matched: false, reason: quote.reason, message: quote.message, district: quote.district ?? null })
    }

    return NextResponse.json({ ok: true, matched: true, zone: quote.zone })
  } catch {
    return NextResponse.json({ ok: false, error: 'Не удалось рассчитать доставку. Попробуйте позже.' }, { status: 500 })
  }
}
