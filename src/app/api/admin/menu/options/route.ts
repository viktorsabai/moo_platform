import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getRestaurantContext, requireRestaurantAdmin } from '@/lib/restaurant-context'
import { slugifyOption } from '@/lib/menu-options'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const SINGLE_TENANT_RESTAURANT_ID =
  String(process.env.UFO_SINGLE_RESTAURANT_ID || '').trim()

type PrismaLike = typeof prisma

async function ensureUniqueGroupSlug(client: PrismaLike, restaurantId: string, name: string): Promise<string> {
  const base = slugifyOption(name)
  let slug = base
  for (let i = 2; i < 50; i += 1) {
    const exists = await client.menuOptionGroup.findUnique({
      where: { restaurantId_slug: { restaurantId, slug } },
      select: { id: true },
    })
    if (!exists) return slug
    slug = `${base}-${i}`
  }
  return `${base}-${Date.now()}`
}

async function ensureUniqueValueSlug(client: PrismaLike, groupId: string, name: string): Promise<string> {
  const base = slugifyOption(name)
  let slug = base
  for (let i = 2; i < 50; i += 1) {
    const exists = await client.menuOptionValue.findUnique({
      where: { groupId_slug: { groupId, slug } },
      select: { id: true },
    })
    if (!exists) return slug
    slug = `${base}-${i}`
  }
  return `${base}-${Date.now()}`
}

async function ensureUniqueGroupSlugExcluding(
  client: PrismaLike,
  restaurantId: string,
  name: string,
  excludeGroupId: string
): Promise<string> {
  const base = slugifyOption(name)
  let slug = base
  for (let i = 2; i < 50; i += 1) {
    const exists = await client.menuOptionGroup.findFirst({
      where: { restaurantId, slug, id: { not: excludeGroupId } },
      select: { id: true },
    })
    if (!exists) return slug
    slug = `${base}-${i}`
  }
  return `${base}-${Date.now()}`
}

async function ensureUniqueValueSlugExcluding(
  client: PrismaLike,
  groupId: string,
  name: string,
  excludeValueId: string
): Promise<string> {
  const base = slugifyOption(name)
  let slug = base
  for (let i = 2; i < 50; i += 1) {
    const exists = await client.menuOptionValue.findFirst({
      where: { groupId, slug, id: { not: excludeValueId } },
      select: { id: true },
    })
    if (!exists) return slug
    slug = `${base}-${i}`
  }
  return `${base}-${Date.now()}`
}

/** На проде иногда не накатили миграцию с subscriptionImageUrl / isActive — перебираем select/orderBy. */
function normalizeAdminMenuOptionGroups(groups: unknown): unknown[] {
  if (!Array.isArray(groups)) return []
  return groups.map((g: any) => ({
    ...g,
    isActive: g?.isActive !== false,
    values: Array.isArray(g?.values)
      ? g.values.map((v: any) => ({
          ...v,
          isActive: v?.isActive !== false,
          subscriptionImageUrl: v?.subscriptionImageUrl ?? null,
        }))
      : [],
  }))
}

function menuOptionGroupQueryAttempts(restaurantId: string) {
  const where = { restaurantId }
  type OB = { isActive?: 'desc' | 'asc'; order?: 'asc' | 'desc'; createdAt?: 'asc' | 'desc' }
  const goActive: OB[] = [{ isActive: 'desc' }, { order: 'asc' }, { createdAt: 'asc' }]
  const goSimple: OB[] = [{ order: 'asc' }, { createdAt: 'asc' }]
  const voActive: OB[] = [{ isActive: 'desc' }, { order: 'asc' }, { createdAt: 'asc' }]
  const voSimple: OB[] = [{ order: 'asc' }, { createdAt: 'asc' }]

  const selGroupFull = { id: true, name: true, slug: true, order: true, isActive: true }
  const selGroupCore = { id: true, name: true, slug: true, order: true }
  const selValFull = { id: true, name: true, slug: true, order: true, isActive: true, subscriptionImageUrl: true }
  const selValCore = { id: true, name: true, slug: true, order: true, isActive: true }
  const selValMin = { id: true, name: true, slug: true, order: true }

  return [
    { orderBy: goActive, select: { ...selGroupFull, values: { orderBy: voActive, select: selValFull } } },
    { orderBy: goActive, select: { ...selGroupFull, values: { orderBy: voActive, select: selValCore } } },
    { orderBy: goActive, select: { ...selGroupFull, values: { orderBy: voSimple, select: selValFull } } },
    { orderBy: goActive, select: { ...selGroupFull, values: { orderBy: voSimple, select: selValCore } } },
    { orderBy: goSimple, select: { ...selGroupFull, values: { orderBy: voSimple, select: selValCore } } },
    { orderBy: goSimple, select: { ...selGroupFull, values: { orderBy: voSimple, select: selValMin } } },
    { orderBy: goSimple, select: { ...selGroupCore, values: { orderBy: voSimple, select: selValCore } } },
    { orderBy: goSimple, select: { ...selGroupCore, values: { orderBy: voSimple, select: selValMin } } },
  ].map((q) => ({ where, ...q }))
}

