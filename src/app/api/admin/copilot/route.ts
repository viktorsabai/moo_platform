import { NextResponse } from 'next/server'
import { getRestaurantContext, requireRestaurantAdmin } from '@/lib/restaurant-context'
import { prisma } from '@/lib/prisma'
import { getAdminStats } from '@/lib/admin-stats'
import { DEFAULT_SUBSCRIPTION_PLANS } from '@/lib/subscription-plans'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Intent = 'advice' | 'subscription_plan' | 'weekly_export'

function detectIntent(prompt: string): Intent {
  const value = prompt.toLowerCase()
  if (value.includes('выгруз') || value.includes('отчёт') || value.includes('отчет') || value.includes('информац')) return 'weekly_export'
  if (value.includes('подпис') || value.includes('рацион') || value.includes('план питания')) return 'subscription_plan'
  return 'advice'
}

async function optionalAiSummary(context: Record<string, unknown>, prompt: string): Promise<string | null> {
  const base = String(process.env.BUILT_IN_FORGE_API_URL || '').replace(/\/$/, '')
  const key = String(process.env.BUILT_IN_FORGE_API_KEY || '').trim()
  if (!base || !key) return null
  try {
    const response = await fetch(`${base}/v1/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.MOO_COPILOT_MODEL || 'gpt-5-mini',
        messages: [
          {
            role: 'system',
            content: 'Ты MOO Copilot для владельца ресторана. Отвечай по-русски, коротко, конкретно и только на основе переданного контекста. Не придумывай цифры. Не обещай автоматические изменения без подтверждения владельца.',
          },
          { role: 'user', content: `Запрос владельца: ${prompt}\nКонтекст: ${JSON.stringify(context)}` },
        ],
        max_completion_tokens: 420,
      }),
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) return null
    const json = await response.json().catch(() => null)
    const text = String(json?.choices?.[0]?.message?.content || '').trim()
    return text || null
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())
    const body = await request.json().catch(() => ({} as Record<string, unknown>))
    const prompt = String(body.prompt || '').trim()
    const intent = detectIntent(prompt)
    const days = Math.min(90, Math.max(1, Number(body.days || 7) || 7))
    const stats = await getAdminStats(ctx.restaurantId)

    const [dishCount, categoryCount, activeSubscriptions, pendingLeads] = await Promise.all([
      prisma.dish.count({ where: { restaurantId: ctx.restaurantId, isAvailable: true } }),
      prisma.category.count({ where: { restaurantId: ctx.restaurantId } }),
      prisma.subscription.count({ where: { restaurantId: ctx.restaurantId, status: 'ACTIVE' } }),
      prisma.serviceLead.count({ where: { restaurantId: ctx.restaurantId, status: 'NEW' } }),
    ])

    const context = {
      restaurantId: ctx.restaurantId,
      period: 'last7d',
      orders: stats.kpis.last7d.orders,
      revenue: stats.kpis.last7d.revenue,
      averageOrderValue: stats.kpis.last7d.averageOrderValue,
      cancelledOrders: stats.kpis.cancelledOrdersLast7d,
      availableDishes: dishCount,
      categories: categoryCount,
      activeSubscriptions,
      newLeads: pendingLeads,
    }

    if (intent === 'weekly_export') {
      return NextResponse.json({
        ok: true,
        intent,
        mode: 'deterministic',
        answer: `Подготовил выгрузку за последние ${days} дней. В ней будут заказы, статусы, суммы и способ получения — без персональных данных гостя.`,
        downloadUrl: `/api/admin/copilot/export?days=${days}`,
        context,
      })
    }

    if (intent === 'subscription_plan') {
      const preset = DEFAULT_SUBSCRIPTION_PLANS.find((item) => item.slug === String(body.preset || 'standard')) || DEFAULT_SUBSCRIPTION_PLANS[0]
      const recommendation = {
        presetSlug: preset.slug,
        name: preset.name,
        targetAudience: preset.targetAudience,
        daysPerWeek: `${preset.rules.minDaysPerWeek}–${preset.rules.maxDaysPerWeek}`,
        dishesPerDelivery: `${preset.rules.minDishesPerDelivery}–${preset.rules.maxDishesPerDelivery}`,
        reason: `Базовый draft на основе пресета ${preset.name}. Перед публикацией нужно проверить доступность категорий и себестоимость блюд.`,
      }
      const ai = await optionalAiSummary({ ...context, recommendation }, prompt)
      return NextResponse.json({
        ok: true,
        intent,
        mode: ai ? 'ai' : 'deterministic',
        answer: ai || `Собрал черновик «${preset.name}»: ${recommendation.daysPerWeek} доставки в неделю, ${recommendation.dishesPerDelivery} блюда на доставку. Это draft — он не опубликован и не меняет текущие планы.`,
        planDraft: recommendation,
        action: { label: 'Открыть конструктор подписки', href: '/admin/subscriptions/plans' },
        context,
      })
    }

    const recommendations = [
      stats.kpis.last7d.orders === 0 ? 'Заказов за 7 дней нет — проверьте, что меню опубликовано и Telegram CTA ведёт в актуальную витрину.' : null,
      stats.kpis.cancelledOrdersLast7d > 0 ? `${stats.kpis.cancelledOrdersLast7d} отмен за 7 дней — стоит проверить причины и время подтверждения.` : null,
      activeSubscriptions === 0 ? 'Активных подписок пока нет — можно собрать первый draft плана из конструктора.' : null,
      pendingLeads > 0 ? `${pendingLeads} новых заявок ждут ответа — это самый быстрый операционный приоритет.` : null,
    ].filter(Boolean)
    const ai = await optionalAiSummary({ ...context, recommendations }, prompt)
    return NextResponse.json({
      ok: true,
      intent,
      mode: ai ? 'ai' : 'deterministic',
      answer: ai || (recommendations.length ? 'Вот что сейчас требует внимания:' : 'Срочных сигналов не вижу: каталог, заказы и подписки выглядят стабильно.'),
      recommendations,
      context,
    })
  } catch (error: unknown) {
    const status = Number((error as { statusCode?: number })?.statusCode || 500)
    return NextResponse.json({ ok: false, error: status === 403 ? 'forbidden' : 'failed' }, { status })
  }
}
