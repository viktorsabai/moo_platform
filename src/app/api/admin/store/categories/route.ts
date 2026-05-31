import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRestaurantContext, requireRestaurantAdmin } from '@/lib/restaurant-context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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
    .replace(/^-|-$/g, '') || 'category'
}

export async function POST(request: Request) {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())
    const body = await request.json().catch(() => ({} as any))
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    let slug = typeof body?.slug === 'string' ? body.slug.trim().toLowerCase() : ''
    if (!name) return NextResponse.json({ ok: false, error: 'Название обязательно' }, { status: 400 })
    if (!slug) slug = slugFromName(name)
    const maxOrder = await prisma.storeCategory.aggregate({
      where: { restaurantId: ctx.restaurantId },
      _max: { order: true },
    })
    let created = null as null | { id: string; name: string; slug: string; order: number }
    for (let attempt = 0; attempt < 10; attempt++) {
      const trySlug = attempt === 0 ? slug : `${slug}-${attempt + 1}`
      try {
        created = await prisma.storeCategory.create({
          data: {
            restaurantId: ctx.restaurantId,
            name,
            slug: trySlug,
            order: (maxOrder._max.order ?? -1) + 1,
          },
          select: { id: true, name: true, slug: true, order: true },
        })
        break
      } catch (e: any) {
        if (e?.code === 'P2002' && attempt < 9) continue
        throw e
      }
    }
    return NextResponse.json({ ok: true, category: created })
  } catch (e: any) {
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
    const existing = await prisma.storeCategory.findFirst({
      where: { id, restaurantId: ctx.restaurantId },
      select: { id: true },
    })
    if (!existing) return NextResponse.json({ ok: false, error: 'категория не найдена' }, { status: 404 })
    const data: Record<string, unknown> = {}
    if (typeof body?.name === 'string') data.name = body.name.trim()
    if (typeof body?.emoji === 'string') data.emoji = body.emoji.trim().slice(0, 8) || null
    if (typeof body?.description === 'string') data.description = body.description.trim() || null
    if (typeof body?.order === 'number' && Number.isFinite(body.order)) data.order = Math.round(body.order)
    if (Object.keys(data).length === 0) return NextResponse.json({ ok: false, error: 'нет полей для обновления' }, { status: 400 })
    await prisma.storeCategory.update({ where: { id }, data })
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

    const { count } = await prisma.storeCategory.deleteMany({
      where: { id: { in: toDelete }, restaurantId: ctx.restaurantId },
    })

    return NextResponse.json({ ok: true, deleted: count })
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    return NextResponse.json({ ok: false, error: e?.message || 'Ошибка' }, { status })
  }
}
