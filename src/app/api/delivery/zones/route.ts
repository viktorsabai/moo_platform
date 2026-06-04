import { NextResponse } from 'next/server'
import { getConsumerRestaurantId } from '@/lib/restaurant-context'
import { ensureMvpTables } from '@/lib/mvp-db'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Публичный список активных зон (для корзины / подсказок гостю). */
export async function GET() {
  try {
    await ensureMvpTables()
    const restaurantId = await getConsumerRestaurantId()
    const rows = await prisma.$queryRawUnsafe<
      Array<{ id: string; name: string; deliveryFee: number; minOrderAmount: number; deliveryWindowMin: number }>
    >(
      `SELECT "id","name","deliveryFee","minOrderAmount","deliveryWindowMin"
       FROM "DeliveryZone"
       WHERE "restaurantId"=$1 AND "isActive"=TRUE
       ORDER BY "sortOrder" ASC, "name" ASC`,
      restaurantId
    )
    return NextResponse.json({
      ok: true,
      count: rows.length,
      zones: rows.map((z) => ({
        id: z.id,
        name: z.name,
        deliveryFee: Math.max(0, Number(z.deliveryFee || 0)),
        freeFrom: Math.max(0, Number(z.minOrderAmount || 0)),
        deliveryWindowMin: Math.max(10, Number(z.deliveryWindowMin || 60)),
      })),
    })
  } catch {
    return NextResponse.json({ ok: false, error: 'Не удалось загрузить зоны' }, { status: 500 })
  }
}
