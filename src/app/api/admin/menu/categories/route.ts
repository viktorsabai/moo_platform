import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRestaurantContext, requireRestaurantAdmin } from '@/lib/restaurant-context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const ARCHIVE_CATEGORY_SLUG = '__archive'
const SINGLE_TENANT_RESTAURANT_ID =
  String(process.env.UFO_SINGLE_RESTAURANT_ID || '').trim()

export async function GET() {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())

    const categories = await prisma.category.findMany({
      where: { restaurantId: ctx.restaurantId, slug: { not: ARCHIVE_CATEGORY_SLUG } },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, slug: true, emoji: true, order: true, description: true, prepTimeMinutes: true, maxOrderQuantity: true },
    })

    return NextResponse.json({ ok: true, categories })
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
      slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9а-яё-]/gi, (c: string) => {
        const m: Record<string, string> = {
          а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
          и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
          с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
          ы: 'y', э: 'e', ю: 'yu', я: 'ya',
        }
        return m[c.toLowerCase()] ?? ''
      }).replace(/-+/g, '-').replace(/^-|-$/g, '') || 'category'
    }
    const emoji = typeof body?.emoji === 'string' ? body.emoji.trim().slice(0, 8) : null
    const description = typeof body?.description === 'string' ? body.description.trim() : null
    const orderRaw = typeof body?.order === 'number' ? Math.round(body.order) : null
    const prepTimeMinutes = typeof body?.prepTimeMinutes === 'number' && Number.isFinite(body.prepTimeMinutes)
      ? Math.max(0, Math.min(120, Math.round(body.prepTimeMinutes)))
      : null
    const maxOrderQuantity = typeof body?.maxOrderQuantity === 'number' && Number.isFinite(body.maxOrderQuantity)
      ? Math.max(1, Math.min(100, Math.round(body.maxOrderQuantity)))
      : null

    if (!name) {
      return NextResponse.json({ ok: false, error: 'Название обязательно' }, { status: 400 })
    }

    let order = orderRaw
    if (order === null) {
      const maxOrder = await prisma.category.aggregate({
        where: { restaurantId: ctx.restaurantId },
        _max: { order: true },
      })
      order = (maxOrder._max.order ?? -1) + 1
    }

    const created = await prisma.category.create({
      data: {
        restaurantId: ctx.restaurantId,
        name,
        slug: slug || name.toLowerCase().replace(/\s+/g, '-'),
        emoji: emoji || undefined,
        description: description || undefined,
        order,
        prepTimeMinutes: prepTimeMinutes ?? undefined,
        maxOrderQuantity: maxOrderQuantity ?? undefined,
      },
      select: { id: true, name: true, slug: true, order: true },
    })

    return NextResponse.json({ ok: true, category: created })
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json({ ok: false, error: 'категория с таким идентификатором уже есть' }, { status: 400 })
    }
    const status = Number(e?.statusCode || 500)
    return NextResponse.json({ ok: false, error: e?.message || 'Ошибка' }, { status })
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())
    const body = await request.json().catch(() => ({} as any))
    const id = typeof body?.id === 'string' ? body.id : ''
    if (!id) return NextResponse.json({ ok: false, error: 'id обязателен' }, { status: 400 })
    const existing = await prisma.category.findFirst({
      where: SINGLE_TENANT_RESTAURANT_ID ? { id } : { id, restaurantId: ctx.restaurantId },
      select: { id: true },
    })
    if (!existing) return NextResponse.json({ ok: false, error: 'категория не найдена' }, { status: 404 })
    const data: Record<string, unknown> = {}
    if (typeof body?.name === 'string') data.name = body.name.trim()
    if ('emoji' in body) data.emoji = typeof body.emoji === 'string' ? body.emoji.trim().slice(0, 8) || null : null
    if (typeof body?.description === 'string') data.description = body.description.trim() || null
    if (typeof body?.order === 'number' && Number.isFinite(body.order)) data.order = Math.round(body.order)
    if ('prepTimeMinutes' in body) {
      data.prepTimeMinutes = typeof body.prepTimeMinutes === 'number' && Number.isFinite(body.prepTimeMinutes)
        ? Math.max(0, Math.min(120, Math.round(body.prepTimeMinutes)))
        : null
    }
    if ('maxOrderQuantity' in body) {
      data.maxOrderQuantity = typeof body.maxOrderQuantity === 'number' && Number.isFinite(body.maxOrderQuantity)
        ? Math.max(1, Math.min(100, Math.round(body.maxOrderQuantity)))
        : null
    }
    if (Object.keys(data).length === 0) return NextResponse.json({ ok: false, error: 'нет полей для обновления' }, { status: 400 })
    await prisma.category.update({ where: { id }, data })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    return NextResponse.json({ ok: false, error: e?.message || 'Ошибка' }, { status })
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

    const categories = await prisma.category.findMany({
      where: { id: { in: toDelete }, restaurantId: ctx.restaurantId, slug: { not: ARCHIVE_CATEGORY_SLUG } },
      select: { id: true },
    })
    if (categories.length === 0) {
      return NextResponse.json({ ok: false, error: 'категория не найдена или уже удалена' }, { status: 404 })
    }
    const categoryIds = categories.map((c) => c.id)

    const dishes = await prisma.dish.findMany({
      where: { restaurantId: ctx.restaurantId, categoryId: { in: categoryIds } },
      select: {
        id: true,
        _count: {
          select: {
            cartItems: true,
            orderItems: true,
            subscriptionItems: true,
          },
        },
      },
    })
    const protectedDishIds = dishes
      .filter((d) => d._count.cartItems > 0 || d._count.orderItems > 0 || d._count.subscriptionItems > 0)
      .map((d) => d.id)
    const unprotectedDishIds = dishes
      .filter((d) => d._count.cartItems === 0 && d._count.orderItems === 0 && d._count.subscriptionItems === 0)
      .map((d) => d.id)

    let archiveCategoryId: string | null = null
    if (protectedDishIds.length > 0) {
      const archive = await prisma.category.upsert({
        where: { restaurantId_slug: { restaurantId: ctx.restaurantId, slug: ARCHIVE_CATEGORY_SLUG } },
        update: {},
        create: {
          restaurantId: ctx.restaurantId,
          name: 'Архив',
          slug: ARCHIVE_CATEGORY_SLUG,
          order: 9999,
          description: 'Системная категория для блюд с историческими связями',
        },
        select: { id: true },
      })
      archiveCategoryId = archive.id
    }

    await prisma.$transaction(async (tx) => {
      if (unprotectedDishIds.length > 0) {
        await tx.dish.deleteMany({
          where: { id: { in: unprotectedDishIds }, restaurantId: ctx.restaurantId },
        })
      }
      if (protectedDishIds.length > 0 && archiveCategoryId) {
        await tx.dish.updateMany({
          where: { id: { in: protectedDishIds }, restaurantId: ctx.restaurantId },
          data: { categoryId: archiveCategoryId, isAvailable: false },
        })
      }
      await tx.category.deleteMany({
        where: { id: { in: categoryIds }, restaurantId: ctx.restaurantId },
      })
    })

    return NextResponse.json({
      ok: true,
      deleted: categoryIds.length,
      archivedDishes: protectedDishIds.length,
    })
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    return NextResponse.json({ ok: false, error: e?.message || 'Ошибка' }, { status })
  }
}
