import { prisma } from '@/lib/prisma'

/** Строка шаблона плана — единый тип для API после устойчивой загрузки. */
export type SubscriptionPlanTemplateRow = {
  id: string
  name: string
  description: string | null
  coverImageUrl: string | null
  price: unknown
  plan: string
  planMode?: string | null
  pricingMode?: string | null
  menuDiscountPercent?: unknown
  availablePeriods?: number[]
  cycleDaysMin?: number | null
  cycleDaysMax?: number | null
  configuration?: unknown
  presetSlug: string | null
  allowedCategoryIds: string[]
  categoryLimits: unknown
  minDishesPerDelivery: number | null
  maxDishesPerDelivery: number | null
  minDaysPerWeek: number | null
  maxDaysPerWeek: number | null
  order?: number
  isActive?: boolean
}

function normalizeRow(r: Record<string, unknown>): SubscriptionPlanTemplateRow {
  return {
    id: String(r.id),
    name: String(r.name ?? ''),
    description: r.description != null ? String(r.description) : null,
    coverImageUrl: typeof r.coverImageUrl === 'string' ? r.coverImageUrl : null,
    price: r.price,
    plan: String(r.plan ?? 'WEEKLY'),
    planMode: r.planMode != null ? String(r.planMode) : null,
    pricingMode: r.pricingMode != null ? String(r.pricingMode) : null,
    menuDiscountPercent: r.menuDiscountPercent ?? null,
    availablePeriods: Array.isArray(r.availablePeriods) ? (r.availablePeriods as number[]) : [7, 14, 28],
    cycleDaysMin: typeof r.cycleDaysMin === 'number' ? r.cycleDaysMin : null,
    cycleDaysMax: typeof r.cycleDaysMax === 'number' ? r.cycleDaysMax : null,
    configuration: r.configuration ?? null,
    presetSlug: r.presetSlug != null ? String(r.presetSlug) : null,
    allowedCategoryIds: Array.isArray(r.allowedCategoryIds) ? (r.allowedCategoryIds as string[]) : [],
    categoryLimits: r.categoryLimits ?? null,
    minDishesPerDelivery: typeof r.minDishesPerDelivery === 'number' ? r.minDishesPerDelivery : null,
    maxDishesPerDelivery: typeof r.maxDishesPerDelivery === 'number' ? r.maxDishesPerDelivery : null,
    minDaysPerWeek: typeof r.minDaysPerWeek === 'number' ? r.minDaysPerWeek : null,
    maxDaysPerWeek: typeof r.maxDaysPerWeek === 'number' ? r.maxDaysPerWeek : null,
    order: typeof r.order === 'number' ? r.order : undefined,
    isActive: typeof r.isActive === 'boolean' ? r.isActive : undefined,
  }
}

type LoadOpts = {
  restaurantId: string
  /** true — только активные (витрина); false — все шаблоны (админка) */
  activeOnly: boolean
}

/**
 * Загрузка шаблонов с цепочкой SQL-fallback: прод без миграции (нет coverImageUrl / minDishes) не ломает API.
 */
export async function loadSubscriptionPlanTemplates(opts: LoadOpts): Promise<SubscriptionPlanTemplateRow[]> {
  const { restaurantId, activeOnly } = opts
  const where = activeOnly ? { restaurantId, isActive: true } : { restaurantId }

  try {
    const rows = await prisma.subscriptionPlanTemplate.findMany({
      where,
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        name: true,
        description: true,
        coverImageUrl: true,
        price: true,
        plan: true,
        planMode: true,
        pricingMode: true,
        menuDiscountPercent: true,
        availablePeriods: true,
        cycleDaysMin: true,
        cycleDaysMax: true,
        configuration: true,
        presetSlug: true,
        allowedCategoryIds: true,
        categoryLimits: true,
        minDishesPerDelivery: true,
        maxDishesPerDelivery: true,
        minDaysPerWeek: true,
        maxDaysPerWeek: true,
        ...(activeOnly ? {} : { order: true, isActive: true }),
      },
    })
    return rows.map((r) => normalizeRow(r as unknown as Record<string, unknown>))
  } catch {
    const activeSql = activeOnly ? ' AND "isActive" = true' : ''
    const queries = [
      `SELECT id, name, description, "coverImageUrl", price, plan, "planMode", "pricingMode", "menuDiscountPercent", "availablePeriods", "cycleDaysMin", "cycleDaysMax", configuration, "presetSlug", "allowedCategoryIds", "categoryLimits", "minDishesPerDelivery", "maxDishesPerDelivery", "minDaysPerWeek", "maxDaysPerWeek"${activeOnly ? '' : ', "order", "isActive"'} FROM "SubscriptionPlanTemplate" WHERE "restaurantId" = $1${activeSql} ORDER BY "order" ASC, "createdAt" ASC`,
      `SELECT id, name, description, price, plan, "presetSlug", "allowedCategoryIds", "categoryLimits", "minDishesPerDelivery", "maxDishesPerDelivery", "minDaysPerWeek", "maxDaysPerWeek"${activeOnly ? '' : ', "order", "isActive"'} FROM "SubscriptionPlanTemplate" WHERE "restaurantId" = $1${activeSql} ORDER BY "order" ASC, "createdAt" ASC`,
      `SELECT id, name, description, price, plan, "presetSlug", "allowedCategoryIds", "categoryLimits", "minDaysPerWeek", "maxDaysPerWeek"${activeOnly ? '' : ', "order", "isActive"'} FROM "SubscriptionPlanTemplate" WHERE "restaurantId" = $1${activeSql} ORDER BY "order" ASC, "createdAt" ASC`,
    ]

    let last: unknown
    for (const sql of queries) {
      try {
        const raw = (await prisma.$queryRawUnsafe(sql, restaurantId)) as Record<string, unknown>[]
        return (raw ?? []).map((r) =>
          normalizeRow({
            ...r,
            coverImageUrl: r.coverImageUrl ?? null,
            planMode: r.planMode ?? 'READY',
            pricingMode: r.pricingMode ?? 'FIXED',
            menuDiscountPercent: r.menuDiscountPercent ?? null,
            availablePeriods: r.availablePeriods ?? [7, 14, 28],
            cycleDaysMin: r.cycleDaysMin ?? null,
            cycleDaysMax: r.cycleDaysMax ?? null,
            configuration: r.configuration ?? null,
            minDishesPerDelivery: r.minDishesPerDelivery ?? null,
            maxDishesPerDelivery: r.maxDishesPerDelivery ?? null,
          })
        )
      } catch (e) {
        last = e
      }
    }
    throw last
  }
}
