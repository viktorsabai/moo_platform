import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getConsumerRestaurantId } from '@/lib/restaurant-context'
import { getPlanRules } from '@/lib/subscription-plan-rules'
import { loadSubscriptionPlanTemplates } from '@/lib/subscription-plan-templates-load'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const LOG_PATH = process.cwd() + '/.cursor/debug.log'
function debugLog(msg: string, data: Record<string, unknown>) {
  try {
    require('fs').appendFileSync(LOG_PATH, JSON.stringify({ location: 'subscriptions/plans', message: msg, data, ts: Date.now() }) + '\n')
  } catch {}
}

/** Публичный список активных шаблонов планов подписки для текущего ресторана (для визарда). Правила плана разрешаются через getPlanRules — единый источник с POST/PATCH подписок. */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const debug = url.searchParams.get('_debug') === '1'
  try {
    const restaurantId = await getConsumerRestaurantId()
    debugLog('entry', { restaurantId })

    const settings = await prisma.appSettings.findUnique({
      where: { restaurantId },
      select: { subscriptionEnabled: true },
    })
    const subEnabled = !!settings?.subscriptionEnabled
    if (!subEnabled) {
      debugLog('subDisabled', { restaurantId, subscriptionEnabled: subEnabled })
      const body: Record<string, unknown> = {
        ok: true,
        plans: [],
        reason: 'subscription_disabled',
      }
      if (debug) body._debug = { restaurantId, subscriptionEnabled: false }
      return NextResponse.json(body)
    }

    const categories = await prisma.category.findMany({
      where: { restaurantId },
      select: { id: true, slug: true },
    })

    const plans = await loadSubscriptionPlanTemplates({ restaurantId, activeOnly: true })

    debugLog('success', { restaurantId, plansCount: plans.length })

    const body: Record<string, unknown> = {
      ok: true,
      plans: plans.map((p) => {
        const rules = getPlanRules(p, categories)
        return {
          ...p,
          price: Number(p.price),
          planMode: p.planMode ?? 'READY',
          pricingMode: p.pricingMode ?? 'FIXED',
          menuDiscountPercent: p.menuDiscountPercent == null ? null : Number(p.menuDiscountPercent),
          availablePeriods: Array.isArray(p.availablePeriods) ? p.availablePeriods : [7, 14, 28],
          cycleDaysMin: p.cycleDaysMin ?? null,
          cycleDaysMax: p.cycleDaysMax ?? null,
          configuration: p.configuration ?? null,
          categoryLimits: p.categoryLimits ? (typeof p.categoryLimits === 'object' ? p.categoryLimits : null) : null,
          rules: {
            allowedCategoryIds: Array.from(rules.allowedCategoryIds),
            categoryLimits: rules.categoryLimits,
            minDishesPerDelivery: rules.minDishesPerDelivery,
            maxDishesPerDelivery: rules.maxDishesPerDelivery,
            minDaysPerWeek: rules.minDaysPerWeek,
            maxDaysPerWeek: rules.maxDaysPerWeek,
          },
        }
      }),
    }
    if (debug) body._debug = { restaurantId, plansCount: plans.length }
    return NextResponse.json(body)
  } catch (e: any) {
    debugLog('catch', { errMsg: String(e?.message || e) })
    const body: Record<string, unknown> = { ok: false, plans: [] }
    if (debug) body._debug = { error: String(e?.message || e) }
    return NextResponse.json(body, { status: 500 })
  }
}
