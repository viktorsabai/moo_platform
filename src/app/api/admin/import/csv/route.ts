import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getRestaurantContext, requireRestaurantAdmin } from '@/lib/restaurant-context'
import { parseCsv } from '@/lib/csv-parse'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ImportType = 'menu' | 'store'

// LMS/other exports — slug is valid for menu/store template
const JUNK_PATTERNS = /^(lesson_id|course_|test_|^id$|_id$|uuid|user_id|product_id|category_id|created_at|updated_at)/i
const VALID_SLUG = /^[a-zа-яё0-9_-]+$/

function looksLikeMenuHeader(row: string[]): boolean {
  if (!row || row.length < 3) return false
  const headerLower = row.slice(0, 8).map((c) => (c || '').trim().toLowerCase())
  if (headerLower.some((h) => JUNK_PATTERNS.test(h))) return false
  const hasCategory = headerLower.some((h) => h.includes('category') || h.includes('категор'))
  const hasName = headerLower.some((h) => h === 'name' || h === 'product_name' || h.includes('назван') || h === 'naming')
  const hasPrice = headerLower.some((h) => h.includes('price') || h.includes('цена') || h.includes('прайс'))
  return hasCategory && hasName && hasPrice
}

/** Detect menu column layout: 3-col (cat,name,price) or 6-col (cat_slug,cat_name,name,slug,price,desc) */
function getMenuColumnIndices(header: string[]): { catSlug: number; catName: number; name: number; slug: number; price: number; desc: number } {
  const h = header.map((c) => (c || '').trim().toLowerCase())
  if (h.length >= 6) return { catSlug: 0, catName: 1, name: 2, slug: 3, price: 4, desc: 5 }
  return { catSlug: 0, catName: 0, name: 1, slug: -1, price: 2, desc: -1 }
}

function looksLikeStoreHeader(row: string[]): boolean {
  if (!row || row.length < 4) return false
  const headerLower = row.slice(0, 8).map((c) => (c || '').trim().toLowerCase())
  if (headerLower.some((h) => JUNK_PATTERNS.test(h))) return false
  const hasCategory = headerLower.some((h) => h.includes('category'))
  const hasProduct = headerLower.some((h) => h.includes('product'))
  const hasPrice = headerLower.some((h) => h.includes('price'))
  return hasCategory && hasProduct && hasPrice
}

function isValidName(s: string, minLen = 2, maxLen = 100): boolean {
  const t = s.trim()
  if (t.length < minLen || t.length > maxLen) return false
  if (JUNK_PATTERNS.test(t)) return false
  return true
}

function isValidSlug(s: string): boolean {
  const t = s.trim().toLowerCase()
  if (!t || t.length > 80) return false
  return VALID_SLUG.test(t)
}

function isValidPrice(n: number): boolean {
  return Number.isFinite(n) && n >= 0 && n <= 1_000_000
}