export async function GET() {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())
    let groups: any[] | null = null
    let lastError: unknown
    for (const args of menuOptionGroupQueryAttempts(ctx.restaurantId)) {
      try {
        groups = await prisma.menuOptionGroup.findMany(args as any)
        lastError = undefined
        break
      } catch (e) {
        lastError = e
      }
    }
    if (!groups && lastError) throw lastError
    return NextResponse.json({ ok: true, groups: normalizeAdminMenuOptionGroups(groups ?? []) })
  } catch (e: any) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === 'P2021' || e.code === 'P2022')) {
      return NextResponse.json({ ok: false, error: 'База ещё не обновлена для опций. Нужно применить миграцию.' }, { status: 503 })
    }
    const status = Number(e?.statusCode || 500)
    return NextResponse.json({ ok: false, error: status === 403 ? 'forbidden' : 'Ошибка' }, { status })
  }
}

export async function POST(request: Request) {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())
    const body = await request.json().catch(() => ({} as any))
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    const values = Array.isArray(body?.values) ? body.values : []
    if (!name) return NextResponse.json({ ok: false, error: 'Название опции обязательно' }, { status: 400 })

    const group = await prisma.$transaction(async (tx) => {
      const order = await tx.menuOptionGroup.count({ where: { restaurantId: ctx.restaurantId } })
      const createdGroup = await tx.menuOptionGroup.create({
        data: {
          restaurantId: ctx.restaurantId,
          name,
          slug: await ensureUniqueGroupSlug(tx as PrismaLike, ctx.restaurantId, name),
          order,
        },
      })
      const normalizedValues = values
        .map((v: any) => String(typeof v === 'string' ? v : v?.name || '').trim())
        .filter(Boolean)
        .slice(0, 20)
      for (let idx = 0; idx < normalizedValues.length; idx += 1) {
        const valueName = normalizedValues[idx]
        await tx.menuOptionValue.create({
          data: {
            restaurantId: ctx.restaurantId,
            groupId: createdGroup.id,
            name: valueName,
            slug: await ensureUniqueValueSlug(tx as PrismaLike, createdGroup.id, valueName),
            order: idx,
          },
        })
      }
      return createdGroup
    })
    return NextResponse.json({ ok: true, group })
  } catch (e: any) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json({ ok: false, error: 'Такая опция уже есть' }, { status: 400 })
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === 'P2021' || e.code === 'P2022')) {
      return NextResponse.json({ ok: false, error: 'База ещё не обновлена для опций. Нужно применить миграцию.' }, { status: 503 })
    }
    const status = Number(e?.statusCode || 500)
    return NextResponse.json({ ok: false, error: e?.message || 'Ошибка' }, { status })
  }
}

