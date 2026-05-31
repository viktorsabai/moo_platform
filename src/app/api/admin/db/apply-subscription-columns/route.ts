import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRestaurantContext, requireRestaurantAdmin } from '@/lib/restaurant-context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Один раз вызови этот URL будучи залогиненным админом — в БД добавятся колонки
 * minDishesPerDelivery и maxDishesPerDelivery. После этого ЛК подписок и планы у юзера заработают.
 * GET /api/admin/db/apply-subscription-columns
 */
export async function GET() {
  try {
    requireRestaurantAdmin(await getRestaurantContext())

    await prisma.$executeRawUnsafe(
      'ALTER TABLE "SubscriptionPlanTemplate" ADD COLUMN IF NOT EXISTS "minDishesPerDelivery" INTEGER'
    )
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "SubscriptionPlanTemplate" ADD COLUMN IF NOT EXISTS "maxDishesPerDelivery" INTEGER'
    )

    return NextResponse.json({ ok: true, message: 'Колонки добавлены. Обнови страницу ЛК подписок.' })
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    return NextResponse.json(
      { ok: false, error: status === 403 ? 'Нет доступа' : String(e?.message || e) },
      { status }
    )
  }
}