export async function POST(request: Request) {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const type = (formData.get('type') as ImportType) || 'menu'

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'Нужен файл' }, { status: 400 })
    }
    if (type !== 'menu' && type !== 'store') {
      return NextResponse.json({ ok: false, error: 'type: menu или store' }, { status: 400 })
    }

    const text = await file.text()
    const rows = parseCsv(text)
    if (rows.length === 0) {
      return NextResponse.json({ ok: false, error: 'Файл пустой' }, { status: 400 })
    }

    const hasValidHeader = type === 'menu' ? looksLikeMenuHeader(rows[0]) : looksLikeStoreHeader(rows[0])
    if (!hasValidHeader) {
      const hint = type === 'menu'
        ? 'Нужны колонки: category (или category_name), name (или naming), price. Slug создаётся автоматически.'
        : 'Нужна шапка: category_slug, category_name, product_name, price'
      return NextResponse.json(
        { ok: false, error: `Файл не похож на ${type === 'menu' ? 'меню' : 'магазин'}. ${hint}` },
        { status: 400 }
      )
    }
    const dataRows = rows.slice(1).filter((r) => r.some((c) => String(c || '').trim()))

    if (type === 'menu') {
      const cols = getMenuColumnIndices(rows[0])
      const validRows: string[][] = []
      for (const row of dataRows) {
        const catNameRaw = (row[cols.catName] ?? row[cols.catSlug] ?? '').trim()
        const catSlug = catNameRaw.toLowerCase().replace(/\s+/g, '-').replace(/[^a-zа-яё0-9_-]/g, '') || 'uncat'
        const catName = catNameRaw || catSlug
        const name = (row[cols.name] ?? '').trim()
        const slugRaw = cols.slug >= 0 ? (row[cols.slug] ?? '').trim().toLowerCase().replace(/\s+/g, '-') : ''
        const slug = slugRaw || name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-zа-яё0-9_-]/g, '')
        const price = Number(row[cols.price] ?? 0)
        if (!name) continue
        if (!isValidName(catName, 1, 100)) continue
        if (!isValidName(name)) continue
        if (!isValidSlug(catSlug)) continue
        if (!slug || !isValidSlug(slug)) continue
        if (!isValidPrice(price)) continue
        validRows.push([catSlug, catName, name, slug, String(price), cols.desc >= 0 ? (row[cols.desc] ?? '') : ''])
      }
      const goodRatio = dataRows.length > 0 ? validRows.length / dataRows.length : 1
      if (goodRatio < 0.5) {
        return NextResponse.json(
          { ok: false, error: `Слишком много невалидных строк (${validRows.length} из ${dataRows.length}). Проверьте имена, цены и slug.` },
          { status: 400 }
        )
      }

      const categorySlugToId = new Map<string, string>()
      let createdCategories = 0
      const maxOrder = await prisma.category.aggregate({
        where: { restaurantId: ctx.restaurantId },
        _max: { order: true },
      })
      const orderStart = (maxOrder._max.order ?? -1) + 1
      for (const row of validRows) {
        const catSlug = (row[0] || '').trim().toLowerCase().replace(/\s+/g, '-') || 'uncat'
        const catName = (row[1] || '').trim() || catSlug
        if (!catSlug) continue
        if (categorySlugToId.has(catSlug)) continue
        const existing = await prisma.category.findUnique({
          where: { restaurantId_slug: { restaurantId: ctx.restaurantId, slug: catSlug } },
          select: { id: true },
        })
        if (existing) {
          categorySlugToId.set(catSlug, existing.id)
          continue
        }
        const created = await prisma.category.create({
          data: {
            restaurantId: ctx.restaurantId,
            name: catName,
            slug: catSlug,
            order: orderStart + createdCategories,
          },
          select: { id: true, slug: true },
        })
        categorySlugToId.set(created.slug, created.id)
        createdCategories += 1
      }

      let createdDishes = 0
      for (const row of validRows) {
        const catSlug = (row[0] || '').trim() || 'uncat'
        const name = (row[2] || '').trim()
        const slug = (row[3] || '').trim() || name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-zа-яё0-9_-]/g, '')
        const priceRaw = Number(row[4] ?? 0)
        const price = Number.isFinite(priceRaw) ? priceRaw : 0
        const description = (row[5] || '').trim() || null
        if (!name || !slug) continue
        const categoryId = categorySlugToId.get(catSlug)
        if (!categoryId) continue
        try {
          await prisma.dish.create({
            data: {
              restaurantId: ctx.restaurantId,
              name,
              slug,
              description: description || undefined,
              price: new Prisma.Decimal(String(price)),
              categoryId,
              isAvailable: true,
            },
          })
          createdDishes += 1
        } catch (e: any) {
          if (e?.code === 'P2002') continue // duplicate slug
          throw e
        }
      }
      return NextResponse.json({
        ok: true,
        createdCategories,
        createdDishes,
      })
    }

    // store: category_slug, category_name, product_name, product_slug, description, variant_name, price, qty
    const storeValidRows: string[][] = []
    for (const row of dataRows) {
      const catSlug = (row[0] || '').trim().toLowerCase().replace(/\s+/g, '-') || 'uncat'
      const catName = (row[1] || '').trim() || catSlug
      const productName = (row[2] || '').trim()
      const productSlug = (row[3] || '').trim().toLowerCase().replace(/\s+/g, '-') || productName.toLowerCase().replace(/\s+/g, '-')
      const price = Number(row[6] ?? 0)
      if (!productName) continue
      if (!isValidName(catName, 1, 100)) continue
      if (!isValidName(productName)) continue
      if (!isValidSlug(catSlug) || catSlug === 'uncat') continue
      if (!isValidSlug(productSlug)) continue
      if (!isValidPrice(price)) continue
      storeValidRows.push(row)
    }
    const storeGoodRatio = dataRows.length > 0 ? storeValidRows.length / dataRows.length : 1
    if (storeGoodRatio < 0.5) {
      return NextResponse.json(
        { ok: false, error: `Слишком много невалидных строк (${storeValidRows.length} из ${dataRows.length}). Проверьте названия, цены и slug.` },
        { status: 400 }
      )
    }

    const storeCategorySlugToId = new Map<string, string>()
    let createdStoreCategories = 0
    for (const row of storeValidRows) {
      const catSlug = (row[0] || '').trim().toLowerCase().replace(/\s+/g, '-') || 'uncat'
      const catName = (row[1] || '').trim() || catSlug
      if (!catSlug) continue
      if (storeCategorySlugToId.has(catSlug)) continue
      const existing = await prisma.storeCategory.findUnique({
        where: { restaurantId_slug: { restaurantId: ctx.restaurantId, slug: catSlug } },
        select: { id: true },
      })
      if (existing) {
        storeCategorySlugToId.set(catSlug, existing.id)
        continue
      }
      const created = await prisma.storeCategory.create({
        data: {
          restaurantId: ctx.restaurantId,
          name: catName,
          slug: catSlug,
        },
        select: { id: true, slug: true },
      })
      storeCategorySlugToId.set(created.slug, created.id)
      createdStoreCategories += 1
    }

    const byProduct = new Map<string, { category_slug: string; product_name: string; product_slug: string; description: string; variants: Map<string, { name: string; price: number; qty: number }> }>()
    for (const row of storeValidRows) {
      const catSlug = (row[0] || '').trim().toLowerCase().replace(/\s+/g, '-') || 'uncat'
      const productName = (row[2] || '').trim()
      const productSlug = (row[3] || '').trim().toLowerCase().replace(/\s+/g, '-') || productName.toLowerCase().replace(/\s+/g, '-')
      const description = (row[4] || '').trim()
      const variantName = (row[5] || '').trim() || 'по умолчанию'
      const priceRaw = Number(row[6] ?? 0)
      const price = Number.isFinite(priceRaw) ? priceRaw : 0
      const qty = Math.max(0, Math.trunc(Number(row[7] ?? 0)))
      if (!productName || !productSlug) continue
      const key = productSlug
      if (!byProduct.has(key)) {
        byProduct.set(key, { category_slug: catSlug, product_name: productName, product_slug: productSlug, description, variants: new Map() })
      }
      const entry = byProduct.get(key)!
      entry.variants.set(variantName, { name: variantName, price, qty })
    }

    let createdProducts = 0
    for (const [, entry] of byProduct) {
      const categoryId = storeCategorySlugToId.get(entry.category_slug)
      if (!categoryId) continue
      let variantCreates = Array.from(entry.variants.values())
        .filter((v) => v.name && Number.isFinite(v.price))
        .map((v) => ({
          name: v.name,
          sku: null as string | null,
          price: new Prisma.Decimal(String(v.price)),
          qty: Math.max(0, v.qty),
          isActive: true,
        }))
      if (variantCreates.length === 0) {
        variantCreates = [{ name: 'по умолчанию', sku: null, price: new Prisma.Decimal('0'), qty: 0, isActive: true }]
      }
      try {
        await prisma.storeProduct.create({
          data: {
            restaurant: { connect: { id: ctx.restaurantId } },
            name: entry.product_name,
            slug: entry.product_slug,
            description: entry.description || null,
            isActive: true,
            category: { connect: { id: categoryId } },
            variants: {
              create: variantCreates.map((v) => ({
                name: v.name,
                sku: v.sku,
                restaurant: { connect: { id: ctx.restaurantId } },
                price: v.price,
                qty: v.qty,
                isActive: v.isActive,
              })),
            },
          },
        })
        createdProducts += 1
      } catch (e: any) {
        if (e?.code === 'P2002') continue
        throw e
      }
    }
    return NextResponse.json({
      ok: true,
      createdCategories: createdStoreCategories,
      createdProducts,
    })
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    return NextResponse.json(
      { ok: false, error: status === 403 ? 'forbidden' : (e?.message || 'Ошибка импорта') },
      { status: status >= 400 ? status : 500 }
    )
  }
}
