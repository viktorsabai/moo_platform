import { NextResponse } from 'next/server'
import { DEFAULT_SUBSCRIPTION_PLANS } from '@/lib/subscription-plans'
import { requireRestaurantAdmin, getRestaurantContext } from '@/lib/restaurant-context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Returns default plan presets (Standard, Fit, Family) for owner to choose when creating a plan. */
export async function GET() {
  try {
    requireRestaurantAdmin(await getRestaurantContext())

    const presets = DEFAULT_SUBSCRIPTION_PLANS.map((p) => ({
      slug: p.slug,
      name: p.name,
      description: p.description,
      targetAudience: p.targetAudience,
      rules: p.rules,
    }))

    return NextResponse.json({ ok: true, presets })
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    return NextResponse.json({ ok: false, error: status === 403 ? 'forbidden' : 'Ошибка' }, { status })
  }
}
