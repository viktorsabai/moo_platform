'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { InlineCounter } from '@/components/ui/InlineCounter'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { EmojiCarousel } from '@/components/ui/EmojiCarousel'
import { ProductCard } from '@/components/ui/ProductCard'
import { telegramInitHeaderRecord } from '@/lib/tg-webapp-client'

type Category = { id: string; name: string; slug: string; order?: number }
type Variant = { id: string; name: string; sku?: string | null; price: number; qty: number; isActive: boolean }
type MenuOptionGroup = {
  id: string
  name: string
  isActive?: boolean
  values: Array<{ id: string; name: string; isActive?: boolean }>
}
type Product = {
  id: string
  name: string
  slug: string
  emoji?: string | null
  description?: string | null
  image?: string | null
  isActive: boolean
  categoryId?: string
  category?: { id: string; name: string }
  variants: Variant[]
}

const OWNER_STORE_CACHE_KEY = 'ufo:owner:store:v1'
const OWNER_STORE_CACHE_TTL_MS = 12 * 60 * 60 * 1000
const STORE_OPTION_TAG_PREFIX = 'opt:'

function getStoreOptionIdsFromTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return []
  return tags
    .map((t) => String(t || '').trim())
    .filter((t) => t.startsWith(STORE_OPTION_TAG_PREFIX))
    .map((t) => t.slice(STORE_OPTION_TAG_PREFIX.length))
    .filter(Boolean)
}

function mergeStoreOptionTags(existingTags: unknown, optionValueIds: string[]): string[] {
  const keep = Array.isArray(existingTags)
    ? existingTags
        .map((t) => String(t || '').trim())
        .filter((t) => t && !t.startsWith(STORE_OPTION_TAG_PREFIX))
    : []
  const optTags = [...new Set(optionValueIds.map((id) => `${STORE_OPTION_TAG_PREFIX}${String(id).trim()}`).filter(Boolean))]
  return [...keep, ...optTags].slice(0, 24)
}

function buildStoreOptionTags(optionValueIds: string[]): string[] {
  return [...new Set(optionValueIds.map((id) => `${STORE_OPTION_TAG_PREFIX}${String(id).trim()}`).filter(Boolean))].slice(0, 24)
}

function getOwnerStoreCacheStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    try {
      return window.sessionStorage
    } catch {
      return null
    }
  }
}

