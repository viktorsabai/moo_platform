import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getRestaurantContext, requireRestaurantAdmin } from '@/lib/restaurant-context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const DEFAULT_SINGLE_TENANT_RESTAURANT_ID = 'cmoibd1en000cx2i9pt9gp2hr'
const SINGLE_TENANT_RESTAURANT_ID =
  String(process.env.UFO_SINGLE_RESTAURANT_ID || DEFAULT_SINGLE_TENANT_RESTAURANT_ID).trim()
const PATCH_TX_MAX_WAIT_MS = 2500
const PATCH_TX_TIMEOUT_MS = 8000
const PATCH_RETRY_DELAY_MS = 250

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRetryablePrismaError(err: any) {
  const code = String(err?.code || '')
  const msg = String(err?.message || '').toLowerCase()
  return (
    code === 'P1001' ||
    code === 'P2024' ||
    msg.includes('too many connections') ||
    msg.includes('can\'t reach database server') ||
    msg.includes('timeout')
  )
}

function isMissingWeightLabelColumn(err: any) {
  const code = String(err?.code || '')
  const msg = String(err?.message || '').toLowerCase()
  const metaColumn = String(err?.meta?.column || '').toLowerCase()
  return (
    code === 'P2022' &&
    (metaColumn.includes('weightlabel') ||
      msg.includes('weightlabel') ||
      msg.includes('weight label'))
  )
}

let weightLabelColumnChecked = false
async function ensureWeightLabelColumn() {
  if (weightLabelColumnChecked) return
  try {
    await prisma.$executeRawUnsafe('ALTER TABLE "Dish" ADD COLUMN IF NOT EXISTS "weightLabel" TEXT')
  } catch {
    // keep backward-compatible behavior if DB role cannot alter schema
  } finally {
    weightLabelColumnChecked = true
  }
}

function serializeDish(d: any) {
  return {
    ...d,
    price: Number(d.price),
    costPrice: d.costPrice == null ? null : Number(d.costPrice),
    modifiers: (d.modifiers || []).map((m: any) => ({ ...m, priceAdjust: Number(m.priceAdjust) })),
    optionValues: (d.optionValues || []).map((ov: any) => ({
      ...ov,
      priceAdjust: Number(ov.priceAdjust),
    })),
  }
}

async function hydrateDishOptionValues(restaurantId: string, dishes: any[]) {
  const dishIds = (dishes || []).map((d: any) => String(d?.id || '')).filter(Boolean)
  if (dishIds.length === 0) return dishes
  const needHydration = dishes.some((d: any) => !Array.isArray(d?.optionValues))
  if (!needHydration) return dishes

  const baseSelect = {
    dishId: true,
    priceAdjust: true,
    order: true,
    isAvailable: true,
    optionValue: {
      select: {
        id: true,
        name: true,
        group: { select: { id: true, name: true, order: true } },
      },
    },
  } as const
  const withImageSelect = {
    dishId: true,
    priceAdjust: true,
    order: true,
    isAvailable: true,
    optionValue: {
      select: {
        id: true,
        name: true,
        subscriptionImageUrl: true,
        group: { select: { id: true, name: true, order: true } },
      },
    },
  } as const

  let links: any[] = []
  try {
    links = await prisma.dishOptionValue.findMany({
      where: { restaurantId, dishId: { in: dishIds } },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      select: withImageSelect as any,
    })
  } catch {
    links = await prisma.dishOptionValue.findMany({
      where: { restaurantId, dishId: { in: dishIds } },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      select: baseSelect as any,
    })
  }

  const byDish = new Map<string, any[]>()
  for (const row of links) {
    const key = String(row.dishId)
    const arr = byDish.get(key) ?? []
    arr.push(row)
    byDish.set(key, arr)
  }
  return dishes.map((d: any) => ({
    ...d,
    optionValues: Array.isArray(d?.optionValues) ? d.optionValues : (byDish.get(String(d.id)) ?? []),
  }))
}

