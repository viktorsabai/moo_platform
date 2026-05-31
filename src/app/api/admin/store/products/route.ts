import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getRestaurantContext, requireRestaurantAdmin } from '@/lib/restaurant-context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())

    const [categories, products] = await Promise.all([
      prisma.storeCategory.findMany({
        where: { restaurantId: ctx.restaurantId },
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
        select: { id: true, name: true, slug: true, order: true },
      }),
      prisma.storeProduct.findMany({
        where: { restaurantId: ctx.restaurantId },
        orderBy: [{ createdAt: 'desc' }],
        select: {
          id: true,
          name: true,
          slug: true,
          emoji: true,
          description: true,
          image: true,
          isActive: true,
          categoryId: true,
          tags: true,
          autoHideIfZeroStock: true,
          category: { select: { id: true, name: true } },
          variants: {
            orderBy: [{ createdAt: 'asc' }],
            select: { id: true, name: true, sku: true, price: true, qty: true, isActive: true },
          },
        },
      }),
    ])

    return NextResponse.json({
      ok: true,
      categories,
      products: products.map((p) => ({
        ...p,
        variants: p.variants.map((v) => ({ ...v, price: Number(v.price) })),
      })),
    })
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    return NextResponse.json({ ok: false, error: status === 403 ? 'forbidden' : 'Ошибка' }, { status })
  }
}

function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9а-яё-]/gi, (c) => {
      const map: Record<string, string> = {
        а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
        и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
        с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
        ы: 'y', э: 'e', ю: 'yu', я: 'ya',
      }
      return map[c.toLowerCase()] ?? ''
    })
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'product'
}

export async function POST(request: Request) {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())

    const body = await request.json().catch(() => ({} as any))
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    let slug = typeof body?.slug === 'string' ? body.slug.trim().toLowerCase().replace(/\s+/g, '-') : ''
    if (!slug) slug = slugFromName(name)
    const emoji = typeof body?.emoji === 'string' ? body.emoji.trim().slice(0, 8) : null
    const description = typeof body?.description === 'string' ? body.description.trim() : ''
    const image = typeof body?.image === 'string' ? body.image.trim() : ''
    const categoryId = typeof body?.categoryId === 'string' ? body.categoryId : ''
    const isActive = body?.isActive === false ? false : true
    const tagsRaw = body?.tags
    const tags = Array.isArray(tagsRaw)
      ? tagsRaw.filter((t: unknown) => typeof t === 'string').slice(0, 12)
      : []
    const autoHideIfZeroStock = body?.autoHideIfZeroStock !== false

    const variants = Array.isArray(body?.variants) ? body.variants : []
    const variantCreates = variants
      .map((v: any) => ({
        name: typeof v?.name === 'string' ? v.name.trim() : '',
        sku: typeof v?.sku === 'string' ? v.sku.trim() : null,
        price: Number(v?.price ?? 0),
        qty: Number(v?.qty ?? 0),
        isActive: v?.isActive === false ? false : true,
      }))
      .filter((v: any) => v.name && Number.isFinite(v.price))

    if (!name || !categoryId) {
      return NextResponse.json({ ok: false, error: 'Название и категория обязательны' }, { status: 400 })
    }

    const cat = await prisma.storeCategory.findFirst({
      where: { id: categoryId, restaurantId: ctx.restaurantId },
      select: { id: true },
    })
    if (!cat?.id) {
      return NextResponse.json({ ok: false, error: 'Категория не найдена' }, { status: 400 })
    }

    let created
    for (let attempt = 0; attempt < 10; attempt++) {
      const trySlug = attempt === 0 ? slug : `${slug}-${attempt + 1}`
      try {
        created = await prisma.storeProduct.create({
          data: {
            restaurant: { connect: { id: ctx.restaurantId } },
            name,
            slug: trySlug,
            emoji: emoji || undefined,
            description: description || null,
            image: image || null,
            isActive,
            tags: tags.length > 0 ? tags : [],
            autoHideIfZeroStock,
            category: { connect: { id: categoryId } },
            variants: variantCreates.length
              ? {
                  create: variantCreates.map((v: any) => ({
                    name: v.name,
                    sku: v.sku,
                    restaurant: { connect: { id: ctx.restaurantId } },
                    price: new Prisma.Decimal(String(v.price)),
                    qty: Math.max(0, Math.trunc(v.qty || 0)),
                    isActive: v.isActive,
                  })),
                }
              : undefined,
          },
          select: { id: true },
        })
        break
      } catch (e: any) {
        if (e?.code === 'P2002' && attempt < 9) continue
        throw e
      }
    }

    return NextResponse.json({ ok: true, productId: created!.id })
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json({ ok: false, error: 'Товар с таким идентификатором уже есть' }, { status: 400 })
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

    const existing = await prisma.storeProduct.findFirst({
      where: { id, restaurantId: ctx.restaurantId },
      select: { id: true },
    })
    if (!existing) return NextResponse.json({ ok: false, error: 'товар не найден' }, { status: 404 })

    const data: Record<string, unknown> = {}
    if (typeof body?.name === 'string') data.name = body.name.trim()
    if (typeof body?.description === 'string') data.description = body.description.trim() || null
    if (typeof body?.image === 'string') data.image = body.image.trim() || null
    if (typeof body?.categoryId === 'string') data.categoryId = body.categoryId
    if (typeof body?.isActive === 'boolean') data.isActive = body.isActive
    if (typeof body?.emoji === 'string') data.emoji = body.emoji.trim().slice(0, 8) || null
    if (Array.isArray(body?.tags)) {
      data.tags = body.tags.filter((t: unknown) => typeof t === 'string').slice(0, 12)
    }
    if (typeof body?.autoHideIfZeroStock === 'boolean') data.autoHideIfZeroStock = body.autoHideIfZeroStock

    if (!Object.keys(data).length) return NextResponse.json({ ok: false, error: 'нет полей для обновления' }, { status: 400 })

    await prisma.storeProduct.update({
      where: { id: existing.id },
      data,
    })

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

    const { count } = await prisma.storeProduct.deleteMany({
      where: { id: { in: toDelete }, restaurantId: ctx.restaurantId },
    })

    return NextResponse.json({ ok: true, deleted: count })
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    return NextResponse.json({ ok: false, error: e?.message || 'Ошибка' }, { status })
  }
}

