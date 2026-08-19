import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRestaurantContext, requireRestaurantAdmin } from '@/lib/restaurant-context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())
    const restaurantId = ctx.restaurantId
    const [settings, dishes, availableDishes, categories, zones, paymentMethods] = await Promise.all([
      prisma.appSettings.findUnique({
        where: { restaurantId },
        select: { menuEnabled: true, storeEnabled: true, subscriptionEnabled: true, openTime: true, closeTime: true, paymentMethodsJson: true },
      }),
      prisma.dish.count({ where: { restaurantId } }),
      prisma.dish.count({ where: { restaurantId, isAvailable: true } }),
      prisma.category.count({ where: { restaurantId, slug: { not: '__archive' } } }),
      prisma.$queryRawUnsafe<Array<{ count: number }>>(`SELECT COUNT(*)::int AS count FROM "DeliveryZone" WHERE "restaurantId" = $1 AND "isActive" = TRUE`, restaurantId),
      prisma.appSettings.findUnique({ where: { restaurantId }, select: { paymentMethodsJson: true } }),
    ])
    const paymentRows = Array.isArray((paymentMethods?.paymentMethodsJson as any)) ? (paymentMethods?.paymentMethodsJson as any[]) : []
    const enabledPaymentMethods = paymentRows.filter((row) => row && row.enabled).length
    const zoneCount = Math.max(0, Number((zones as Array<{ count: number }>)?.[0]?.count ?? 0))
    const checks = [
      { id: 'menu', label: 'Меню опубликовано', ok: Boolean(settings?.menuEnabled && categories > 0 && availableDishes > 0), href: '/admin/venue' },
      { id: 'catalog', label: 'Есть доступные блюда', ok: availableDishes > 0, href: '/admin/store' },
      { id: 'delivery', label: 'Настроена доставка', ok: zoneCount > 0, href: '/admin/venue?section=delivery' },
      { id: 'payment', label: 'Есть способ оплаты', ok: enabledPaymentMethods > 0, href: '/admin/venue?section=payments' },
      { id: 'hours', label: 'Заполнены часы работы', ok: Boolean(settings?.openTime && settings?.closeTime), href: '/admin/venue' },
    ]
    return NextResponse.json({
      ok: true,
      ready: checks.every((check) => check.ok),
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
      commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
      restaurantId,
      checks,
      summary: { dishes, availableDishes, categories, zones: zoneCount, enabledPaymentMethods },
    })
  } catch (error: any) {
    const status = Number(error?.statusCode || 500)
    return NextResponse.json({ ok: false, error: status === 403 ? 'forbidden' : 'Ошибка readiness' }, { status })
  }
}