export async function GET() {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())

    const dishFields = {
      id: true,
      name: true,
      slug: true,
      emoji: true,
      description: true,
      price: true,
      costPrice: true,
      image: true,
      categoryId: true,
      isAvailable: true,
      calories: true,
      tags: true,
      prepTimeMinutes: true,
      subscriptionEligible: true,
      maxOrderQuantity: true,
      category: { select: { id: true, name: true } },
    }
    const modOrder = [{ order: 'asc' as const }, { createdAt: 'asc' as const }]
    const modifiersLegacy = {
      orderBy: modOrder,
      select: { id: true, name: true, type: true, priceAdjust: true, order: true },
    }
    const optionGroupSelect = { select: { id: true, name: true, order: true } as const }
    // В ЛК показываем все привязки, даже если группа/значение скрыты в справочнике — иначе чипы «исчезают».
    const adminOptionValues = (includeValueImage: boolean) => ({
      optionValues: {
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          priceAdjust: true,
          order: true,
          isAvailable: true,
          optionValue: {
            select: includeValueImage
              ? {
                  id: true,
                  name: true,
                  subscriptionImageUrl: true,
                  group: optionGroupSelect,
                }
              : {
                  id: true,
                  name: true,
                  group: optionGroupSelect,
                },
          },
        },
      },
    })
    const selectAttempts: any[] = []
    for (const modifiers of [modifiersLegacy]) {
      for (const includeValueImage of [true, false]) {
        const core = { ...dishFields, modifiers }
        const withWeight = { ...core, weightLabel: true }
        const ov = adminOptionValues(includeValueImage)
        selectAttempts.push({ ...withWeight, ...ov }, { ...core, ...ov }, withWeight, core)
      }
    }
    let dishes: any[] | null = null
    let lastError: unknown
    for (const select of selectAttempts) {
      try {
        dishes = await prisma.dish.findMany({
          where: { restaurantId: ctx.restaurantId },
          orderBy: [{ createdAt: 'desc' }],
          select: select as any,
        })
        lastError = undefined
        break
      } catch (e) {
        lastError = e
      }
    }
    if (!dishes && lastError) throw lastError
    if (!dishes) dishes = []
    dishes = await hydrateDishOptionValues(ctx.restaurantId, dishes)

    return NextResponse.json({
      ok: true,
      dishes: dishes.map(serializeDish),
    })
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    return NextResponse.json({ ok: false, error: status === 403 ? 'forbidden' : 'Ошибка' }, { status })
  }
}

