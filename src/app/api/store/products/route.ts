import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getConsumerRestaurantId } from '@/lib/restaurant-context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const STORE_OPTION_TAG_PREFIX = 'opt:'

export async function GET(request: Request) {
  try {
    const restaurantId = await getConsumerRestaurantId()

    const settings = await prisma.appSettings.findUnique({
      where: { restaurantId },
      select: { storeEnabled: true },
    })
    if (settings?.storeEnabled === false) {
      return NextResponse.json({ ok: true, products: [] })
    }

    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get('categoryId')
    const q = (searchParams.get('q') || '').trim().toLowerCase()

    const products = await prisma.storeProduct.findMany({
      where: {
        restaurantId,
        isActive: true,
        ...(categoryId ? { categoryId } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        emoji: true,
        description: true,
        image: true,
        categoryId: true,
        tags: true,
        autoHideIfZeroStock: true,
        category: { select: { id: true, name: true, slug: true } },
        variants: {
          where: { isActive: true },
          orderBy: [{ createdAt: 'asc' }],
          select: { id: true, name: true, sku: true, price: true, qty: true, isActive: true },
        },
      },
    })

    const optionValueIds = [
      ...new Set(
        products.flatMap((p) =>
          (Array.isArray(p.tags) ? p.tags : [])
            .map((t) => String(t || '').trim())
            .filter((t) => t.startsWith(STORE_OPTION_TAG_PREFIX))
            .map((t) => t.slice(STORE_OPTION_TAG_PREFIX.length))
            .filter(Boolean)
        )
      ),
    ]
    const optionValues = optionValueIds.length
      ? await prisma.menuOptionValue.findMany({
          where: {
            id: { in: optionValueIds },
            OR: [{ restaurantId }, { group: { restaurantId } }],
            isActive: true,
            group: { isActive: true },
          },
          select: { id: true, name: true, groupId: true, group: { select: { id: true, name: true } } },
        })
      : []
    const optionById = new Map(optionValues.map((v) => [v.id, v]))

    const mapped = products.map((p) => {
      const selectedIds = (Array.isArray(p.tags) ? p.tags : [])
        .map((t) => String(t || '').trim())
        .filter((t) => t.startsWith(STORE_OPTION_TAG_PREFIX))
        .map((t) => t.slice(STORE_OPTION_TAG_PREFIX.length))
        .filter(Boolean)
      const selectedValues = selectedIds.map((id) => optionById.get(id)).filter(Boolean)
      const grouped = new Map<string, { id: string; name: string; values: Array<{ id: string; name: string }> }>()
      for (const value of selectedValues as Array<{ id: string; name: string; group: { id: string; name: string } }>) {
        const group = value.group
        const bucket = grouped.get(group.id) ?? { id: group.id, name: group.name, values: [] }
        bucket.values.push({ id: value.id, name: value.name })
        grouped.set(group.id, bucket)
      }
      return {
        ...p,
        variants: p.variants.map((v) => ({ ...v, price: Number(v.price) })),
        optionGroups: Array.from(grouped.values()),
      }
    })
    const filtered = mapped.filter((p) => {
      const allZero = p.variants.every((v) => (v.qty ?? 0) <= 0)
      if (p.autoHideIfZeroStock && allZero) return false
      return true
    })
    return NextResponse.json({
      ok: true,
      products: filtered,
    })
  } catch {
    return NextResponse.json({ ok: false, error: 'Ошибка при получении товаров магазина' }, { status: 500 })
  }
}