export function AdminStoreTab({ storeEnabled }: { storeEnabled: boolean }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [menuOptionGroups, setMenuOptionGroups] = useState<MenuOptionGroup[]>([])
  const [newCategoryName, setNewCategoryName] = useState('')

  const [newProduct, setNewProduct] = useState({
    name: '',
    emoji: '',
    image: '',
    categoryId: '',
    variantName: 'по умолчанию',
    price: 0,
    qty: 0,
    tags: [] as string[],
    autoHideIfZeroStock: true,
  })
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set())
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set())
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('')
  const [newVariantByProduct, setNewVariantByProduct] = useState<Record<string, { name: string; price: number; qty: number }>>({})
  const [newProductOptionValueIds, setNewProductOptionValueIds] = useState<string[]>([])
  const [editingProductById, setEditingProductById] = useState<Record<string, { name: string; categoryId: string; image: string; description: string; isActive: boolean; optionValueIds: string[] }>>({})
  const [editingVariantById, setEditingVariantById] = useState<Record<string, { name: string; price: number; qty: number }>>({})
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [savingCategoryId, setSavingCategoryId] = useState<string | null>(null)
  const [categoryDrafts, setCategoryDrafts] = useState<
    Record<string, { name: string; description: string; image: string; isActive: boolean; price: number; qty: number }>
  >({})
  const productImageInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const [draggingCategoryId, setDraggingCategoryId] = useState<string | null>(null)
  const [categoryOrderSaving, setCategoryOrderSaving] = useState(false)
  const [categoryOrderDirty, setCategoryOrderDirty] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ categories: number; products: number } | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportStatus, setExportStatus] = useState<{ ok: boolean; msg: string } | null>(null)
  const newProductFileInputRef = useRef<HTMLInputElement | null>(null)

  async function load(opts?: { preferCache?: boolean }) {
    const preferCache = opts?.preferCache !== false
    const cacheStorage = getOwnerStoreCacheStorage()
    const cachedRaw = cacheStorage?.getItem(OWNER_STORE_CACHE_KEY) ?? null
    let hasCachedData = false
    let freshCached = false
    if (preferCache && cachedRaw) {
      try {
        const cached = JSON.parse(cachedRaw) as { ts: number; categories: Category[]; products: Product[] }
        if (Array.isArray(cached.categories) && Array.isArray(cached.products)) {
          hasCachedData = true
          setCategories(cached.categories)
          setProducts(cached.products)
          setLoading(false)
          freshCached = Date.now() - Number(cached.ts || 0) < OWNER_STORE_CACHE_TTL_MS
        } else {
          setLoading(true)
        }
      } catch {
        setLoading(true)
      }
    } else {
      setLoading(true)
    }
    setError(null)
    if (freshCached) setLoading(false)
    try {
      const [res, optionsRes] = await Promise.all([
        fetch('/api/admin/store/products', { cache: 'default', credentials: 'include' }),
        fetch('/api/admin/menu/options', { cache: 'no-store', credentials: 'include' }),
      ])
      const data = await res.json().catch(() => null)
      const optionsData = await optionsRes.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        if (!hasCachedData) {
          setError(data?.error || 'не удалось загрузить')
          setProducts([])
          setCategories([])
        }
        return
      }
      setMenuOptionGroups(Array.isArray(optionsData?.groups) ? optionsData.groups : [])
      setCategories(Array.isArray(data.categories) ? data.categories : [])
      const nextProducts = Array.isArray(data.products) ? data.products : []
      setProducts(nextProducts)
      setEditingProductById((prev) => {
        const next: Record<string, { name: string; categoryId: string; image: string; description: string; isActive: boolean; optionValueIds: string[] }> = {}
        for (const p of nextProducts as Product[]) {
          next[p.id] = prev[p.id] ?? {
            name: p.name || '',
            categoryId: String(p.categoryId || p.category?.id || ''),
            image: String(p.image || ''),
            description: String(p.description || ''),
            isActive: p.isActive !== false,
            optionValueIds: getStoreOptionIdsFromTags((p as any).tags),
          }
        }
        return next
      })
      setEditingVariantById((prev) => {
        const next: Record<string, { name: string; price: number; qty: number }> = {}
        for (const p of nextProducts as Product[]) {
          for (const v of p.variants || []) {
            next[v.id] = prev[v.id] ?? {
              name: String(v.name || ''),
              price: Number(v.price || 0),
              qty: Number(v.qty || 0),
            }
          }
        }
        return next
      })
      if (cacheStorage) {
        cacheStorage.setItem(
          OWNER_STORE_CACHE_KEY,
          JSON.stringify({
            ts: Date.now(),
            categories: Array.isArray(data.categories) ? data.categories : [],
            products: Array.isArray(data.products) ? data.products : [],
          })
        )
      }
      setNewProduct((s) => ({
        ...s,
        categoryId: s.categoryId || (Array.isArray(data.categories) && data.categories[0]?.id ? data.categories[0].id : ''),
      }))
    } catch {
      if (!hasCachedData) setError('не удалось загрузить')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const canCreate = Boolean(newProduct.name.trim() && newProduct.categoryId)

  async function runImportCsv() {
    if (!importFile) return
    setImporting(true)
    setImportResult(null)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', importFile)
      form.append('type', 'store')
      const res = await fetch('/api/admin/import/csv', { method: 'POST', body: form, credentials: 'include' })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        setError(data?.error || 'не удалось импортировать')
        return
      }
      setImportResult({ categories: data.createdCategories ?? 0, products: data.createdProducts ?? 0 })
      setImportFile(null)
      await load()
    } catch {
      setError('не удалось импортировать')
    } finally {
      setImporting(false)
    }
  }

  const byCategory = useMemo(() => {
    const map = new Map<string, Product[]>()
    for (const p of products) {
      const key = p.category?.id || p.categoryId || 'uncat'
      map.set(key, [...(map.get(key) ?? []), p])
    }
    return map
  }, [products])

  const filteredCategories = useMemo(() => {
    if (!selectedCategoryFilter) return categories
    return categories.filter((c) => c.id === selectedCategoryFilter)
  }, [categories, selectedCategoryFilter])

  function startCategoryEdit(categoryId: string, list: Product[]) {
    const drafts: Record<string, { name: string; description: string; image: string; isActive: boolean; price: number; qty: number }> = {}
    for (const p of list) {
      drafts[p.id] = {
        name: String(p.name || ''),
        description: String(p.description || ''),
        image: String(p.image || ''),
        isActive: p.isActive !== false,
        price: Number(p.variants?.[0]?.price ?? 0),
        qty: Number(p.variants?.[0]?.qty ?? 0),
      }
    }
    setCategoryDrafts(drafts)
    setEditingCategoryId(categoryId)
  }

  function updateCategoryDraft(productId: string, patch: Partial<{ name: string; description: string; image: string; isActive: boolean; price: number; qty: number }>) {
    setCategoryDrafts((prev) => ({
      ...prev,
      [productId]: { ...(prev[productId] || { name: '', description: '', image: '', isActive: true, price: 0, qty: 0 }), ...patch },
    }))
  }

  async function saveCategoryEdit(categoryId: string, list: Product[]) {
    setSavingCategoryId(categoryId)
    try {
      for (const p of list) {
        const draft = categoryDrafts[p.id]
        if (!draft) continue
        await fetch('/api/admin/store/products', {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            id: p.id,
            name: draft.name.trim(),
            description: draft.description.trim() || null,
            image: draft.image.trim() || null,
            isActive: draft.isActive,
          }),
        })
        if (p.variants?.[0]?.id) {
          await fetch('/api/admin/store/variants', {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              id: p.variants[0].id,
              price: Number(draft.price || 0),
              qty: Math.max(0, Number(draft.qty || 0)),
            }),
          })
        }
      }
      await load({ preferCache: false })
      setEditingCategoryId(null)
      setCategoryDrafts({})
      toast.success('Категория сохранена')
    } catch {
      toast.error('Не удалось сохранить категорию')
    } finally {
      setSavingCategoryId(null)
    }
  }

  async function updateQty(variantId: string, nextQty: number) {
    const qty = Math.max(0, nextQty)
    setProducts((prev) =>
      prev.map((p) => ({
        ...p,
        variants: p.variants.map((v) => (v.id === variantId ? { ...v, qty } : v)),
      }))
    )
    try {
      const res = await fetch('/api/admin/store/variants', {
        credentials: 'include',
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: variantId, qty }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.ok) {
        toast.success('Остаток обновлён')
      } else {
        load()
      }
    } catch {
      load()
    }
  }

  async function deleteProduct(id: string) {
    if (!confirm('Удалить товар и все его варианты? Это нельзя отменить.')) return
    try {
      const res = await fetch(`/api/admin/store/products?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.ok) {
        await load()
        setSelectedProductIds((s) => { const n = new Set(s); n.delete(id); return n })
        toast.success('Товар удалён')
      } else {
        toast.error(data?.error || 'Не удалось удалить')
      }
    } catch {
      toast.error('Ошибка при удалении')
    }
  }

  async function deleteSelectedProducts() {
    const ids = Array.from(selectedProductIds)
    if (ids.length === 0) return
    if (!confirm(`Удалить выбранные товары (${ids.length})? Это нельзя отменить.`)) return
    try {
      const res = await fetch(
        `/api/admin/store/products?ids=${ids.map((id) => encodeURIComponent(id)).join(',')}`,
        { method: 'DELETE', credentials: 'include' }
      )
      const data = await res.json().catch(() => null)
      if (res.ok && data?.ok) {
        await load()
        setSelectedProductIds(new Set())
        toast.success(`Удалено товаров: ${data?.deleted ?? ids.length}`)
      } else {
        toast.error(data?.error || 'Не удалось удалить')
      }
    } catch {
      toast.error('Ошибка при удалении')
    }
  }

  async function deleteVariant(variantId: string) {
    if (!confirm('Удалить этот вариант?')) return
    try {
      const res = await fetch(`/api/admin/store/variants?id=${encodeURIComponent(variantId)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.ok) {
        await load()
        toast.success('Вариант удалён')
      } else {
        toast.error(data?.error || 'Не удалось удалить')
      }
    } catch {
      toast.error('Ошибка при удалении')
    }
  }

  async function updateVariantField(variantId: string, patch: { name?: string; price?: number; qty?: number }) {
    try {
      const res = await fetch('/api/admin/store/variants', {
        credentials: 'include',
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: variantId, ...patch }),
      })
      const data = await res.json().catch(() => null)
      if (!(res.ok && data?.ok)) {
        toast.error(data?.error || 'Не удалось сохранить вариант')
        await load()
      }
    } catch {
      toast.error('Ошибка при сохранении варианта')
      await load()
    }
  }

  async function createVariant(productId: string) {
    const draft = newVariantByProduct[productId] || { name: '', price: 0, qty: 0 }
    const name = String(draft.name || '').trim()
    if (!name) {
      toast.error('Введите название варианта')
      return
    }
    try {
      const res = await fetch('/api/admin/store/variants', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          productId,
          name,
          price: Number(draft.price || 0),
          qty: Number(draft.qty || 0),
        }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.ok) {
        setNewVariantByProduct((prev) => ({ ...prev, [productId]: { name: '', price: 0, qty: 0 } }))
        await load()
        toast.success('Вариант добавлен')
      } else {
        toast.error(data?.error || 'Не удалось добавить вариант')
      }
    } catch {
      toast.error('Ошибка при добавлении варианта')
    }
  }

  function toggleProductSelection(id: string) {
    setSelectedProductIds((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  function toggleCategorySelection(id: string) {
    setSelectedCategoryIds((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  async function updateCategory(id: string, patch: { name?: string; order?: number }) {
    try {
      const res = await fetch('/api/admin/store/categories', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, ...patch }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.ok) {
        await load()
        toast.success('Категория обновлена')
      } else {
        toast.error(data?.error || 'Не удалось сохранить')
      }
    } catch {
      toast.error('Ошибка при сохранении')
    }
  }

  async function createCategory() {
    const name = newCategoryName.trim()
    if (!name) return
    try {
      const res = await fetch('/api/admin/store/categories', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.ok) {
        setNewCategoryName('')
        await load()
        toast.success('Категория создана')
      } else {
        toast.error(data?.error || 'Не удалось создать категорию')
      }
    } catch {
      toast.error('Ошибка при создании категории')
    }
  }

  async function deleteCategory(id: string) {
    if (!confirm('Удалить категорию и все товары в ней? Нельзя отменить.')) return
    try {
      const res = await fetch(`/api/admin/store/categories?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.ok) {
        await load()
        setSelectedCategoryIds((s) => { const n = new Set(s); n.delete(id); return n })
        toast.success('Категория удалена')
      } else {
        toast.error(data?.error || 'Не удалось удалить')
      }
    } catch {
      toast.error('Ошибка при удалении')
    }
  }

  async function deleteSelectedCategories() {
    const ids = Array.from(selectedCategoryIds)
    if (ids.length === 0) return
    if (!confirm(`Удалить ${ids.length} категорий и все товары в них? Нельзя отменить.`)) return
    try {
      const res = await fetch(
        `/api/admin/store/categories?ids=${ids.map((id) => encodeURIComponent(id)).join(',')}`,
        { method: 'DELETE', credentials: 'include' }
      )
      const data = await res.json().catch(() => null)
      if (res.ok && data?.ok) {
        await load()
        setSelectedCategoryIds(new Set())
        toast.success(`Удалено категорий: ${data?.deleted ?? ids.length}`)
      } else {
        toast.error(data?.error || 'Не удалось удалить')
      }
    } catch {
      toast.error('Ошибка при удалении')
    }
  }

  function reorderCategories(list: Category[], fromId: string, toId: string) {
    const fromIndex = list.findIndex((c) => c.id === fromId)
    const toIndex = list.findIndex((c) => c.id === toId)
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return list
    const next = [...list]
    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)
    return next
  }

  async function saveCategoryOrder(nextCategories: Category[]) {
    setCategoryOrderSaving(true)
    try {
      await Promise.all(
        nextCategories.map((cat, idx) =>
          fetch('/api/admin/store/categories', {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id: cat.id, order: idx }),
          })
        )
      )
      setCategoryOrderDirty(false)
      toast.success('Порядок категорий сохранён')
      await load()
    } catch {
      toast.error('Не удалось сохранить порядок категорий')
      await load()
    } finally {
      setCategoryOrderSaving(false)
    }
  }

  async function createProduct() {
    if (!canCreate) return
    const name = newProduct.name.trim()
    if (!confirm(`Создать товар «${name}»?`)) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/store/products', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          emoji: newProduct.emoji.trim() || undefined,
          image: newProduct.image.trim() || undefined,
          categoryId: newProduct.categoryId,
          tags: [...newProduct.tags, ...buildStoreOptionTags(newProductOptionValueIds)],
          autoHideIfZeroStock: newProduct.autoHideIfZeroStock,
          variants: [{ name: newProduct.variantName.trim() || 'по умолчанию', price: newProduct.price, qty: newProduct.qty }],
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        setError(data?.error || 'не удалось создать товар')
        toast.error(data?.error || 'Не удалось создать')
        return
      }
      setNewProduct((s) => ({ ...s, name: '', emoji: '', image: '', price: 0, qty: 0, tags: [], autoHideIfZeroStock: true }))
      setNewProductOptionValueIds([])
      await load()
      toast.success('Товар создан')
    } catch {
      setError('не удалось создать товар')
      toast.error('Ошибка при создании')
    } finally {
      setLoading(false)
    }
  }

  async function uploadImage(file: File): Promise<string | null> {
    if (!file.type.startsWith('image/')) {
      toast.error('Выберите изображение')
      return null
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Размер файла до 8MB')
      return null
    }
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/admin/uploads/menu-image', {
        method: 'POST',
        credentials: 'include',
        body: form,
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok || typeof data?.url !== 'string') {
        toast.error(data?.error || 'Не удалось загрузить фото')
        return null
      }
      return data.url
    } catch {
      toast.error('Ошибка загрузки фото')
      return null
    }
  }

  async function saveProductPatch(productId: string) {
    const draft = editingProductById[productId]
    if (!draft) return
    try {
      const product = products.find((p) => p.id === productId)
      const res = await fetch('/api/admin/store/products', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: productId,
          name: draft.name.trim(),
          categoryId: draft.categoryId,
          image: draft.image.trim() || null,
          description: draft.description.trim() || null,
          isActive: draft.isActive !== false,
          tags: mergeStoreOptionTags(product?.tags, draft.optionValueIds || []),
        }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.ok) {
        await load({ preferCache: false })
        toast.success('Товар обновлён')
      } else {
        toast.error(data?.error || 'Не удалось обновить товар')
      }
    } catch {
      toast.error('Ошибка обновления товара')
    }
  }

  async function uploadProductImage(productId: string, file: File) {
    const url = await uploadImage(file)
    if (!url) return
    setEditingProductById((prev) => {
      const current = prev[productId] || { name: '', categoryId: '', image: '', description: '', isActive: true, optionValueIds: [] }
      return { ...prev, [productId]: { ...current, image: url } }
    })
    toast.success('Фото добавлено')
  }


  const cardClass = 'overflow-hidden border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] shadow-[var(--shadow-soft)] p-4'
  const cardRadius = { borderRadius: 'var(--radius-large)' } as const

  return (
    <div className="min-w-0 max-w-full overflow-x-hidden space-y-5">
      {!storeEnabled && (
        <div className="rounded-[18px] border border-amber-200 bg-amber-50/80 p-3 text-[13px] text-amber-900">
          Включите «Магазин» в настройках заведения, чтобы товары видели гости.
        </div>
      )}

      {/* CSV: выгрузка в бот и загрузка */}
      <details className={cn(cardClass, 'group')} style={cardRadius}>
        <summary className="flex cursor-pointer list-none items-center justify-between text-[13px] font-extrabold tracking-tight text-black/70 [&::-webkit-details-marker]:hidden">
          магазин (CSV)
          <span className="text-[11px] font-semibold text-[color:var(--muted)] group-open:hidden">показать</span>
          <span className="hidden text-[11px] font-semibold text-[color:var(--muted)] group-open:inline">скрыть</span>
        </summary>
        <p className="ui-muted mt-1 text-[12px]">
          Выгрузка — файл приходит в бот как сообщение. Загрузка — выберите CSV и нажмите «загрузить».
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={exporting}
            onClick={async () => {
              setExporting(true)
              setExportStatus(null)
              try {
                const res = await fetch('/api/admin/export/notify-bot?type=store', {
                  method: 'POST',
                  credentials: 'include',
                  headers: { ...telegramInitHeaderRecord() },
                })
                const data = await res.json().catch(() => null)
                if (data?.sent) {
                  if (data?.sentToCurrent === true) {
                    setExportStatus({ ok: true, msg: 'Файл отправлен в ваш бот-чат. Проверьте чат.' })
                    toast.success('Файл отправлен в ваш чат')
                  } else {
                    // File may be delivered to another owner/admin chat; download directly for current user.
                    const dl = await fetch('/api/admin/import/template?type=store&data=1', {
                      method: 'GET',
                      credentials: 'include',
                    })
                    if (dl.ok) {
                      const blob = await dl.blob()
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = 'store-export.csv'
                      document.body.appendChild(a)
                      a.click()
                      a.remove()
                      URL.revokeObjectURL(url)
                      try {
                        const directUrl = `${window.location.origin}/api/admin/import/template?type=store&data=1`
                        const tg = (window as any)?.Telegram?.WebApp
                        if (tg?.openLink) tg.openLink(directUrl)
                        else window.open(directUrl, '_blank', 'noopener,noreferrer')
                      } catch {
                        // ignore
                      }
                    }
                    const sentTo = Array.isArray(data?.sentTo) ? data.sentTo.join(', ') : ''
                    const msg = sentTo
                      ? `В ваш чат бот не доставил. Отправлено в: ${sentTo}. CSV скачан напрямую.`
                      : 'В ваш чат бот не доставил. CSV скачан напрямую.'
                    setExportStatus({ ok: true, msg })
                    toast.success('CSV скачан напрямую')
                  }
                } else {
                  // Fallback: direct CSV download from browser.
                  const dl = await fetch('/api/admin/import/template?type=store&data=1', {
                    method: 'GET',
                    credentials: 'include',
                  })
                  if (dl.ok) {
                    const blob = await dl.blob()
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = 'store-export.csv'
                    document.body.appendChild(a)
                    a.click()
                    a.remove()
                    URL.revokeObjectURL(url)
                    const msg = 'Бот недоступен — скачали CSV напрямую'
                    setExportStatus({ ok: true, msg })
                    toast.success(msg)
                  } else {
                    const err = data?.error || 'Не удалось выгрузить'
                    setExportStatus({ ok: false, msg: err })
                    toast.error(err)
                  }
                }
              } catch {
                const err = 'Ошибка сети'
                setExportStatus({ ok: false, msg: err })
                toast.error(err)
              } finally {
                setExporting(false)
              }
            }}
            className="btn btn-soft rounded-full py-2 px-4 text-[12px] font-semibold disabled:opacity-50"
            style={{ borderRadius: 'var(--radius-pill)' }}
          >
            {exporting ? 'отправка…' : 'выгрузить'}
          </button>
          <input
            type="file"
            accept=".csv,text/csv"
            className="text-[12px] file:mr-2 file:rounded-full file:border-0 file:bg-black/10 file:px-3 file:py-1.5 file:text-[12px] file:font-semibold"
            onChange={(e) => {
              setImportFile(e.target.files?.[0] ?? null)
              setImportResult(null)
            }}
          />
          <button
            type="button"
            onClick={runImportCsv}
            disabled={!importFile || importing}
            className="btn btn-soft rounded-full py-2 px-4 text-[12px] font-semibold disabled:opacity-50"
            style={{ borderRadius: 'var(--radius-pill)' }}
          >
            {importing ? 'загрузка…' : 'загрузить'}
          </button>
        </div>
        {exportStatus && (
          <p className={cn('mt-2 text-[12px]', exportStatus.ok ? 'text-green-700' : 'text-amber-700')}>
            {exportStatus.msg}
          </p>
        )}
        {importResult && (
          <p className="ui-muted mt-2 text-[12px]">
            Создано категорий: {importResult.categories}, товаров: {importResult.products}.
          </p>
        )}
      </details>

      <details className={cn(cardClass, 'group')} style={cardRadius}>
        <summary className="flex cursor-pointer list-none items-start justify-between gap-3 [&::-webkit-details-marker]:hidden">
          <div>
            <div className="text-[13px] font-extrabold tracking-tight text-black/70">опции товаров</div>
          </div>
          <span className="text-[11px] font-semibold text-[color:var(--muted)] group-open:hidden">показать</span>
          <span className="hidden text-[11px] font-semibold text-[color:var(--muted)] group-open:inline">скрыть</span>
        </summary>
        <div className="mt-2 rounded-xl border border-[color:var(--stroke)] bg-[color:var(--surface)] p-3">
          {menuOptionGroups.filter((group) => group.isActive !== false && group.values.some((v) => v.isActive !== false)).length === 0 ? (
            <p className="text-[12px] text-[color:var(--muted)]">
              Пока нет активных опций. Добавьте их в «Меню ресторана» → «опции».
            </p>
          ) : (
            <div className="space-y-2">
              {menuOptionGroups
                .filter((group) => group.isActive !== false && group.values.some((v) => v.isActive !== false))
                .map((group) => (
                  <div key={`store-top-group-${group.id}`}>
                    <div className="mb-1 text-[12px] font-semibold text-[color:var(--text)]">{group.name}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {group.values
                        .filter((v) => v.isActive !== false)
                        .map((value) => (
                          <span
                            key={`store-top-value-${value.id}`}
                            className="rounded-full bg-black/[0.06] px-2.5 py-1 text-[11px] font-semibold text-black/65"
                            style={{ borderRadius: 'var(--radius-pill)' }}
                          >
                            {value.name}
                          </span>
                        ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </details>

      <details className={cn(cardClass, 'group')} style={cardRadius}>
        <summary className="flex cursor-pointer list-none items-start justify-between gap-3 [&::-webkit-details-marker]:hidden">
          <div>
            <div className="text-[13px] font-extrabold tracking-tight text-black/70">добавить категорию</div>
          </div>
          <span className="text-[11px] font-semibold text-[color:var(--muted)] group-open:hidden">показать</span>
          <span className="hidden text-[11px] font-semibold text-[color:var(--muted)] group-open:inline">скрыть</span>
        </summary>
        <div className="mt-3 flex items-center gap-2">
          <input
            className="input input--pill h-9 max-w-[320px] text-[12px]"
            placeholder="новая категория"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
          />
          <button
            type="button"
            onClick={createCategory}
            disabled={!newCategoryName.trim()}
            className="rounded-full bg-[color:var(--accent)] px-3 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
            style={{ borderRadius: 'var(--radius-pill)' }}
          >
            добавить
          </button>
        </div>
      </details>

      <details
        id="admin-store-add"
        open={products.length === 0}
        className={cn('overflow-visible group', cardClass)}
        style={cardRadius}
      >
        <summary className="flex cursor-pointer list-none items-start justify-between gap-3 [&::-webkit-details-marker]:hidden">
          <div>
            <div className="text-[13px] font-extrabold tracking-tight text-black/70">добавить товар</div>
          </div>
          <span className="text-[11px] font-semibold text-[color:var(--muted)] group-open:hidden">показать</span>
          <span className="hidden text-[11px] font-semibold text-[color:var(--muted)] group-open:inline">скрыть</span>
        </summary>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-black/70">Название</label>
            <input
              className="input input--pill"
              placeholder="например: Вареники с картофелем"
              value={newProduct.name}
              onChange={(e) => setNewProduct((s) => ({ ...s, name: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-[12px] font-semibold text-black/50">Эмодзи (необязательно)</label>
            <EmojiCarousel
              value={newProduct.emoji || null}
              onChange={(emoji) => setNewProduct((s) => ({ ...s, emoji }))}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-[12px] font-semibold text-black/70">Фото</label>
            <input
              ref={newProductFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                const url = await uploadImage(file)
                if (url) {
                  setNewProduct((s) => ({ ...s, image: url }))
                  toast.success('Фото добавлено')
                }
                e.currentTarget.value = ''
              }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => newProductFileInputRef.current?.click()}
                className="rounded-full bg-black/[0.06] px-4 py-2.5 text-[13px] font-semibold text-black/70"
                style={{ borderRadius: 'var(--radius-pill)' }}
              >
                {newProduct.image ? 'заменить фото' : 'добавить фото'}
              </button>
              {newProduct.image ? (
                <button
                  type="button"
                  onClick={() => setNewProduct((s) => ({ ...s, image: '' }))}
                  className="rounded-full bg-red-50 px-4 py-2.5 text-[13px] font-semibold text-red-700"
                  style={{ borderRadius: 'var(--radius-pill)' }}
                >
                  убрать фото
                </button>
              ) : null}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-black/70">Категория</label>
            <CustomSelect
              value={newProduct.categoryId}
              onChange={(v) => setNewProduct((s) => ({ ...s, categoryId: v }))}
              placeholder="— выбрать —"
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-black/70">Базовый вариант (для цены/остатка)</label>
            <input
              className="input input--pill"
              placeholder="500 г или по умолчанию"
              value={newProduct.variantName}
              onChange={(e) => setNewProduct((s) => ({ ...s, variantName: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-black/70">Цена (฿)</label>
            <input
              className="input input--pill"
              placeholder="например 159"
              inputMode="numeric"
              value={String(newProduct.price)}
              onChange={(e) => setNewProduct((s) => ({ ...s, price: Number(e.target.value || 0) }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-black/70">Остаток (шт)</label>
            <input
              className="input input--pill"
              placeholder="0"
              inputMode="numeric"
              value={String(newProduct.qty)}
              onChange={(e) => setNewProduct((s) => ({ ...s, qty: Number(e.target.value || 0) }))}
            />
          </div>
          <div className="sm:col-span-2 flex items-center gap-2">
            <label className="flex cursor-pointer items-center gap-2 text-[12px] font-semibold text-black/70">
              <input
                type="checkbox"
                checked={newProduct.autoHideIfZeroStock}
                onChange={(e) => setNewProduct((s) => ({ ...s, autoHideIfZeroStock: e.target.checked }))}
              />
              Не показывать в магазине при нулевом остатке
            </label>
          </div>
          <div className="sm:col-span-2 rounded-2xl border border-[color:var(--stroke)] bg-[color:var(--surface)] p-3">
            <div className="mb-1 text-[12px] font-semibold text-[color:var(--text)]">опции (как в меню)</div>
            {menuOptionGroups.filter((group) => group.isActive !== false && group.values.some((v) => v.isActive !== false)).length === 0 ? (
              <p className="text-[11px] text-[color:var(--muted)]">—</p>
            ) : (
              <div className="space-y-2">
                {menuOptionGroups
                  .filter((group) => group.isActive !== false && group.values.some((v) => v.isActive !== false))
                  .map((group) => (
                    <div key={`new-product-group-${group.id}`}>
                      <div className="mb-1 text-[11px] font-semibold text-[color:var(--muted)]">{group.name}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {group.values
                          .filter((v) => v.isActive !== false)
                          .map((value) => {
                            const selected = newProductOptionValueIds.includes(value.id)
                            return (
                              <button
                                key={`new-product-value-${value.id}`}
                                type="button"
                                onClick={() =>
                                  setNewProductOptionValueIds((prev) => {
                                    const setIds = new Set(prev)
                                    if (setIds.has(value.id)) setIds.delete(value.id)
                                    else setIds.add(value.id)
                                    return Array.from(setIds)
                                  })
                                }
                                className={cn(
                                  'rounded-full px-2.5 py-1 text-[11px] font-semibold transition',
                                  selected ? 'bg-[color:var(--accent)] text-white' : 'bg-black/[0.06] text-black/65'
                                )}
                                style={{ borderRadius: 'var(--radius-pill)' }}
                              >
                                {value.name}
                              </button>
                            )
                          })}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={createProduct}
          disabled={!canCreate || loading}
          className="btn btn-primary mt-4 w-full rounded-full py-2.5 text-[13px] font-semibold disabled:opacity-50"
          style={{ borderRadius: 'var(--radius-pill)' }}
        >
          сохранить
        </button>
        {error ? <div className="mt-2 text-[12px] font-semibold text-red-600">{error}</div> : null}
      </details>

      {/* Категории и товары по категориям */}
      {categories.length > 0 && (
        <div
          className="rounded-2xl border border-[color:var(--stroke)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-soft)]"
          style={{ borderRadius: 'var(--radius-large)' }}
        >
            <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-[12px] font-semibold text-[color:var(--muted)]">категории</div>
            <div className="text-[11px] text-[color:var(--muted)]">
              {categoryOrderSaving ? 'сохраняем порядок…' : 'зажмите и перетащите'}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedCategoryFilter('')}
              className={cn(
                'shrink-0 inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold transition active:scale-[0.98]',
                !selectedCategoryFilter
                  ? 'bg-[color:var(--accent)] text-white'
                  : 'border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] text-[color:var(--text)]'
              )}
              style={{ borderRadius: 'var(--radius-pill)' }}
            >
              все
            </button>
            {categories.map((cat) => (
              <div
                key={cat.id}
                className={cn('flex items-center gap-1', draggingCategoryId === cat.id && 'opacity-70')}
                onPointerEnter={() => {
                  if (!draggingCategoryId || draggingCategoryId === cat.id || categoryOrderSaving) return
                  setCategories((prev) => reorderCategories(prev, draggingCategoryId, cat.id))
                  setCategoryOrderDirty(true)
                }}
                onPointerUp={async () => {
                  if (!draggingCategoryId) return
                  setDraggingCategoryId(null)
                  if (categoryOrderDirty) await saveCategoryOrder(categories)
                }}
              >
                <button
                  type="button"
                  onPointerDown={() => setDraggingCategoryId(cat.id)}
                  onPointerCancel={() => setDraggingCategoryId(null)}
                  onClick={() => {
                    if (draggingCategoryId) return
                    setSelectedCategoryFilter(selectedCategoryFilter === cat.id ? '' : cat.id)
                  }}
                  className={cn(
                    'shrink-0 inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold transition active:scale-[0.98] cursor-grab active:cursor-grabbing',
                    selectedCategoryFilter === cat.id
                      ? 'bg-[color:var(--accent)] text-white'
                      : 'border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] text-[color:var(--text)]'
                  )}
                  style={{ borderRadius: 'var(--radius-pill)' }}
                >
                  {cat.name}
                  <span className="text-[11px] opacity-75">({byCategory.get(cat.id)?.length ?? 0})</span>
                </button>
                <button
                  type="button"
                  onClick={() => deleteCategory(cat.id)}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-black/40 transition hover:bg-red-50 hover:text-red-600"
                  aria-label={`удалить ${cat.name}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[13px] font-extrabold tracking-tight text-black/70">товары по категориям</span>
          {(selectedProductIds.size > 0 || selectedCategoryIds.size > 0) && (
            <div className="flex gap-2">
              {selectedCategoryIds.size > 0 && (
                <button
                  type="button"
                  onClick={deleteSelectedCategories}
                  className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-[12px] font-semibold text-red-700 transition active:opacity-80"
                  style={{ borderRadius: 'var(--radius-pill)' }}
                >
                  × категории ({selectedCategoryIds.size})
                </button>
              )}
              {selectedProductIds.size > 0 && (
                <button
                  type="button"
                  onClick={deleteSelectedProducts}
                  className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-[12px] font-semibold text-red-700 transition active:opacity-80"
                  style={{ borderRadius: 'var(--radius-pill)' }}
                >
                  × товары ({selectedProductIds.size})
                </button>
              )}
            </div>
          )}
        </div>
        
        {loading ? (
          <div className={cardClass} style={cardRadius}>
            <span className="ui-muted text-[13px]">загрузка…</span>
          </div>
        ) : products.length === 0 ? (
          <div className={cardClass} style={cardRadius}>
            <p className="ui-muted text-[13px]">Пока нет товаров. Добавьте первый выше.</p>
            <button
              type="button"
              onClick={() => document.getElementById('admin-store-add')?.scrollIntoView({ behavior: 'smooth' })}
              className="btn btn-primary mt-4 rounded-full px-6 py-2.5 text-[13px] font-semibold"
              style={{ borderRadius: 'var(--radius-pill)' }}
            >
              Добавить товар
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {(filteredCategories.length ? filteredCategories : categories.length ? categories : [{ id: 'uncat', name: 'прочее', slug: 'uncat', order: 0 }]).map((cat) => {
              const list = byCategory.get(cat.id) ?? []
              if (!list.length) return null
              return (
                <div key={cat.id} className={cardClass} style={cardRadius}>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedCategoryIds.has(cat.id)}
                        onChange={() => toggleCategorySelection(cat.id)}
                        className="h-4 w-4 shrink-0 accent-[color:var(--accent)]"
                      />
                      <span className="text-[10px] font-semibold text-[color:var(--muted)]" title="Порядок в списке">
                        №
                      </span>
                      <input
                        type="number"
                        min={0}
                        key={`${cat.id}-${(cat as Category).order ?? 0}`}
                        defaultValue={(cat as Category).order ?? 0}
                        className="input input--pill w-14 shrink-0 py-1 text-center text-[12px] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        title="Порядок"
                        onBlur={(e) => {
                          const v = Number((e.target as HTMLInputElement).value)
                          if (Number.isFinite(v) && v !== ((cat as Category).order ?? 0)) updateCategory(cat.id, { order: v })
                        }}
                      />
                      <input
                        key={`store-cat-name-${cat.id}-${cat.name}`}
                        className="input input--pill min-w-0 max-w-[min(100%,240px)] text-[13px] font-extrabold tracking-tight text-[color:var(--text)]"
                        defaultValue={cat.name}
                        title="Название категории"
                        onBlur={(e) => {
                          const v = (e.target as HTMLInputElement).value.trim()
                          if (v && v !== cat.name) void updateCategory(cat.id, { name: v })
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (editingCategoryId === cat.id) {
                            setEditingCategoryId(null)
                            setCategoryDrafts({})
                            return
                          }
                          startCategoryEdit(cat.id, list)
                        }}
                        className={cn(
                          'rounded-full px-3 py-1.5 text-[11px] font-semibold transition',
                          editingCategoryId === cat.id
                            ? 'bg-black text-white'
                            : 'border border-[color:var(--stroke)] bg-[color:var(--surface)] text-[color:var(--text)]'
                        )}
                        style={{ borderRadius: 'var(--radius-pill)' }}
                      >
                        массово
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteCategory(cat.id)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[color:var(--stroke)] text-[16px] leading-none text-[color:var(--muted)] transition hover:bg-red-50 hover:border-red-200 hover:text-red-600"
                        aria-label="удалить категорию"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  {editingCategoryId === cat.id && (
                    <div className="mb-3 flex items-center justify-between rounded-2xl border border-[color:var(--stroke)] bg-[color:var(--surface)] p-3">
                      <div className="text-[12px] font-semibold text-[color:var(--muted)]">массовое редактирование категории</div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={savingCategoryId === cat.id}
                          onClick={() => saveCategoryEdit(cat.id, list)}
                          className="btn btn-primary rounded-full px-4 py-2 text-[12px] font-semibold disabled:opacity-50"
                          style={{ borderRadius: 'var(--radius-pill)' }}
                        >
                          {savingCategoryId === cat.id ? 'сохраняю…' : 'сохранить категорию'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCategoryId(null)
                            setCategoryDrafts({})
                          }}
                          className="btn btn-soft rounded-full px-4 py-2 text-[12px] font-semibold"
                          style={{ borderRadius: 'var(--radius-pill)' }}
                        >
                          отмена
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="overflow-x-auto pb-2 [scrollbar-width:thin] [-webkit-overflow-scrolling:touch]">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {list.map((p) => (
                      <div
                        key={p.id}
                        className="flex w-full flex-col gap-2 rounded-xl border border-[color:var(--stroke)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-soft)]"
                        style={{ borderRadius: 'var(--radius-medium)' }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedProductIds.has(p.id)}
                              onChange={() => toggleProductSelection(p.id)}
                              className="mt-0.5 h-4 w-4 shrink-0 accent-[color:var(--accent)]"
                            />
                            <span className="text-[14px] font-semibold text-black/90">
                              {p.emoji ? <span className="mr-1.5">{p.emoji}</span> : null}
                              {p.name}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => deleteProduct(p.id)}
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-black/10 text-[14px] leading-none text-black/45 transition hover:bg-red-50 hover:border-red-200 hover:text-red-600"
                            aria-label="удалить"
                          >
                            ×
                          </button>
                        </div>
                        {editingCategoryId === cat.id && categoryDrafts[p.id] ? (
                          <div className="space-y-3">
                            <input
                              className="input input--pill w-full text-[12px]"
                              value={categoryDrafts[p.id].name}
                              onChange={(e) => updateCategoryDraft(p.id, { name: e.target.value })}
                              placeholder="Название"
                            />
                            <input
                              className="input input--pill w-full text-[12px]"
                              value={categoryDrafts[p.id].description}
                              onChange={(e) => updateCategoryDraft(p.id, { description: e.target.value })}
                              placeholder="Описание"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                className="input input--pill text-[12px]"
                                inputMode="decimal"
                                value={String(categoryDrafts[p.id].price)}
                                onChange={(e) => updateCategoryDraft(p.id, { price: Number(e.target.value || 0) })}
                                placeholder="Цена"
                              />
                              <input
                                className="input input--pill text-[12px]"
                                inputMode="numeric"
                                value={String(categoryDrafts[p.id].qty)}
                                onChange={(e) => updateCategoryDraft(p.id, { qty: Number(e.target.value || 0) })}
                                placeholder="Остаток"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => updateCategoryDraft(p.id, { isActive: !categoryDrafts[p.id].isActive })}
                              className={cn(
                                'rounded-full px-3 py-2 text-[12px] font-semibold transition',
                                categoryDrafts[p.id].isActive ? 'bg-black text-white' : 'bg-black/[0.06] text-black/55'
                              )}
                              style={{ borderRadius: 'var(--radius-pill)' }}
                            >
                              доступно
                            </button>
                          </div>
                        ) : (
                        <div className="space-y-2">
                          <details className="rounded-2xl border border-[color:var(--stroke)] bg-[color:var(--surface)] p-3">
                            <summary className="cursor-pointer list-none text-[12px] font-semibold text-[color:var(--text)] [&::-webkit-details-marker]:hidden">
                              редактирование товара
                            </summary>
                            <div className="mt-2 space-y-3">
                              <div>
                                <ProductCard
                                  id={p.id}
                                  name={editingProductById[p.id]?.name ?? p.name}
                                  description={editingProductById[p.id]?.description ?? p.description}
                                  price={Number(p.variants?.[0]?.price ?? 0)}
                                  image={editingProductById[p.id]?.image ?? p.image}
                                  isAvailable={editingProductById[p.id]?.isActive ?? p.isActive}
                                  variant="full"
                                  kind="shop"
                                  categoryIcon={p.emoji || '🛒'}
                                  previewMode
                                  onImageClick={() => productImageInputRefs.current[p.id]?.click()}
                                  imageClickHint="сменить фото"
                                  hideSecondaryLine
                                />
                                <input
                                  ref={(el) => {
                                    productImageInputRefs.current[p.id] = el
                                  }}
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0]
                                    if (!file) return
                                    await uploadProductImage(p.id, file)
                                    e.currentTarget.value = ''
                                  }}
                                />
                              </div>
                              <div className="space-y-3">
                                <div className="flex items-start justify-between gap-2">
                                  <span className="text-[12px] font-semibold text-[color:var(--muted)]">параметры</span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      const details = e.currentTarget.closest('details')
                                      if (details && details instanceof HTMLDetailsElement) details.open = false
                                    }}
                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/10 text-[16px] leading-none text-black/50 transition hover:bg-black/5 active:opacity-70"
                                    aria-label="закрыть"
                                  >
                                    ×
                                  </button>
                                </div>
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                  <input
                                    className="input input--pill w-full text-[12px] sm:col-span-2"
                                    placeholder="Название"
                                    value={editingProductById[p.id]?.name ?? p.name}
                                    onChange={(e) =>
                                      setEditingProductById((prev) => ({
                                        ...prev,
                                        [p.id]: { ...(prev[p.id] || { name: p.name, categoryId: String(p.categoryId || ''), image: String(p.image || ''), description: String(p.description || ''), isActive: p.isActive !== false, optionValueIds: getStoreOptionIdsFromTags((p as any).tags) }), name: e.target.value },
                                      }))
                                    }
                                  />
                                  <div className="sm:col-span-2">
                                    <label className="mb-1 block text-[11px] font-semibold text-black/50">Категория</label>
                                    <CustomSelect
                                      value={editingProductById[p.id]?.categoryId ?? String(p.categoryId || '')}
                                      onChange={(v) =>
                                        setEditingProductById((prev) => ({
                                          ...prev,
                                          [p.id]: { ...(prev[p.id] || { name: p.name, categoryId: String(p.categoryId || ''), image: String(p.image || ''), description: String(p.description || ''), isActive: p.isActive !== false, optionValueIds: getStoreOptionIdsFromTags((p as any).tags) }), categoryId: v },
                                        }))
                                      }
                                      placeholder="— категория —"
                                      options={categories.map((c) => ({ value: c.id, label: c.name }))}
                                    />
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] font-semibold uppercase text-black/45">цена</span>
                                      <input
                                        className="input input--pill h-8 w-20 text-center text-[12px]"
                                        inputMode="decimal"
                                        value={String(editingVariantById[p.variants?.[0]?.id || '']?.price ?? Number(p.variants?.[0]?.price ?? 0))}
                                        onChange={(e) => {
                                          const first = p.variants?.[0]
                                          if (!first) return
                                          setEditingVariantById((prev) => ({
                                            ...prev,
                                            [first.id]: { ...(prev[first.id] || { name: first.name, price: Number(first.price || 0), qty: Number(first.qty || 0) }), price: Number(e.target.value || 0) },
                                          }))
                                        }}
                                      />
                                    </div>
                                    {p.variants?.[0] ? (
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-semibold uppercase text-black/45">остаток</span>
                                        <InlineCounter
                                          value={Number(p.variants?.[0]?.qty ?? 0)}
                                          onDec={() => updateQty(p.variants[0].id, Math.max(0, Number(p.variants?.[0]?.qty ?? 0) - 1))}
                                          onInc={() => updateQty(p.variants[0].id, Number(p.variants?.[0]?.qty ?? 0) + 1)}
                                        />
                                      </div>
                                    ) : null}
                                    {p.variants?.[0] ? (
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          const first = p.variants?.[0]
                                          if (!first) return
                                          const draft = editingVariantById[first.id]
                                          if (!draft) return
                                          await updateVariantField(first.id, { price: Number(draft.price || 0) })
                                          await load({ preferCache: false })
                                          toast.success('Цена сохранена')
                                        }}
                                        className="rounded-full border border-[color:var(--stroke)] px-3 py-2 text-[11px] font-semibold text-[color:var(--text)] transition hover:bg-black/5"
                                        style={{ borderRadius: 'var(--radius-pill)' }}
                                      >
                                        сохранить цену
                                      </button>
                                    ) : null}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setEditingProductById((prev) => ({
                                          ...prev,
                                          [p.id]: { ...(prev[p.id] || { name: p.name, categoryId: String(p.categoryId || ''), image: String(p.image || ''), description: String(p.description || ''), isActive: p.isActive !== false, optionValueIds: getStoreOptionIdsFromTags((p as any).tags) }), isActive: !(prev[p.id]?.isActive ?? p.isActive !== false) },
                                        }))
                                      }
                                      className={cn(
                                        'rounded-full px-3 py-2 text-[12px] font-semibold transition',
                                        (editingProductById[p.id]?.isActive ?? p.isActive !== false) ? 'bg-black text-white' : 'bg-black/[0.06] text-black/55'
                                      )}
                                      style={{ borderRadius: 'var(--radius-pill)' }}
                                    >
                                      доступно
                                    </button>
                                  </div>
                                  <input
                                    className="input input--pill w-full text-[12px] sm:col-span-2"
                                    placeholder="Описание"
                                    value={editingProductById[p.id]?.description ?? String(p.description || '')}
                                    onChange={(e) =>
                                      setEditingProductById((prev) => ({
                                        ...prev,
                                        [p.id]: { ...(prev[p.id] || { name: p.name, categoryId: String(p.categoryId || ''), image: String(p.image || ''), description: String(p.description || ''), isActive: p.isActive !== false, optionValueIds: getStoreOptionIdsFromTags((p as any).tags) }), description: e.target.value },
                                      }))
                                    }
                                  />
                                </div>
                                <details className="rounded-2xl border border-[color:var(--stroke)] bg-[color:var(--surface)] p-3">
                                  <summary className="flex cursor-pointer list-none items-center justify-between text-[12px] font-semibold text-[color:var(--text)] [&::-webkit-details-marker]:hidden">
                                    <span>медиа и форма</span>
                                    <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] text-black/65">авто</span>
                                  </summary>
                                  <p className="mt-2 text-[11px] text-[color:var(--muted)]">
                                    Тап по фото в превью, чтобы заменить изображение
                                  </p>
                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => productImageInputRefs.current[p.id]?.click()}
                                      className="rounded-full bg-black/[0.06] px-3 py-1.5 text-[11px] font-semibold text-black/70"
                                      style={{ borderRadius: 'var(--radius-pill)' }}
                                    >
                                      {(editingProductById[p.id]?.image ?? String(p.image || '')) ? 'заменить фото' : 'добавить фото'}
                                    </button>
                                    {(editingProductById[p.id]?.image ?? String(p.image || '')) ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setEditingProductById((prev) => ({
                                            ...prev,
                                            [p.id]: { ...(prev[p.id] || { name: p.name, categoryId: String(p.categoryId || ''), image: String(p.image || ''), description: String(p.description || ''), isActive: p.isActive !== false, optionValueIds: getStoreOptionIdsFromTags((p as any).tags) }), image: '' },
                                          }))
                                        }
                                        className="rounded-full bg-red-50 px-3 py-1.5 text-[11px] font-semibold text-red-700"
                                        style={{ borderRadius: 'var(--radius-pill)' }}
                                      >
                                        убрать фото
                                      </button>
                                    ) : null}
                                  </div>
                                  <input
                                    className="input input--pill mt-2 h-8 w-full text-[12px]"
                                    placeholder="URL фото"
                                    value={editingProductById[p.id]?.image ?? String(p.image || '')}
                                    onChange={(e) =>
                                      setEditingProductById((prev) => ({
                                        ...prev,
                                        [p.id]: { ...(prev[p.id] || { name: p.name, categoryId: String(p.categoryId || ''), image: String(p.image || ''), description: String(p.description || ''), isActive: p.isActive !== false, optionValueIds: getStoreOptionIdsFromTags((p as any).tags) }), image: e.target.value },
                                      }))
                                    }
                                  />
                                </details>
                                <div className="rounded-2xl border border-[color:var(--stroke)] bg-[color:var(--surface)] p-3">
                                  <div className="flex items-center justify-between gap-2">
                                    <div>
                                      <div className="text-[12px] font-semibold text-[color:var(--text)]">опции</div>
                                      <p className="mt-0.5 text-[11px] text-[color:var(--muted)]">
                                        выбрано: {(editingProductById[p.id]?.optionValueIds ?? []).length}
                                      </p>
                                    </div>
                                    <button
                                      type="button"
                                      className="btn btn-soft rounded-full px-3 py-1.5 text-[11px] font-semibold"
                                      style={{ borderRadius: 'var(--radius-pill)' }}
                                      onClick={() => {
                                        const el = document.getElementById(`store-option-picker-${p.id}`) as HTMLDetailsElement | null
                                        if (el) el.open = true
                                        el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                                      }}
                                    >
                                      настроить
                                    </button>
                                  </div>
                                  <details id={`store-option-picker-${p.id}`} className="mt-2">
                                    <summary className="cursor-pointer list-none text-[11px] font-semibold text-[color:var(--muted)] [&::-webkit-details-marker]:hidden">
                                      выбрать значения опций
                                    </summary>
                                    <div className="mt-2 space-y-2">
                                      {menuOptionGroups.filter((group) => group.isActive !== false && group.values.some((v) => v.isActive !== false)).length === 0 ? (
                                        <p className="text-[11px] text-[color:var(--muted)]">
                                          Сначала добавьте группы и значения в блоке «опции блюд» в меню ресторана.
                                        </p>
                                      ) : (
                                        menuOptionGroups
                                          .filter((group) => group.isActive !== false && group.values.some((v) => v.isActive !== false))
                                          .map((group) => (
                                            <div key={`store-opt-group-${p.id}-${group.id}`}>
                                              <div className="mb-1 text-[11px] font-semibold text-[color:var(--muted)]">{group.name}</div>
                                              <div className="flex flex-wrap gap-1.5">
                                                {group.values
                                                  .filter((v) => v.isActive !== false)
                                                  .map((value) => {
                                                    const selected = (editingProductById[p.id]?.optionValueIds ?? []).includes(value.id)
                                                    return (
                                                      <button
                                                        key={`store-opt-val-${p.id}-${value.id}`}
                                                        type="button"
                                                        onClick={() => {
                                                          setEditingProductById((prev) => {
                                                            const current = prev[p.id] || { name: p.name, categoryId: String(p.categoryId || ''), image: String(p.image || ''), description: String(p.description || ''), isActive: p.isActive !== false, optionValueIds: getStoreOptionIdsFromTags((p as any).tags) }
                                                            const setIds = new Set(current.optionValueIds || [])
                                                            if (setIds.has(value.id)) setIds.delete(value.id)
                                                            else setIds.add(value.id)
                                                            return {
                                                              ...prev,
                                                              [p.id]: { ...current, optionValueIds: Array.from(setIds) },
                                                            }
                                                          })
                                                        }}
                                                        className={cn(
                                                          'rounded-full px-2.5 py-1 text-[11px] font-semibold transition',
                                                          selected ? 'bg-[color:var(--accent)] text-white' : 'bg-black/[0.06] text-black/65'
                                                        )}
                                                        style={{ borderRadius: 'var(--radius-pill)' }}
                                                      >
                                                        {value.name}
                                                      </button>
                                                    )
                                                  })}
                                              </div>
                                            </div>
                                          ))
                                      )}
                                    </div>
                                  </details>
                                </div>
                              </div>
                              <div className="flex gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => saveProductPatch(p.id)}
                                  className="btn btn-primary flex-1 rounded-full py-2 text-[12px] font-semibold"
                                  style={{ borderRadius: 'var(--radius-pill)' }}
                                >
                                  сохранить
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    const details = e.currentTarget.closest('details')
                                    if (details && details instanceof HTMLDetailsElement) details.open = false
                                  }}
                                  className="btn btn-soft rounded-full py-2 px-4 text-[12px] font-semibold"
                                  style={{ borderRadius: 'var(--radius-pill)' }}
                                >
                                  закрыть
                                </button>
                              </div>
                            </div>
                          </details>

                          <details className="rounded-2xl border border-[color:var(--stroke)] bg-[color:var(--surface)] p-3" open>
                            <summary className="cursor-pointer list-none text-[12px] font-semibold text-[color:var(--text)] [&::-webkit-details-marker]:hidden">
                              опции
                            </summary>
                            <div className="mt-2 space-y-2">
                              {p.variants.map((v) => (
                                <div
                                  key={v.id}
                                  className="flex items-center justify-between gap-3 rounded-lg bg-white/60 px-3 py-2"
                                  style={{ borderRadius: 'var(--radius-small)' }}
                                >
                                  <div className="min-w-0 flex-1">
                                    <input
                                      className="input input--pill h-8 w-full text-[12px] font-medium"
                                      value={editingVariantById[v.id]?.name ?? v.name}
                                      onChange={(e) =>
                                        setEditingVariantById((prev) => ({
                                          ...prev,
                                          [v.id]: { ...(prev[v.id] || { name: v.name, price: Number(v.price || 0), qty: Number(v.qty || 0) }), name: e.target.value },
                                        }))
                                      }
                                    />
                                    <div className="mt-1 flex items-center gap-2">
                                      <input
                                        className="input input--pill h-8 w-20 text-[12px]"
                                        inputMode="decimal"
                                        value={String(editingVariantById[v.id]?.price ?? Number(v.price || 0))}
                                        onChange={(e) =>
                                          setEditingVariantById((prev) => ({
                                            ...prev,
                                            [v.id]: { ...(prev[v.id] || { name: v.name, price: Number(v.price || 0), qty: Number(v.qty || 0) }), price: Number(e.target.value || 0) },
                                          }))
                                        }
                                      />
                                      <span className="text-[11px] text-black/50">฿ · {v.isActive ? 'активен' : 'скрыт'}</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <InlineCounter
                                      value={v.qty}
                                      onDec={() => updateQty(v.id, Math.max(0, v.qty - 1))}
                                      onInc={() => updateQty(v.id, v.qty + 1)}
                                    />
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        const draft = editingVariantById[v.id] || { name: v.name, price: Number(v.price || 0), qty: Number(v.qty || 0) }
                                        const nextName = String(draft.name || '').trim()
                                        const nextPrice = Number(draft.price || 0)
                                        if (!nextName) {
                                          toast.error('Название варианта не может быть пустым')
                                          return
                                        }
                                        await updateVariantField(v.id, { name: nextName, price: nextPrice })
                                        await load({ preferCache: false })
                                        toast.success('Вариант сохранён')
                                      }}
                                      className="rounded-full border border-[color:var(--stroke)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--text)] transition hover:bg-black/5"
                                      style={{ borderRadius: 'var(--radius-pill)' }}
                                    >
                                      сохранить
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => deleteVariant(v.id)}
                                      className="rounded p-1 text-black/40 transition hover:bg-red-100 hover:text-red-600"
                                      aria-label="удалить вариант"
                                      title="Удалить вариант"
                                    >
                                      ×
                                    </button>
                                  </div>
                                </div>
                              ))}
                              <div
                                className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-[color:var(--stroke)] bg-white/60 px-3 py-2"
                                style={{ borderRadius: 'var(--radius-small)' }}
                              >
                                <input
                                  className="input input--pill h-8 min-w-0 flex-1 text-[12px]"
                                  placeholder="новый вариант"
                                  value={newVariantByProduct[p.id]?.name || ''}
                                  onChange={(e) =>
                                    setNewVariantByProduct((prev) => ({
                                      ...prev,
                                      [p.id]: { ...(prev[p.id] || { name: '', price: 0, qty: 0 }), name: e.target.value },
                                    }))
                                  }
                                />
                                <input
                                  className="input input--pill h-8 w-20 text-[12px]"
                                  inputMode="decimal"
                                  placeholder="цена"
                                  value={String(newVariantByProduct[p.id]?.price ?? 0)}
                                  onChange={(e) =>
                                    setNewVariantByProduct((prev) => ({
                                      ...prev,
                                      [p.id]: { ...(prev[p.id] || { name: '', price: 0, qty: 0 }), price: Number(e.target.value || 0) },
                                    }))
                                  }
                                />
                                <input
                                  className="input input--pill h-8 w-16 text-[12px]"
                                  inputMode="numeric"
                                  placeholder="qty"
                                  value={String(newVariantByProduct[p.id]?.qty ?? 0)}
                                  onChange={(e) =>
                                    setNewVariantByProduct((prev) => ({
                                      ...prev,
                                      [p.id]: { ...(prev[p.id] || { name: '', price: 0, qty: 0 }), qty: Number(e.target.value || 0) },
                                    }))
                                  }
                                />
                                <button
                                  type="button"
                                  onClick={() => createVariant(p.id)}
                                  className="rounded-full bg-[color:var(--accent)] px-3 py-1.5 text-[11px] font-semibold text-white"
                                  style={{ borderRadius: 'var(--radius-pill)' }}
                                >
                                  + вариант
                                </button>
                              </div>
                            </div>
                          </details>
                        </div>
                        )}
                      </div>
                    ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