export async function POST(request: Request) {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())

    const body = await request.json().catch(() => ({} as any))
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    let slug = typeof body?.slug === 'string' ? body.slug.trim().toLowerCase().replace(/\s+/g, '-') : ''
    if (!slug && name) {
      slug = name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9а-яё-]/gi, (c: string) => {
          const m: Record<string, string> = {
            а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
            и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
            с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
            ы: 'y', э: 'e', ю: 'yu', я: 'ya',
          }
          return m[c.toLowerCase()] ?? ''
        })
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'dish'
    }
    const description = typeof body?.description === 'string' ? body.description.trim() : null
    const weightLabel = typeof body?.weightLabel === 'string' ? body.weightLabel.trim().slice(0, 120) : null
    const priceRaw = Number(body?.price ?? 0)
    const price = Number.isFinite(priceRaw) ? priceRaw : 0
    const costPriceRaw = body?.costPrice
    const costPrice = costPriceRaw === null || typeof costPriceRaw === 'undefined'
      ? null
      : Number(costPriceRaw)
    const categoryId = typeof body?.categoryId === 'string' ? body.categoryId : ''
    const isAvailable = body?.isAvailable !== false
    const tagsRaw = body?.tags
    const tags = Array.isArray(tagsRaw)
      ? tagsRaw.filter((t: unknown) => typeof t === 'string').slice(0, 8)
      : []
    const subscriptionEligible = body?.subscriptionEligible !== false
    const emojiRaw = typeof body?.emoji === 'string' ? body.emoji.trim().slice(0, 8) : ''
    const emojiSanitized = emojiRaw ? emojiRaw : null
    const imageRaw = typeof body?.image === 'string' ? body.image.trim() : ''
    const imageSanitized = imageRaw ? imageRaw : null

    if (!name || !categoryId) {
      return NextResponse.json({ ok: false, error: 'Название и категория обязательны' }, { status: 400 })
    }

    const cat = await prisma.category.findFirst({
      where: { id: categoryId, restaurantId: ctx.restaurantId },
      select: { id: true, prepTimeMinutes: true, maxOrderQuantity: true },
    })
    if (!cat?.id) {
      return NextResponse.json({ ok: false, error: 'категория не найдена' }, { status: 400 })
    }

    const createData: Record<string, unknown> = {
      restaurantId: ctx.restaurantId,
      name,
      slug: slug || name.toLowerCase().replace(/\s+/g, '-'),
      emoji: emojiSanitized || undefined,
      image: imageSanitized || undefined,
      description: description || undefined,
      weightLabel: weightLabel || undefined,
      price: new Prisma.Decimal(String(price)),
      costPrice:
        costPrice !== null && Number.isFinite(costPrice) && costPrice > 0
          ? new Prisma.Decimal(String(costPrice))
          : null,
      categoryId,
      isAvailable,
      tags: tags.length > 0 ? tags : undefined,
      prepTimeMinutes: cat.prepTimeMinutes ?? 30,
      maxOrderQuantity: cat.maxOrderQuantity ?? 10,
      subscriptionEligible,
    }
    let created: any
    try {
      created = await prisma.dish.create({
        data: createData as any,
        select: { id: true, name: true, slug: true, price: true, costPrice: true, categoryId: true },
      })
    } catch (e: any) {
      if (!isMissingWeightLabelColumn(e)) throw e
      await ensureWeightLabelColumn()
      try {
        created = await prisma.dish.create({
          data: createData as any,
          select: { id: true, name: true, slug: true, price: true, costPrice: true, categoryId: true },
        })
      } catch (retryErr: any) {
        if (!isMissingWeightLabelColumn(retryErr)) throw retryErr
        delete createData.weightLabel
        created = await prisma.dish.create({
          data: createData as any,
          select: { id: true, name: true, slug: true, price: true, costPrice: true, categoryId: true },
        })
      }
    }

    return NextResponse.json({
      ok: true,
      dish: { ...created, price: Number(created.price), costPrice: created.costPrice == null ? null : Number(created.costPrice) },
    })
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json({ ok: false, error: 'блюдо с таким идентификатором уже есть' }, { status: 400 })
    }
    const status = Number(e?.statusCode || 500)
    const msg = status >= 500 ? (e?.message || 'Ошибка сервера') : (e?.message || 'Ошибка')
    return NextResponse.json({ ok: false, error: msg }, { status })
  }
}

