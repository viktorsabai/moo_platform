import { NextResponse } from 'next/server'
import { getRestaurantContext, requireRestaurantAdmin } from '@/lib/restaurant-context'
import { parseCsv } from '@/lib/csv-parse'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ImportType = 'menu' | 'store'

const JUNK_PATTERNS = /^(lesson_id|course_|test_|id$|slug$|_id$|uuid|user_id|product_id|category_id|created_at|updated_at)/i
const VALID_SLUG = /^[a-zа-яё0-9_-]+$/

function looksLikeMenuHeader(row: string[]): boolean {
  if (!row || row.length < 4) return false
  const headerLower = row.slice(0, 8).map((c) => (c || '').trim().toLowerCase())
  if (headerLower.some((h) => JUNK_PATTERNS.test(h))) return false
  const hasCategory = headerLower.some((h) => h.includes('category'))
  const hasName = headerLower.some((h) => h === 'name' || h === 'product_name')
  const hasPrice = headerLower.some((h) => h.includes('price'))
  return hasCategory && hasName && hasPrice
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

/** POST: validate CSV format without importing. Body: FormData with file + type=menu|store */
export async function POST(request: Request) {
  try {
    await requireRestaurantAdmin(await getRestaurantContext())
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const type = (formData.get('type') as ImportType) || 'menu'

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'Нужен файл', valid: false })
    }
    if (type !== 'menu' && type !== 'store') {
      return NextResponse.json({ ok: false, error: 'type: menu или store', valid: false })
    }

    const text = await file.text()
    const rows = parseCsv(text)
    const errors: string[] = []
    const warnings: string[] = []

    if (rows.length === 0) {
      return NextResponse.json({ ok: true, valid: false, errors: ['Файл пустой'], warnings: [], stats: { categories: 0, dishes: 0 } })
    }

    const hasValidHeader = type === 'menu' ? looksLikeMenuHeader(rows[0]) : looksLikeStoreHeader(rows[0])
    if (!hasValidHeader) {
      const hint = type === 'menu'
        ? 'Нужна шапка: category_slug, category_name, name, slug, price, description'
        : 'Нужна шапка: category_slug, category_name, product_name, product_slug, description, variant_name, price, qty'
      return NextResponse.json({ ok: true, valid: false, errors: [`Файл не похож на ${type === 'menu' ? 'меню' : 'магазин'}. ${hint}`], warnings: [], stats: { categories: 0, dishes: 0 } })
    }

    const dataRows = rows.slice(1).filter((r) => r.some((c) => String(c || '').trim()))

    if (type === 'menu') {
      const validRows: string[][] = []
      const seenCategories = new Set<string>()
      const seenSlugs = new Set<string>()

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i]
        const lineNum = i + 2
        const catSlug = (row[0] || '').trim().toLowerCase().replace(/\s+/g, '-') || 'uncat'
        const catName = (row[1] || '').trim() || catSlug
        const name = (row[2] || '').trim()
        const slugRaw = (row[3] || '').trim().toLowerCase().replace(/\s+/g, '-')
        const slug = slugRaw || name.toLowerCase().replace(/\s+/g, '-')
        const price = Number(row[4] ?? 0)

        if (!name) {
          errors.push(`Строка ${lineNum}: нет названия блюда`)
          continue
        }
        if (!isValidName(catName, 1, 100)) {
          errors.push(`Строка ${lineNum}: категория «${catName.slice(0, 20)}» невалидна`)
          continue
        }
        if (!isValidName(name)) {
          errors.push(`Строка ${lineNum}: название «${name.slice(0, 20)}» невалидно (2–100 символов)`)
          continue
        }
        if (!isValidSlug(catSlug)) {
          errors.push(`Строка ${lineNum}: category_slug «${catSlug}» — только латиница, цифры, дефис, подчёркивание`)
          continue
        }
        if (!isValidSlug(slug)) {
          errors.push(`Строка ${lineNum}: slug «${slug}» — только латиница, цифры, дефис, подчёркивание`)
          continue
        }
        if (!isValidPrice(price)) {
          errors.push(`Строка ${lineNum}: цена «${row[4]}» должна быть числом 0–1000000`)
          continue
        }
        seenCategories.add(catSlug)
        if (seenSlugs.has(slug)) warnings.push(`Строка ${lineNum}: slug «${slug}» дублируется`)
        seenSlugs.add(slug)
        validRows.push(row)
      }

      const goodRatio = dataRows.length > 0 ? validRows.length / dataRows.length : 1
      if (goodRatio < 0.5) {
        errors.push(`Слишком много ошибок: валидных строк ${validRows.length} из ${dataRows.length}`)
      }

      return NextResponse.json({
        ok: true,
        valid: errors.length === 0,
        errors,
        warnings,
        stats: { categories: seenCategories.size, dishes: validRows.length },
      })
    }

    // store
    const validRows: string[][] = []
    const seenCategories = new Set<string>()
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i]
      const lineNum = i + 2
      const catSlug = (row[0] || '').trim().toLowerCase().replace(/\s+/g, '-') || 'uncat'
      const catName = (row[1] || '').trim() || catSlug
      const productName = (row[2] || '').trim()
      const productSlug = (row[3] || '').trim().toLowerCase().replace(/\s+/g, '-') || productName.toLowerCase().replace(/\s+/g, '-')
      const price = Number(row[6] ?? 0)

      if (!productName) {
        errors.push(`Строка ${lineNum}: нет названия товара`)
        continue
      }
      if (!isValidName(catName, 1, 100)) {
        errors.push(`Строка ${lineNum}: категория невалидна`)
        continue
      }
      if (!isValidName(productName)) {
        errors.push(`Строка ${lineNum}: название «${productName.slice(0, 20)}» невалидно`)
        continue
      }
      if (!isValidSlug(catSlug) || catSlug === 'uncat') {
        errors.push(`Строка ${lineNum}: category_slug невалиден`)
        continue
      }
      if (!isValidSlug(productSlug)) {
        errors.push(`Строка ${lineNum}: product_slug невалиден`)
        continue
      }
      if (!isValidPrice(price)) {
        errors.push(`Строка ${lineNum}: цена должна быть числом 0–1000000`)
        continue
      }
      seenCategories.add(catSlug)
      validRows.push(row)
    }

    const goodRatio = dataRows.length > 0 ? validRows.length / dataRows.length : 1
    if (goodRatio < 0.5) {
      errors.push(`Слишком много ошибок: валидных строк ${validRows.length} из ${dataRows.length}`)
    }

    const productSlugs = new Set(validRows.map((r) => (r[3] || '').trim().toLowerCase().replace(/\s+/g, '-')))
    return NextResponse.json({
      ok: true,
      valid: errors.length === 0,
      errors,
      warnings,
      stats: { categories: seenCategories.size, products: productSlugs.size, variants: validRows.length },
    })
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    return NextResponse.json({ ok: false, error: status === 403 ? 'forbidden' : 'Ошибка', valid: false }, { status })
  }
}