export async function PUT(request: Request) {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())
    const body = await request.json().catch(() => ({} as any))
    const groupId = typeof body?.groupId === 'string' ? body.groupId : ''
    const valueName = typeof body?.valueName === 'string' ? body.valueName.trim() : ''
    if (!groupId || !valueName) return NextResponse.json({ ok: false, error: 'Нужны groupId и valueName' }, { status: 400 })

    const group = await prisma.menuOptionGroup.findFirst({
      where: SINGLE_TENANT_RESTAURANT_ID ? { id: groupId } : { id: groupId, restaurantId: ctx.restaurantId },
      select: { id: true },
    })
    if (!group) return NextResponse.json({ ok: false, error: 'Опция не найдена' }, { status: 404 })

    const subscriptionImageUrlRaw = typeof body?.subscriptionImageUrl === 'string' ? body.subscriptionImageUrl.trim() : ''
    const subscriptionImageUrl = subscriptionImageUrlRaw.length > 0 ? subscriptionImageUrlRaw : null

    const order = await prisma.menuOptionValue.count({ where: { groupId } })
    const slug = await ensureUniqueValueSlug(prisma, groupId, valueName)
    let value
    try {
      value = await prisma.menuOptionValue.create({
        data: {
          restaurantId: ctx.restaurantId,
          groupId,
          name: valueName,
          slug,
          order,
          subscriptionImageUrl,
        },
      })
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2022') {
        value = await prisma.menuOptionValue.create({
          data: {
            restaurantId: ctx.restaurantId,
            groupId,
            name: valueName,
            slug,
            order,
          },
        })
      } else {
        throw e
      }
    }
    return NextResponse.json({ ok: true, value: { ...value, subscriptionImageUrl: (value as any).subscriptionImageUrl ?? null } })
  } catch (e: any) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === 'P2021' || e.code === 'P2022')) {
      return NextResponse.json({ ok: false, error: 'База ещё не обновлена для опций. Нужно применить миграцию.' }, { status: 503 })
    }
    const status = Number(e?.statusCode || 500)
    return NextResponse.json({ ok: false, error: e?.message || 'Ошибка' }, { status })
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())
    const body = await request.json().catch(() => ({} as any))
    const kind = body?.kind
    if (kind === 'group') {
      const groupId = typeof body?.groupId === 'string' ? body.groupId : ''
      if (!groupId) return NextResponse.json({ ok: false, error: 'Нужен groupId' }, { status: 400 })
      const existing = await prisma.menuOptionGroup.findFirst({
        where: SINGLE_TENANT_RESTAURANT_ID ? { id: groupId } : { id: groupId, restaurantId: ctx.restaurantId },
        select: { id: true, name: true },
      })
      if (!existing) return NextResponse.json({ ok: false, error: 'Опция не найдена' }, { status: 404 })
      const data: Prisma.MenuOptionGroupUpdateInput = {}
      if (typeof body?.name === 'string') {
        const name = body.name.trim()
        if (!name) return NextResponse.json({ ok: false, error: 'Пустое название' }, { status: 400 })
        data.name = name
        if (name !== existing.name) {
          data.slug = await ensureUniqueGroupSlugExcluding(prisma, ctx.restaurantId, name, groupId)
        }
      }
      if (typeof body?.order === 'number' && Number.isFinite(body.order)) {
        data.order = Math.max(0, Math.floor(body.order))
      }
      if (typeof body?.isActive === 'boolean') {
        data.isActive = body.isActive
      }
      if (Object.keys(data).length === 0) {
        return NextResponse.json({ ok: true, group: existing })
      }
      // Не удаляем DishOptionValue при скрытии: гостевое меню и так фильтрует isActive.
      // Иначе после «вернуть в меню» у блюд пустые привязки — ощущение «всё пропало».
      const group = await prisma.$transaction(async (tx) => {
        if (data.isActive === true) {
          await tx.menuOptionValue.updateMany({ where: { groupId }, data: { isActive: true } })
        }
        if (data.isActive === false) {
          await tx.menuOptionValue.updateMany({ where: { groupId }, data: { isActive: false } })
        }
        const g = await tx.menuOptionGroup.update({ where: { id: groupId }, data })
        return g
      })
      return NextResponse.json({ ok: true, group })
    }
    if (kind === 'value') {
      const valueId = typeof body?.valueId === 'string' ? body.valueId : ''
      if (!valueId) return NextResponse.json({ ok: false, error: 'Нужен valueId' }, { status: 400 })
      const existing = await prisma.menuOptionValue.findFirst({
        where: SINGLE_TENANT_RESTAURANT_ID ? { id: valueId } : { id: valueId, restaurantId: ctx.restaurantId },
        select: { id: true, name: true, groupId: true },
      })
      if (!existing) return NextResponse.json({ ok: false, error: 'Значение не найдено' }, { status: 404 })
      const data: Prisma.MenuOptionValueUpdateInput = {}
      if (typeof body?.name === 'string') {
        const name = body.name.trim()
        if (!name) return NextResponse.json({ ok: false, error: 'Пустое название' }, { status: 400 })
        data.name = name
        if (name !== existing.name) {
          data.slug = await ensureUniqueValueSlugExcluding(prisma, existing.groupId, name, valueId)
        }
      }
      if (typeof body?.order === 'number' && Number.isFinite(body.order)) {
        data.order = Math.max(0, Math.floor(body.order))
      }
      if (typeof body?.isActive === 'boolean') {
        data.isActive = body.isActive
      }
      if ('subscriptionImageUrl' in body) {
        const raw = typeof body.subscriptionImageUrl === 'string' ? body.subscriptionImageUrl.trim() : ''
        data.subscriptionImageUrl = raw.length > 0 ? raw : null
      }
      if (Object.keys(data).length === 0) {
        return NextResponse.json({ ok: true, value: existing })
      }
      let value
      try {
        value = await prisma.menuOptionValue.update({ where: { id: valueId }, data })
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2022' &&
          'subscriptionImageUrl' in data
        ) {
          const { subscriptionImageUrl: _skip, ...rest } = data as Record<string, unknown> & {
            subscriptionImageUrl?: unknown
          }
          const next = rest as Prisma.MenuOptionValueUpdateInput
          if (Object.keys(next).length === 0) {
            return NextResponse.json({ ok: true, value: existing })
          }
          value = await prisma.menuOptionValue.update({ where: { id: valueId }, data: next })
        } else {
          throw e
        }
      }
      return NextResponse.json({ ok: true, value })
    }
    return NextResponse.json({ ok: false, error: 'kind: group | value' }, { status: 400 })
  } catch (e: any) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json({ ok: false, error: 'Такой slug уже занят' }, { status: 400 })
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === 'P2021' || e.code === 'P2022')) {
      return NextResponse.json({ ok: false, error: 'База ещё не обновлена для опций. Нужно применить миграцию.' }, { status: 503 })
    }
    const status = Number(e?.statusCode || 500)
    return NextResponse.json({ ok: false, error: e?.message || 'Ошибка' }, { status })
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())
    const { searchParams } = new URL(request.url)
    const groupId = searchParams.get('groupId') || ''
    const valueId = searchParams.get('valueId') || ''
    const mode = searchParams.get('mode') || 'hide'
    const hardDelete = mode === 'delete' || searchParams.get('hard') === '1'
    if (valueId) {
      const v = await prisma.menuOptionValue.findFirst({
        where: SINGLE_TENANT_RESTAURANT_ID ? { id: valueId } : { id: valueId, restaurantId: ctx.restaurantId },
        select: { id: true },
      })
      if (!v) return NextResponse.json({ ok: false, error: 'Значение не найдено' }, { status: 404 })
      if (hardDelete) {
        const linkedCount = await prisma.dishOptionValue.count({
          where: { optionValueId: valueId, restaurantId: ctx.restaurantId },
        })
        if (linkedCount > 0) {
          return NextResponse.json(
            { ok: false, error: `Нельзя удалить: значение используется в ${linkedCount} блюд(ах). Сначала уберите привязки.` },
            { status: 400 }
          )
        }
        await prisma.menuOptionValue.delete({ where: { id: valueId } })
        return NextResponse.json({ ok: true, deleted: 'value', mode: 'delete' })
      }
      await prisma.menuOptionValue.update({ where: { id: valueId }, data: { isActive: false } })
      return NextResponse.json({ ok: true, deleted: 'value', mode: 'hide' })
    }
    if (groupId) {
      const g = await prisma.menuOptionGroup.findFirst({
        where: SINGLE_TENANT_RESTAURANT_ID ? { id: groupId } : { id: groupId, restaurantId: ctx.restaurantId },
        select: { id: true },
      })
      if (!g) return NextResponse.json({ ok: false, error: 'Опция не найдена' }, { status: 404 })
      if (hardDelete) {
        const linkedCount = await prisma.dishOptionValue.count({
          where: {
            restaurantId: ctx.restaurantId,
            optionValue: { groupId },
          },
        })
        if (linkedCount > 0) {
          return NextResponse.json(
            { ok: false, error: `Нельзя удалить: группа используется в ${linkedCount} привязках блюд. Сначала очистите привязки.` },
            { status: 400 }
          )
        }
        await prisma.menuOptionGroup.delete({ where: { id: groupId } })
        return NextResponse.json({ ok: true, deleted: 'group', mode: 'delete' })
      }
      await prisma.$transaction(async (tx) => {
        await tx.menuOptionValue.updateMany({ where: { groupId }, data: { isActive: false } })
        await tx.menuOptionGroup.update({ where: { id: groupId }, data: { isActive: false } })
      })
      return NextResponse.json({ ok: true, deleted: 'group', mode: 'hide' })
    }
    return NextResponse.json({ ok: false, error: 'Нужен groupId или valueId' }, { status: 400 })
  } catch (e: any) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === 'P2021' || e.code === 'P2022')) {
      return NextResponse.json({ ok: false, error: 'База ещё не обновлена для опций. Нужно применить миграцию.' }, { status: 503 })
    }
    const status = Number(e?.statusCode || 500)
    return NextResponse.json({ ok: false, error: e?.message || 'Ошибка' }, { status })
  }
}