export async function PATCH(request: Request) {
  const reqId = `dish_patch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())

    const body = await request.json().catch(() => ({} as any))
    console.log('[menu/dishes:patch:start]', {
      reqId,
      restaurantId: ctx.restaurantId,
      hasId: typeof body?.id === 'string' && body.id.length > 0,
      hasPatch: !!body?.patch,
      optionValuesCount: Array.isArray(body?.optionValues) ? body.optionValues.length : null,
    })
    const isBulkRequest =
      body?.bulk === true ||
      Array.isArray(body?.ids) ||
      (typeof body?.categoryId === 'string' && typeof body?.id !== 'string')

    if (isBulkRequest) {
      const ids = Array.isArray(body?.ids)
        ? body.ids.filter((v: unknown) => typeof v === 'string' && v.trim().length > 0).map((v: string) => v.trim())
        : []
      const categoryId = typeof body?.categoryId === 'string' ? body.categoryId.trim() : ''
      const patch = (body?.patch && typeof body.patch === 'object') ? body.patch : {}

      const targetWhere = {
        restaurantId: ctx.restaurantId,
        ...(ids.length > 0 ? { id: { in: ids } } : {}),
        ...(ids.length === 0 && categoryId ? { categoryId } : {}),
      }

      if (ids.length === 0 && !categoryId) {
        return NextResponse.json({ ok: false, error: 'Нужен ids или categoryId для массового обновления' }, { status: 400 })
      }

      const targets = await prisma.dish.findMany({
        where: targetWhere,
        select: { id: true, tags: true, price: true },
      })
      if (targets.length === 0) {
        return NextResponse.json({ ok: false, error: 'Нет блюд для обновления' }, { status: 400 })
      }

      const updateTemplate: Record<string, unknown> = {}
      if (typeof patch?.emoji === 'string') updateTemplate.emoji = patch.emoji.trim().slice(0, 8) || null
      if (patch?.emoji === null) updateTemplate.emoji = null
      if (typeof patch?.description === 'string') updateTemplate.description = patch.description.trim() || null
      if (patch?.description === null) updateTemplate.description = null
      if (typeof patch?.isAvailable === 'boolean') updateTemplate.isAvailable = patch.isAvailable
      if (typeof patch?.subscriptionEligible === 'boolean') updateTemplate.subscriptionEligible = patch.subscriptionEligible
      if (typeof patch?.image === 'string') updateTemplate.image = patch.image.trim() || null
      if (typeof patch?.moveToCategoryId === 'string' && patch.moveToCategoryId.trim()) {
        const moveToCategoryId = patch.moveToCategoryId.trim()
        const exists = await prisma.category.findFirst({
          where: { id: moveToCategoryId, restaurantId: ctx.restaurantId },
          select: { id: true },
        })
        if (!exists) {
          return NextResponse.json({ ok: false, error: 'Новая категория не найдена' }, { status: 400 })
        }
        updateTemplate.categoryId = moveToCategoryId
      }

      const tagsMode = typeof patch?.tagsMode === 'string' ? patch.tagsMode : undefined
      const tagsRaw = Array.isArray(patch?.tags) ? patch.tags : []
      const tags = tagsRaw.filter((t: unknown) => typeof t === 'string').slice(0, 8)
      const hasTagsPatch =
        tagsMode === 'clear' ||
        tagsMode === 'replace' ||
        tagsMode === 'add' ||
        tagsMode === 'remove'

      const priceMode = typeof patch?.priceMode === 'string' ? patch.priceMode : undefined
      const priceValue = Number(patch?.priceValue)
      const hasPricePatch =
        (priceMode === 'set' || priceMode === 'delta' || priceMode === 'percent') &&
        Number.isFinite(priceValue)

      if (Object.keys(updateTemplate).length === 0 && !hasTagsPatch && !hasPricePatch) {
        return NextResponse.json({ ok: false, error: 'Нет полей для обновления' }, { status: 400 })
      }

      await prisma.$transaction(
        targets.map((dish) => {
          const data: Record<string, unknown> = { ...updateTemplate }

          if (hasTagsPatch) {
            const current = Array.isArray(dish.tags) ? dish.tags.filter((t): t is string => typeof t === 'string') : []
            let nextPublicTags = current
            if (tagsMode === 'clear') nextPublicTags = []
            if (tagsMode === 'replace') nextPublicTags = tags
            if (tagsMode === 'add') nextPublicTags = Array.from(new Set([...current, ...tags])).slice(0, 8)
            if (tagsMode === 'remove') nextPublicTags = current.filter((t) => !tags.includes(t)).slice(0, 8)
            data.tags = nextPublicTags
          }

          if (hasPricePatch) {
            const currentPrice = Number(dish.price)
            let nextPrice = currentPrice
            if (priceMode === 'set') nextPrice = priceValue
            if (priceMode === 'delta') nextPrice = currentPrice + priceValue
            if (priceMode === 'percent') nextPrice = currentPrice + (currentPrice * priceValue) / 100
            nextPrice = Math.max(0, Number(nextPrice.toFixed(2)))
            data.price = new Prisma.Decimal(String(nextPrice))
          }

          return prisma.dish.update({
            where: { id: dish.id },
            data,
          })
        })
      )

      return NextResponse.json({ ok: true, updated: targets.length })
    }

    const id = typeof body?.id === 'string' ? body.id : ''
    if (!id) return NextResponse.json({ ok: false, error: 'id обязателен' }, { status: 400 })

    let existing = await prisma.dish.findFirst({
      where: { id, restaurantId: ctx.restaurantId },
      select: { id: true, tags: true, restaurantId: true },
    })
    if (!existing && SINGLE_TENANT_RESTAURANT_ID) {
      const fallback = await prisma.dish.findUnique({
        where: { id },
        select: { id: true, tags: true, restaurantId: true },
      })
      if (fallback?.restaurantId === SINGLE_TENANT_RESTAURANT_ID) {
        existing = fallback
      }
    }
    if (!existing) return NextResponse.json({ ok: false, error: 'блюдо не найдено' }, { status: 404 })

    const data: Record<string, unknown> = {}
    if (typeof body?.name === 'string') data.name = body.name.trim()
    if (typeof body?.slug === 'string') data.slug = body.slug.trim().toLowerCase().replace(/\s+/g, '-')
    if (typeof body?.description === 'string') data.description = body.description.trim() || null
    if (typeof body?.weightLabel === 'string') data.weightLabel = body.weightLabel.trim().slice(0, 120) || null
    if (typeof body?.price === 'number' && Number.isFinite(body.price)) data.price = new Prisma.Decimal(String(body.price))
    if (Object.prototype.hasOwnProperty.call(body ?? {}, 'costPrice')) {
      const cp = body?.costPrice
      if (cp === null || cp === '' || typeof cp === 'undefined') {
        data.costPrice = null
      } else if (typeof cp === 'number' && Number.isFinite(cp) && cp > 0) {
        data.costPrice = new Prisma.Decimal(String(cp))
      } else {
        data.costPrice = null
      }
    }
    if (typeof body?.categoryId === 'string') {
      const nextCategoryId = body.categoryId.trim()
      if (nextCategoryId) data.categoryId = nextCategoryId
    }
    if (typeof body?.isAvailable === 'boolean') data.isAvailable = body.isAvailable
    if (Array.isArray(body?.tags)) {
      data.tags = body.tags.filter((t: unknown) => typeof t === 'string').slice(0, 8)
    }
    if (typeof body?.subscriptionEligible === 'boolean') data.subscriptionEligible = body.subscriptionEligible
    if (typeof body?.emoji === 'string') {
      const e = body.emoji.trim().slice(0, 8)
      data.emoji = e || null
    }
    if (typeof body?.image === 'string') {
      const image = body.image.trim()
      data.image = image || null
    }

    const optionValuesRaw = Array.isArray(body?.optionValues) ? body.optionValues : null
    const normalizedOptions =
      optionValuesRaw === null
        ? null
        : optionValuesRaw
            .map((v: any, idx: number) => ({
              optionValueId: typeof v?.optionValueId === 'string' ? v.optionValueId : '',
              priceAdjust: Number(v?.priceAdjust ?? 0),
              order: Number.isFinite(Number(v?.order)) ? Math.round(Number(v.order)) : idx,
              isAvailable: v?.isAvailable !== false,
              subscriptionEligible: v?.subscriptionEligible !== false,
              costPrice:
                v?.costPrice === null || typeof v?.costPrice === 'undefined'
                  ? null
                  : Number.isFinite(Number(v?.costPrice)) && Number(v?.costPrice) > 0
                    ? Number(v.costPrice)
                    : null,
            }))
            .filter((v: any) => v.optionValueId)
            .slice(0, 40)

    const optionValueIds = normalizedOptions ? [...new Set(normalizedOptions.map((v: any) => v.optionValueId))] : []
    const effectiveRestaurantId = String(existing.restaurantId || ctx.restaurantId)
    // Single-restaurant production can still have stale tenant context in session.
    // Validate by primary key only so dish edit is not blocked by context drift.
    const allowedValues =
      normalizedOptions && optionValueIds.length > 0
        ? await prisma.menuOptionValue.findMany({
            where: { id: { in: optionValueIds } },
            select: { id: true },
          })
        : []
    const allowed = new Set(allowedValues.map((v) => v.id))
    const safeOptions = normalizedOptions ? normalizedOptions.filter((v: any) => allowed.has(v.optionValueId)) : null
    const optionsAllInvalid = Boolean(
      normalizedOptions && normalizedOptions.length > 0 && (safeOptions?.length ?? 0) === 0
    )

    const runPatchTx = async () =>
      prisma.$transaction(
        async (tx) => {
          if (Object.keys(data).length > 0) {
            await tx.dish.update({
              where: { id },
              data,
            })
          } else if (safeOptions !== null) {
            await tx.dish.update({
              where: { id },
              data: { updatedAt: new Date() },
            })
          }

          if (safeOptions !== null && !optionsAllInvalid) {
            await tx.dishOptionValue.deleteMany({ where: { dishId: id } })
            if (safeOptions.length > 0) {
              const bulkData = safeOptions.map((item: (typeof safeOptions)[number]) => ({
                restaurantId: effectiveRestaurantId,
                dishId: id,
                optionValueId: item.optionValueId,
                priceAdjust: Number.isFinite(item.priceAdjust) ? Number(item.priceAdjust) : 0,
                order: item.order,
                isAvailable: item.isAvailable,
                subscriptionEligible: item.subscriptionEligible !== false,
                ...(item.costPrice != null ? { costPrice: item.costPrice } : {}),
              }))
              try {
                await tx.dishOptionValue.createMany({ data: bulkData })
              } catch {
                for (const item of safeOptions) {
                  await tx.dishOptionValue.create({
                    data: {
                      restaurantId: effectiveRestaurantId,
                      dishId: id,
                      optionValueId: item.optionValueId,
                      priceAdjust: new Prisma.Decimal(String(Number.isFinite(item.priceAdjust) ? item.priceAdjust : 0)),
                      order: item.order,
                      isAvailable: item.isAvailable,
                      subscriptionEligible: item.subscriptionEligible !== false,
                      ...(item.costPrice != null
                        ? { costPrice: new Prisma.Decimal(String(item.costPrice)) }
                        : {}),
                    },
                  })
                }
              }
            }
          }
        },
        { maxWait: PATCH_TX_MAX_WAIT_MS, timeout: PATCH_TX_TIMEOUT_MS }
      )

    try {
      await runPatchTx()
    } catch (err: any) {
      if (isMissingWeightLabelColumn(err) && Object.prototype.hasOwnProperty.call(data, 'weightLabel')) {
        await ensureWeightLabelColumn()
        try {
          await runPatchTx()
        } catch (retryErr: any) {
          if (!isMissingWeightLabelColumn(retryErr)) throw retryErr
          delete data.weightLabel
          await runPatchTx()
        }
      } else if (isRetryablePrismaError(err)) {
        await wait(PATCH_RETRY_DELAY_MS)
        await runPatchTx()
      } else {
        throw err
      }
    }

    return NextResponse.json({
      ok: true,
      optionsUpdated: safeOptions && !optionsAllInvalid ? safeOptions.length : 0,
      optionsWarning:
        optionsAllInvalid
          ? 'выбранные значения опций не найдены'
          : undefined,
      reqId,
    })
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    const retryable = isRetryablePrismaError(e)
    console.error('[menu/dishes:patch:error]', {
      reqId,
      status,
      retryable,
      code: e?.code,
      message: String(e?.message || ''),
    })
    return NextResponse.json(
      {
        ok: false,
        error: retryable ? 'База перегружена, попробуйте снова через пару секунд' : 'Ошибка',
        reqId,
      },
      { status: retryable ? 503 : status }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())

    const { searchParams } = new URL(request.url)
    const idParam = searchParams.get('id')
    const idsParam = searchParams.get('ids')

    const toDelete: string[] = idsParam
      ? idsParam.split(',').map((s) => s.trim()).filter(Boolean)
      : idParam
        ? [idParam]
        : []
    if (toDelete.length === 0) return NextResponse.json({ ok: false, error: 'id или ids обязательны' }, { status: 400 })

    const { count } = await prisma.dish.deleteMany({
      where: { id: { in: toDelete }, restaurantId: ctx.restaurantId },
    })

    return NextResponse.json({ ok: true, deleted: count })
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    return NextResponse.json({ ok: false, error: 'Ошибка' }, { status })
  }
}
