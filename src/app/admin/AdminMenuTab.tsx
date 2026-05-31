'use client'

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { ProductCard } from '@/components/ui/ProductCard'
import { IconCamera, IconEyeOff, IconPlus, IconTrash, IconUndo } from '@/components/ui/icons'
import { tagWithEmoji } from '@/lib/tag-labels'
import { telegramInitHeaderRecord } from '@/lib/tg-webapp-client'

type MenuCategory = { id: string; name: string; slug: string; emoji?: string | null; order?: number; prepTimeMinutes?: number | null; maxOrderQuantity?: number | null }
type MenuModifier = {
  id: string
  name: string
  type: string
  priceAdjust: number
  order: number
  subscriptionImageUrl?: string | null
}
type MenuOptionGroup = {
  id: string
  name: string
  slug: string
  order: number
  isActive?: boolean
  values: {
    id: string
    name: string
    slug: string
    order: number
    isActive?: boolean
    subscriptionImageUrl?: string | null
  }[]
}
type DishAssignedOption = {
  optionValueId: string
  priceAdjust: number
  costPrice?: number | null
  subscriptionEligible?: boolean
  order?: number
  isAvailable?: boolean
}
type MenuDish = {
  id: string
  name: string
  slug: string
  emoji?: string | null
  description?: string | null
  weightLabel?: string | null
  price: number
  costPrice?: number | null
  image?: string | null
  categoryId: string
  isAvailable: boolean
  tags?: string[]
  maxOrderQuantity?: number
  subscriptionEligible?: boolean
  category?: { id: string; name: string }
  modifiers?: MenuModifier[]
  optionValues?: Array<{
    id: string
    priceAdjust: number
    order: number
    isAvailable: boolean
    subscriptionEligible?: boolean
    costPrice?: number | null
    optionValue: {
      id: string
      name: string
      subscriptionImageUrl?: string | null
      group: { id: string; name: string; order: number }
    }
  }>
}

type DishEditDraft = {
  name: string
  price: number
  costPrice: number
  description: string
  weightLabel: string
  isAvailable: boolean
  tags: string[]
  subscriptionEligible: boolean
  emoji?: string | null
  image?: string | null
}
type DishOptionDraft = { id?: string; name: string; priceAdjust: number; subscriptionImageUrl?: string | null }
type NewLineOptionDraft = { name: string; priceAdjust: number; subscriptionImageUrl: string }

const DISH_TAGS = [
  { value: 'hit', label: 'хит' },
  { value: 'new', label: 'новинка' },
  { value: 'popular', label: 'популярное' },
  { value: 'vegan', label: 'веган' },
  { value: 'vegetarian', label: 'вегетарианское' },
  { value: 'healthy', label: 'лайт' },
  { value: 'spicy', label: 'острое' },
  { value: 'chef-choice', label: 'выбор шефа' },
] as const
const CARD_SHAPE_TAGS = {
  square: 'card-square',
  wide: 'card-wide',
  tall: 'card-tall',
} as const

const EMOJI_OPTIONS = ['🍛', '🍜', '🍲', '🥗', '🍔', '🌮', '🍕', '🥟', '🍣', '🍤', '🥩', '🍰', '🥤'] as const
const OWNER_MENU_CACHE_KEY = 'ufo:owner:menu:v1'
const OWNER_MENU_CACHE_TTL_MS = 12 * 60 * 60 * 1000

function normalizeText(value: unknown): string {
  return String(value ?? '').trim()
}

function normalizeTags(tags: unknown): string[] {
  const list = Array.isArray(tags)
    ? tags
      .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
      .map((t) => t.trim())
    : []
  if (list.length === 0) return []
  const shapeTags = [CARD_SHAPE_TAGS.square, CARD_SHAPE_TAGS.wide, CARD_SHAPE_TAGS.tall]
  const selectedShape = list.find((t) => shapeTags.includes(t as any))
  const withoutShapes = list.filter((t) => !shapeTags.includes(t as any))
  const normalized = selectedShape ? [selectedShape, ...withoutShapes] : withoutShapes
  return normalized.slice(0, 8)
}

function sameStringList(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  return a.every((v, idx) => v === b[idx])
}

function normalizeOptions(list: DishOptionDraft[]): Array<{
  name: string
  priceAdjust: number
  order: number
  subscriptionImageUrl: string | null
}> {
  return (list ?? [])
    .map((o, idx) => {
      const url = normalizeText(o.subscriptionImageUrl)
      return {
        name: normalizeText(o.name),
        priceAdjust: Number(o.priceAdjust || 0),
        order: idx,
        subscriptionImageUrl: url.length > 0 ? url : null,
      }
    })
    .filter((o) => o.name.length > 0)
}

function optionsEqual(a: DishOptionDraft[], b: DishOptionDraft[]): boolean {
  const left = normalizeOptions(a)
  const right = normalizeOptions(b)
  if (left.length !== right.length) return false
  return left.every((item, idx) => {
    const other = right[idx]
    return (
      item.name === other.name &&
      item.priceAdjust === other.priceAdjust &&
      (item.subscriptionImageUrl ?? '') === (other.subscriptionImageUrl ?? '')
    )
  })
}

function normalizeDishAssignedOptions(list: DishAssignedOption[]): DishAssignedOption[] {
  return (list ?? [])
    .map((item, idx) => ({
      optionValueId: String(item.optionValueId || '').trim(),
      priceAdjust: Number(item.priceAdjust || 0),
      order: Number.isFinite(Number(item.order)) ? Number(item.order) : idx,
      isAvailable: item.isAvailable !== false,
    }))
    .filter((item) => item.optionValueId)
    .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0))
    .map((item, idx) => ({ ...item, order: idx }))
}

function buildOptionGroupsFromDishes(list: MenuDish[]): MenuOptionGroup[] {
  const groups = new Map<string, MenuOptionGroup>()
  for (const dish of list) {
    for (const assigned of dish.optionValues ?? []) {
      const groupId = String(assigned.optionValue?.group?.id || '').trim()
      if (!groupId) continue
      const groupName = String(assigned.optionValue?.group?.name || groupId).trim()
      const groupOrder = Number(assigned.optionValue?.group?.order ?? 0)
      const valueId = String(assigned.optionValue?.id || '').trim()
      const valueName = String(assigned.optionValue?.name || valueId).trim()
      if (!valueId || !valueName) continue
      if (!groups.has(groupId)) {
        groups.set(groupId, {
          id: groupId,
          name: groupName || groupId,
          slug: groupId,
          order: Number.isFinite(groupOrder) ? groupOrder : 0,
          isActive: true,
          values: [],
        })
      }
      const group = groups.get(groupId)!
      if (!group.values.some((v) => v.id === valueId)) {
        group.values.push({
          id: valueId,
          name: valueName,
          slug: valueId,
          order: Number.isFinite(Number(assigned.order)) ? Number(assigned.order) : group.values.length,
          isActive: assigned.isAvailable !== false,
          subscriptionImageUrl: assigned.optionValue?.subscriptionImageUrl ?? null,
        })
      }
    }
  }
  return Array.from(groups.values())
    .map((g) => ({
      ...g,
      values: [...g.values].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
}

function sanitizeDishesForCache(list: MenuDish[]): MenuDish[] {
  return list.map((dish) => {
    const image = typeof dish.image === 'string' ? dish.image.trim() : ''
    if (image.startsWith('data:image/')) {
      return { ...dish, image: '' }
    }
    return dish
  })
}

function writeOwnerMenuCacheSafe(storage: Storage | null, categories: MenuCategory[], dishes: MenuDish[]) {
  if (!storage) return
  try {
    storage.setItem(
      OWNER_MENU_CACHE_KEY,
      JSON.stringify({ ts: Date.now(), categories, dishes: sanitizeDishesForCache(dishes) })
    )
  } catch {
    // Ignore storage quota/security errors so UI keeps working.
  }
}

function getOwnerMenuCacheStorage(): Storage | null {
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

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit, timeoutMs = 15000) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    controller.abort(new Error('Request timeout'))
  }, timeoutMs)
  try {
    const mergedInit: RequestInit = {
      ...(init || {}),
      signal: controller.signal,
    }
    return await fetch(input, mergedInit)
  } catch (e: any) {
    if (e?.name === 'AbortError' || String(e?.message || '').toLowerCase().includes('timeout')) {
      const err = new Error('Request timeout')
      ;(err as any).name = 'TimeoutError'
      throw err
    }
    throw e
  } finally {
    clearTimeout(timeoutId)
  }
}

export function AdminMenuTab({ menuEnabled }: { menuEnabled: boolean }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [dishes, setDishes] = useState<MenuDish[]>([])

  const [newCategory, setNewCategory] = useState({ name: '', emoji: '' })
  const [newDish, setNewDish] = useState({
    name: '',
    emoji: '',
    image: '',
    categoryId: '',
    price: 0,
    costPrice: 0,
    description: '',
    weightLabel: '',
    tags: [] as string[],
    subscriptionEligible: true,
  })
  const [selectedDishIds, setSelectedDishIds] = useState<Set<string>>(new Set())
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set())
  const [selectMode, setSelectMode] = useState(false)
  const [editingCategoryEmojiId, setEditingCategoryEmojiId] = useState<string | null>(null)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ categories: number; dishes: number } | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportStatus, setExportStatus] = useState<{ ok: boolean; msg: string } | null>(null)
  const [migratingImages, setMigratingImages] = useState(false)
  const [migrationStatus, setMigrationStatus] = useState<{ remaining: number; msg: string } | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [editingDishId, setEditingDishId] = useState<string | null>(null)
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('')
  const [draggingCategoryId, setDraggingCategoryId] = useState<string | null>(null)
  const [categoryOrderSaving, setCategoryOrderSaving] = useState(false)
  const [categoryOrderDirty, setCategoryOrderDirty] = useState(false)
  const [editForm, setEditForm] = useState<{
    name: string
    price: number
    costPrice: number
    categoryId: string
    description: string
    weightLabel: string
    isAvailable: boolean
    tags: string[]
    subscriptionEligible: boolean
    emoji?: string | null
    image?: string | null
  } | null>(null)
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [categoryDrafts, setCategoryDrafts] = useState<Record<string, DishEditDraft>>({})
  const [savingCategoryId, setSavingCategoryId] = useState<string | null>(null)
  const [openCategoryIds, setOpenCategoryIds] = useState<Set<string>>(new Set())
  const [uploadingImageTarget, setUploadingImageTarget] = useState<string | null>(null)
  const [imageUploadError, setImageUploadError] = useState<string | null>(null)
  const [editOptionDrafts, setEditOptionDrafts] = useState<Record<string, DishOptionDraft[]>>({})
  const [newOptionDraft, setNewOptionDraft] = useState<Record<string, NewLineOptionDraft>>({})
  const [menuOptionGroups, setMenuOptionGroups] = useState<MenuOptionGroup[]>([])
  const [dishOptionDrafts, setDishOptionDrafts] = useState<Record<string, DishAssignedOption[]>>({})
  const [newOptionGroupDraft, setNewOptionGroupDraft] = useState({ name: '', values: '' })
  const [newOptionValueDraft, setNewOptionValueDraft] = useState<Record<string, string>>({})
  const [optionGroupSaving, setOptionGroupSaving] = useState(false)
  const [optionGroupMessage, setOptionGroupMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [optionEditBusy, setOptionEditBusy] = useState<string | null>(null)
  const [showHiddenOptionGroups, setShowHiddenOptionGroups] = useState(false)
  const [savingDishId, setSavingDishId] = useState<string | null>(null)
  const [savingDishStep, setSavingDishStep] = useState<string | null>(null)

  async function load(options?: { silent?: boolean; skipCache?: boolean }) {
    const silent = options?.silent === true
    const skipCache = options?.skipCache === true
    const cacheStorage = getOwnerMenuCacheStorage()
    const cachedRaw = skipCache ? null : (cacheStorage?.getItem(OWNER_MENU_CACHE_KEY) ?? null)
    let hasCachedData = false
    let freshCached = false
    /** Блюда из owner-cache в начале запроса — не затирать [] из устаревшего замыкания useState при ошибке API. */
    let preservedOwnerDishes: MenuDish[] | null = null
    const hasInMemoryData = categories.length > 0 || dishes.length > 0
    if (cachedRaw) {
      try {
        const cached = JSON.parse(cachedRaw) as { ts: number; categories: MenuCategory[]; dishes: MenuDish[] }
        if (Array.isArray(cached.categories) && Array.isArray(cached.dishes)) {
          hasCachedData = true
          preservedOwnerDishes = cached.dishes
          setCategories(cached.categories)
          setDishes(cached.dishes)
          freshCached = Date.now() - Number(cached.ts || 0) < OWNER_MENU_CACHE_TTL_MS
        }
      } catch {}
    }
    if (!silent) setLoading(!hasCachedData && !hasInMemoryData)
    setError(null)
    if (freshCached) {
      // Keep UI instant from cache, but still refetch to avoid stale owner edits.
      // Do not show blocking loader when cached data already exists.
      if (!silent) setLoading(false)
    }
    try {
      const [catResult, dishResult] = await Promise.allSettled([
        fetch('/api/admin/menu/categories', { cache: 'no-store', credentials: 'include' }),
        fetch('/api/admin/menu/dishes', { cache: 'no-store', credentials: 'include' }),
      ])

      const catRes = catResult.status === 'fulfilled' ? catResult.value : null
      const dishRes = dishResult.status === 'fulfilled' ? dishResult.value : null
      const catData = catRes ? await catRes.json().catch(() => null) : null
      const dishData = dishRes ? await dishRes.json().catch(() => null) : null

      const categoriesLoaded = Boolean(catRes?.ok && catData?.ok && Array.isArray(catData.categories))
      const dishesLoaded = Boolean(dishRes?.ok && dishData?.ok && Array.isArray(dishData.dishes))
      const nextCategories = categoriesLoaded ? catData.categories : categories
      const nextDishes = dishesLoaded ? dishData.dishes : (preservedOwnerDishes ?? dishes)

      if (categoriesLoaded) {
        setCategories(nextCategories)
        setOpenCategoryIds((prev) => {
          const existing = new Set(nextCategories.map((c: MenuCategory) => c.id))
          return new Set(Array.from(prev).filter((id) => existing.has(id)))
        })
      }
      if (dishesLoaded) setDishes(nextDishes)

      if (categoriesLoaded || dishesLoaded) {
        const dishesForCache = dishesLoaded ? dishData.dishes : (preservedOwnerDishes ?? nextDishes)
        writeOwnerMenuCacheSafe(cacheStorage, nextCategories, dishesForCache)
      }

      const catForbidden = catRes?.status === 401 || catRes?.status === 403
      const dishForbidden = dishRes?.status === 401 || dishRes?.status === 403
      if (catForbidden || dishForbidden) {
        setError('Войдите в аккаунт для доступа в ЛК (откройте в браузере и авторизуйтесь)')
      } else if (!categoriesLoaded || !dishesLoaded) {
        const hasRenderableData =
          nextCategories.length > 0 ||
          nextDishes.length > 0 ||
          hasCachedData
        if (!hasRenderableData) {
          const parts = []
          if (!categoriesLoaded) parts.push('категории')
          if (!dishesLoaded) parts.push('блюда')
          setError(`не удалось загрузить: ${parts.join(', ')}`)
        } else {
          // Avoid showing a blocking red error when part of data is already visible.
          setError(null)
        }
      } else {
        setError(null)
      }

      setNewDish((s) => ({
        ...s,
        categoryId: s.categoryId || (categoriesLoaded ? (catData?.categories?.[0]?.id ?? '') : s.categoryId),
      }))
    } catch {
      if (!hasCachedData) setError('не удалось загрузить (сеть или сервер)')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  async function loadMenuOptionGroups() {
    try {
      const res = await fetch('/api/admin/menu/options', { cache: 'no-store', credentials: 'include' })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.ok && Array.isArray(data.groups)) {
        setMenuOptionGroups(data.groups)
        return
      }
      const msg =
        typeof data?.error === 'string'
          ? data.error
          : res.status === 503
            ? 'База без миграции опций'
            : 'Не удалось загрузить опции блюд'
      toast.error(msg)
    } catch {
      toast.error('Сеть: опции блюд не загрузились')
    }
  }

  /** После изменения справочника опций обновляем и группы, и блюда (привязки на карточках). */
  async function refreshMenuOptionsAndDishes() {
    await Promise.all([loadMenuOptionGroups(), load({ silent: true, skipCache: true })])
  }

  useEffect(() => {
    load()
    loadMenuOptionGroups()
  }, [])

  // Self-heal fallback: if option directory endpoint is empty/unavailable,
  // reconstruct groups from dish bindings so owner can still see/manage options.
  useEffect(() => {
    if (menuOptionGroups.length > 0) return
    if (dishes.length === 0) return
    const fallbackGroups = buildOptionGroupsFromDishes(dishes)
    if (fallbackGroups.length > 0) {
      setMenuOptionGroups(fallbackGroups)
    }
  }, [menuOptionGroups, dishes])

  const dishesByCategory = useMemo(() => {
    const map = new Map<string, MenuDish[]>()
    for (const d of dishes) {
      const key = d.categoryId || 'uncat'
      map.set(key, [...(map.get(key) ?? []), d])
    }
    return map
  }, [dishes])

  const filteredCategories = useMemo(() => {
    if (!selectedCategoryFilter) return categories
    return categories.filter((c) => c.id === selectedCategoryFilter)
  }, [categories, selectedCategoryFilter])
  const optionGroupStats = useMemo(() => {
    const active = menuOptionGroups.filter((g) => g.isActive !== false)
    const hidden = menuOptionGroups.filter((g) => g.isActive === false)
    return { active, hidden }
  }, [menuOptionGroups])
  const visibleOptionGroups = showHiddenOptionGroups
    ? [...optionGroupStats.active, ...optionGroupStats.hidden]
    : optionGroupStats.active

  const canCreateCategory = Boolean(newCategory.name.trim())
  const canCreateDish =
    categories.length > 0 &&
    Boolean(newDish.name.trim() && newDish.categoryId)

  async function runImportCsv() {
    if (!importFile) return
    setImporting(true)
    setImportResult(null)
    setImportError(null)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', importFile)
      form.append('type', 'menu')
      const res = await fetch('/api/admin/import/csv', { method: 'POST', body: form, credentials: 'include' })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        const err = data?.error || 'не удалось импортировать'
        setImportError(err)
        toast.error(err)
        return
      }
      const cats = data.createdCategories ?? 0
      const dishes = data.createdDishes ?? 0
      setImportResult({ categories: cats, dishes })
      setImportError(null)
      setImportFile(null)
      await load()
      toast.success(`Загружено: ${cats} категорий, ${dishes} блюд`)
    } catch {
      const err = 'Ошибка загрузки. Проверьте формат: category, name, price (или полный шаблон).'
      setImportError(err)
      toast.error(err)
    } finally {
      setImporting(false)
    }
  }

  async function migrateMenuImagesToCdn() {
    if (migratingImages) return
    setMigratingImages(true)
    setMigrationStatus(null)
    try {
      let totalMigrated = 0
      let remaining = 0
      for (let i = 0; i < 20; i += 1) {
        const res = await fetch('/api/admin/menu/images/migrate', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ limit: 25 }),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.ok) {
          const err = data?.error || 'Не удалось перенести фото'
          setMigrationStatus({ remaining, msg: err })
          toast.error(err)
          return
        }
        totalMigrated += Number(data.migrated || 0)
        remaining = Number(data.remaining || 0)
        setMigrationStatus({ remaining, msg: `Перенесено: ${totalMigrated}. Осталось: ${remaining}` })
        if (remaining <= 0 || Number(data.migrated || 0) <= 0) break
      }
      await load({ silent: true, skipCache: true })
      toast.success(remaining > 0 ? `Перенесено: ${totalMigrated}, осталось: ${remaining}` : 'Фото перенесены в CDN')
    } catch {
      const err = 'Ошибка миграции фото'
      setMigrationStatus({ remaining: 0, msg: err })
      toast.error(err)
    } finally {
      setMigratingImages(false)
    }
  }

  function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(new Error('read-failed'))
      reader.readAsDataURL(file)
    })
  }

  function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('image-load-failed'))
      img.src = dataUrl
    })
  }

  function hasAlphaChannel(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
    try {
      const imageData = ctx.getImageData(0, 0, width, height).data
      for (let i = 3; i < imageData.length; i += 4) {
        if (imageData[i] < 255) return true
      }
      return false
    } catch {
      return false
    }
  }

  function colorDistance(a: [number, number, number], b: [number, number, number]): number {
    const dr = a[0] - b[0]
    const dg = a[1] - b[1]
    const db = a[2] - b[2]
    return Math.sqrt(dr * dr + dg * dg + db * db)
  }

  function tryAutoRemoveUniformBackground(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): boolean {
    if (width < 40 || height < 40) return false
    const imageData = ctx.getImageData(0, 0, width, height)
    const data = imageData.data
    const idx = (x: number, y: number) => (y * width + x) * 4
    const pick = (x: number, y: number): [number, number, number] => {
      const i = idx(Math.max(0, Math.min(width - 1, x)), Math.max(0, Math.min(height - 1, y)))
      return [data[i], data[i + 1], data[i + 2]]
    }

    const corners: [number, number, number][] = [
      pick(2, 2),
      pick(width - 3, 2),
      pick(2, height - 3),
      pick(width - 3, height - 3),
    ]
    const avg: [number, number, number] = [
      Math.round((corners[0][0] + corners[1][0] + corners[2][0] + corners[3][0]) / 4),
      Math.round((corners[0][1] + corners[1][1] + corners[2][1] + corners[3][1]) / 4),
      Math.round((corners[0][2] + corners[1][2] + corners[2][2] + corners[3][2]) / 4),
    ]

    const cornerSpread = Math.max(
      colorDistance(corners[0], corners[1]),
      colorDistance(corners[0], corners[2]),
      colorDistance(corners[0], corners[3]),
      colorDistance(corners[1], corners[2]),
      colorDistance(corners[1], corners[3]),
      colorDistance(corners[2], corners[3])
    )
    // background should be relatively uniform
    if (cornerSpread > 42) return false

    const nearEdgeBand = Math.max(8, Math.round(Math.min(width, height) * 0.06))
    let edgeMatch = 0
    let edgeTotal = 0
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const onEdge = x < nearEdgeBand || y < nearEdgeBand || x >= width - nearEdgeBand || y >= height - nearEdgeBand
        if (!onEdge) continue
        const i = idx(x, y)
        if (data[i + 3] < 220) continue
        edgeTotal += 1
        const d = colorDistance([data[i], data[i + 1], data[i + 2]], avg)
        if (d < 36) edgeMatch += 1
      }
    }
    if (edgeTotal === 0 || edgeMatch / edgeTotal < 0.72) return false

    let changed = 0
    const hardThreshold = 34
    const softThreshold = 56
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = idx(x, y)
        const a = data[i + 3]
        if (a === 0) continue
        const d = colorDistance([data[i], data[i + 1], data[i + 2]], avg)
        if (d <= hardThreshold) {
          data[i + 3] = 0
          changed += 1
        } else if (d <= softThreshold) {
          const keep = Math.round(((d - hardThreshold) / (softThreshold - hardThreshold)) * a)
          data[i + 3] = Math.max(0, Math.min(255, keep))
          changed += 1
        }
      }
    }

    const changedRatio = changed / (width * height)
    if (changedRatio < 0.1 || changedRatio > 0.85) return false

    ctx.putImageData(imageData, 0, 0)
    return true
  }

function canvasToDataUrl(canvas: HTMLCanvasElement, quality: number, preserveAlpha: boolean): string {
  // For transparent assets, keep PNG to avoid accidental matte/alpha quirks.
  if (preserveAlpha) {
    const png = canvas.toDataURL('image/png')
    if (png.startsWith('data:image/png')) return png
  }
  // For opaque assets, prefer WEBP for compact size; fallback to PNG.
  const webp = canvas.toDataURL('image/webp', quality)
  if (webp.startsWith('data:image/webp')) return webp
  const png = canvas.toDataURL('image/png')
  if (png.startsWith('data:image/png')) return png
  return webp
  }

  async function optimizeImageDataUrl(dataUrl: string): Promise<string> {
    const img = await loadImageFromDataUrl(dataUrl)
    // Keep admin photos lightweight — grid shows small tiles; `next/image` also optimizes, but small sources help first paint.
    const maxSide = 640
    const w = img.naturalWidth || img.width
    const h = img.naturalHeight || img.height
    if (!w || !h) return dataUrl

    const ratio = Math.min(1, maxSide / Math.max(w, h))
    const targetW = Math.max(1, Math.round(w * ratio))
    const targetH = Math.max(1, Math.round(h * ratio))

    const canvas = document.createElement('canvas')
    canvas.width = targetW
    canvas.height = targetH
    const ctx = canvas.getContext('2d')
    if (!ctx) return dataUrl

    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, targetW, targetH)
    let preserveAlpha = hasAlphaChannel(ctx, targetW, targetH)
    if (!preserveAlpha) {
      // Heuristic auto-cut for common one-tone photo backgrounds.
      // This keeps UX simple for owners and prevents black/white matte cards.
      const cutApplied = tryAutoRemoveUniformBackground(ctx, targetW, targetH)
      if (cutApplied) preserveAlpha = true
    }

    const maxBytes = 220 * 1024
    let quality = 0.86
    let encoded = canvasToDataUrl(canvas, quality, preserveAlpha)
    while (encoded.length > maxBytes && quality > 0.5) {
      quality -= 0.08
      encoded = canvasToDataUrl(canvas, quality, preserveAlpha)
    }
    return encoded
  }

  async function uploadDataUrlToServer(dataUrl: string): Promise<{ url: string | null; error?: string }> {
    try {
      const blob = await fetch(dataUrl).then((r) => r.blob())
      if (!blob || blob.size <= 0) {
        return { url: null, error: 'Пустой файл. Выберите другое фото.' }
      }
      const ext = blob.type === 'image/png'
        ? 'png'
        : blob.type === 'image/webp'
          ? 'webp'
          : 'jpg'
      const file = new File([blob], `dish-${Date.now()}.${ext}`, { type: blob.type || 'image/png' })
      const form = new FormData()
      form.append('file', file)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)
      const res = await fetch('/api/admin/uploads/menu-image', {
        method: 'POST',
        credentials: 'include',
        body: form,
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId))
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok || typeof data?.url !== 'string') {
        return { url: null, error: String(data?.error || 'Ошибка сервера при загрузке фото') }
      }
      return { url: data.url }
    } catch (e: any) {
      if (String(e?.name || '').toLowerCase() === 'aborterror') {
        return { url: null, error: 'Сервер долго отвечает. Попробуйте еще раз.' }
      }
      return { url: null, error: 'Не удалось отправить фото на сервер' }
    }
  }

  async function uploadDishImage(file: File, target: string): Promise<string | null> {
    setUploadingImageTarget(target)
    setImageUploadError(null)
    try {
      if (!file.type.startsWith('image/')) {
        const msg = 'Выберите изображение'
        setImageUploadError(msg)
        toast.error(msg)
        return null
      }
      if (file.size > 8 * 1024 * 1024) {
        const msg = 'Размер файла до 8MB'
        setImageUploadError(msg)
        toast.error(msg)
        return null
      }
      const original = await fileToDataUrl(file)
      const dataUrl = await optimizeImageDataUrl(original)
      if (!dataUrl.startsWith('data:image/')) {
        const msg = 'Не удалось прочитать изображение'
        setImageUploadError(msg)
        toast.error(msg)
        return null
      }
      const uploaded = await uploadDataUrlToServer(dataUrl)
      if (uploaded.url) {
        setImageUploadError(null)
        toast.success('Фото добавлено')
        return uploaded.url
      }
      const msg = uploaded.error || 'Не удалось загрузить фото на сервер'
      setImageUploadError(msg)
      toast.error(msg)
      return null
    } catch {
      const msg = 'Ошибка загрузки фото'
      setImageUploadError(msg)
      toast.error(msg)
      return null
    } finally {
      setUploadingImageTarget((current) => (current === target ? null : current))
    }
  }

  async function createCategory() {
    if (!canCreateCategory) return
    const name = newCategory.name.trim()
    if (!confirm(`Создать категорию «${name}»?`)) return
    setError(null)
    try {
      const res = await fetch('/api/admin/menu/categories', {
        credentials: 'include',
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          emoji: newCategory.emoji.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        setError(data?.error || 'не удалось создать категорию')
        toast.error(data?.error || 'Не удалось создать')
        return
      }
      setNewCategory({ name: '', emoji: '' })
      await load()
      toast.success('Категория создана')
    } catch {
      setError('не удалось создать категорию')
      toast.error('Ошибка при создании')
    }
  }

  function reorderCategories(list: MenuCategory[], fromId: string, toId: string) {
    const fromIndex = list.findIndex((c) => c.id === fromId)
    const toIndex = list.findIndex((c) => c.id === toId)
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return list
    const next = [...list]
    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)
    return next
  }

  async function saveCategoryOrder(nextCategories: MenuCategory[]) {
    setCategoryOrderSaving(true)
    try {
      await Promise.all(
        nextCategories.map((cat, idx) =>
          fetch('/api/admin/menu/categories', {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id: cat.id, order: idx }),
          })
        )
      )
      setCategoryOrderDirty(false)
    } catch {
      toast.error('Не удалось сохранить порядок категорий')
      await load()
    } finally {
      setCategoryOrderSaving(false)
    }
  }

  async function createDish() {
    if (!canCreateDish) return
    const name = newDish.name.trim()
    if (!confirm(`Создать блюдо «${name}»?`)) return
    setError(null)
    try {
      const res = await fetch('/api/admin/menu/dishes', {
        credentials: 'include',
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          emoji: newDish.emoji.trim() || undefined,
          image: newDish.image.trim() || undefined,
          categoryId: newDish.categoryId,
          price: Number(newDish.price) || 0,
          costPrice: Number(newDish.costPrice) > 0 ? Number(newDish.costPrice) : null,
          description: newDish.description.trim() || undefined,
          weightLabel: newDish.weightLabel.trim() || undefined,
          tags: newDish.tags,
          subscriptionEligible: newDish.subscriptionEligible,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        setError(data?.error || 'не удалось создать блюдо')
        toast.error(data?.error || 'Не удалось создать')
        return
      }
      setNewDish((s) => ({
        ...s,
        name: '',
        emoji: '',
        image: '',
        price: 0,
        costPrice: 0,
        description: '',
        weightLabel: '',
        tags: [],
        subscriptionEligible: true,
      }))
      await load()
      toast.success('Блюдо создано')
    } catch {
      setError('не удалось создать блюдо')
      toast.error('Ошибка при создании')
    }
  }

  async function createMenuOptionGroup() {
    const name = newOptionGroupDraft.name.trim()
    if (!name) return
    const values = newOptionGroupDraft.values
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
    setOptionGroupSaving(true)
    setOptionGroupMessage(null)
    try {
      const res = await fetch('/api/admin/menu/options', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, values }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        const error = data?.error || 'Не удалось создать опцию'
        setOptionGroupMessage({ type: 'error', text: error })
        toast.error(error)
        return
      }
      setNewOptionGroupDraft({ name: '', values: '' })
      await refreshMenuOptionsAndDishes()
      setOptionGroupMessage({ type: 'success', text: 'Опция создана' })
      toast.success('Опция создана')
    } catch {
      setOptionGroupMessage({ type: 'error', text: 'Ошибка сети или сервера' })
      toast.error('Ошибка создания опции')
    } finally {
      setOptionGroupSaving(false)
    }
  }

  async function addMenuOptionValue(groupId: string) {
    const valueName = (newOptionValueDraft[groupId] || '').trim()
    if (!valueName) return
    setOptionEditBusy(`add-${groupId}`)
    try {
      const res = await fetch('/api/admin/menu/options', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ groupId, valueName }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast.error(data?.error || 'Не удалось добавить значение')
        return
      }
      setNewOptionValueDraft((s) => ({ ...s, [groupId]: '' }))
      await refreshMenuOptionsAndDishes()
      toast.success('Значение добавлено')
    } catch {
      toast.error('Ошибка сети')
    } finally {
      setOptionEditBusy(null)
    }
  }

  async function patchMenuOptionGroup(
    groupId: string,
    patch: { name?: string; order?: number; isActive?: boolean }
  ) {
    setOptionEditBusy(`g-${groupId}`)
    try {
      const res = await fetch('/api/admin/menu/options', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'group', groupId, ...patch }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast.error(data?.error || 'Не удалось сохранить')
        return
      }
      await refreshMenuOptionsAndDishes()
      if (patch.isActive === false) toast.success('Группа скрыта')
      if (patch.isActive === true) toast.success('Группа снова в меню')
    } catch {
      toast.error('Ошибка сети')
    } finally {
      setOptionEditBusy(null)
    }
  }

  async function patchMenuOptionValue(
    valueId: string,
    patch: { name?: string; order?: number; isActive?: boolean; subscriptionImageUrl?: string | null }
  ) {
    setOptionEditBusy(`v-${valueId}`)
    try {
      const res = await fetch('/api/admin/menu/options', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'value', valueId, ...patch }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast.error(data?.error || 'Не удалось сохранить')
        return
      }
      await refreshMenuOptionsAndDishes()
      if (patch.isActive === false) toast.success('Вариант скрыт')
      if (patch.isActive === true) toast.success('Вариант снова в меню')
    } catch {
      toast.error('Ошибка сети')
    } finally {
      setOptionEditBusy(null)
    }
  }

  async function deleteMenuOptionValue(valueId: string) {
    if (!confirm('Скрыть это значение в меню? Его можно будет добавить снова под новым названием.')) return
    setOptionEditBusy(`v-${valueId}`)
    try {
      const res = await fetch(`/api/admin/menu/options?${new URLSearchParams({ valueId })}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast.error(data?.error || 'Не удалось скрыть')
        return
      }
      await refreshMenuOptionsAndDishes()
      toast.success('Вариант скрыт')
    } catch {
      toast.error('Ошибка сети')
    } finally {
      setOptionEditBusy(null)
    }
  }

  async function hardDeleteMenuOptionValue(valueId: string) {
    if (!confirm('Удалить значение навсегда? Это действие необратимо.')) return
    setOptionEditBusy(`v-${valueId}`)
    try {
      const res = await fetch(`/api/admin/menu/options?${new URLSearchParams({ valueId, mode: 'delete' })}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast.error(data?.error || 'Не удалось удалить')
        return
      }
      await refreshMenuOptionsAndDishes()
      toast.success('Значение удалено')
    } catch {
      toast.error('Ошибка сети')
    } finally {
      setOptionEditBusy(null)
    }
  }

  async function deleteMenuOptionGroup(groupId: string) {
    if (!confirm('Скрыть всю группу опций и все значения?')) return
    setOptionEditBusy(`delg-${groupId}`)
    try {
      const res = await fetch(`/api/admin/menu/options?${new URLSearchParams({ groupId })}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast.error(data?.error || 'Не удалось скрыть')
        return
      }
      await refreshMenuOptionsAndDishes()
      toast.success('Группа скрыта')
    } catch {
      toast.error('Ошибка сети')
    } finally {
      setOptionEditBusy(null)
    }
  }

  async function hardDeleteMenuOptionGroup(groupId: string) {
    if (!confirm('Удалить группу и значения навсегда? Это действие необратимо.')) return
    setOptionEditBusy(`delg-${groupId}`)
    try {
      const res = await fetch(`/api/admin/menu/options?${new URLSearchParams({ groupId, mode: 'delete' })}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast.error(data?.error || 'Не удалось удалить')
        return
      }
      await refreshMenuOptionsAndDishes()
      toast.success('Группа удалена')
    } catch {
      toast.error('Ошибка сети')
    } finally {
      setOptionEditBusy(null)
    }
  }

  async function patchDish(id: string) {
    if (!editForm) return
    setSavingDishId(id)
    setSavingDishStep('подготовка…')
    try {
      const original = dishes.find((dish) => dish.id === id)
      if (!original) {
        toast.error('Блюдо не найдено')
        return
      }

      const nextName = normalizeText(editForm.name)
      const nextPrice = Number(editForm.price || 0)
      const nextCostPrice = Number(editForm.costPrice || 0)
      const nextDescription = normalizeText(editForm.description)
      const nextWeight = normalizeText(editForm.weightLabel).slice(0, 120)
      const nextEmoji = normalizeText(editForm.emoji)
      const nextImage = normalizeText(editForm.image)
      const nextTags = normalizeTags(editForm.tags)
      const patch: Record<string, unknown> = {
        id,
        name: nextName,
        price: Number.isFinite(nextPrice) ? nextPrice : 0,
        costPrice: Number.isFinite(nextCostPrice) && nextCostPrice > 0 ? nextCostPrice : null,
        categoryId: String(editForm.categoryId || original.categoryId || ''),
        description: nextDescription || null,
        weightLabel: nextWeight || null,
        isAvailable: Boolean(editForm.isAvailable),
        subscriptionEligible: Boolean(editForm.subscriptionEligible),
        emoji: nextEmoji || null,
        image: nextImage || null,
        tags: nextTags,
      }

      const originalName = normalizeText(original.name)
      const originalPrice = Number(original.price || 0)
      const originalCostPrice = Number(original.costPrice || 0)
      const originalDescription = normalizeText(original.description)
      const originalWeight = normalizeText(original.weightLabel).slice(0, 120)
      const originalEmoji = normalizeText(original.emoji)
      const originalImage = normalizeText(original.image)
      const originalCategoryId = String(original.categoryId || '')
      const originalTags = normalizeTags(original.tags)
      const hasDishPatch =
        nextName !== originalName ||
        (Number.isFinite(nextPrice) ? nextPrice : 0) !== originalPrice ||
        (Number.isFinite(nextCostPrice) && nextCostPrice > 0 ? nextCostPrice : 0) !== originalCostPrice ||
        nextDescription !== originalDescription ||
        nextWeight !== originalWeight ||
        nextEmoji !== originalEmoji ||
        nextImage !== originalImage ||
        String(editForm.categoryId || '') !== originalCategoryId ||
        Boolean(editForm.isAvailable) !== Boolean(original.isAvailable) ||
        Boolean(editForm.subscriptionEligible) !== Boolean(original.subscriptionEligible) ||
        !sameStringList(nextTags, originalTags)

      const originalDishOptions = (original.optionValues ?? []).map((ov) => ({
        optionValueId: ov.optionValue.id,
        priceAdjust: Number(ov.priceAdjust || 0),
        order: Number(ov.order || 0),
        subscriptionEligible: ov.subscriptionEligible !== false,
        costPrice: ov.costPrice == null ? null : Number(ov.costPrice),
      }))
      const currentDishOptions = dishOptionDrafts[id] ?? []
      const normalizeAssigned = (list: DishAssignedOption[]) =>
        (list ?? [])
          .map((item, idx) => ({
            optionValueId: String(item.optionValueId || ''),
            priceAdjust: Number(item.priceAdjust || 0),
            order: Number(item.order ?? idx),
            isAvailable: item.isAvailable !== false,
            subscriptionEligible: item.subscriptionEligible !== false,
            costPrice: item.costPrice == null ? null : Number(item.costPrice),
          }))
          .filter((item) => item.optionValueId)
          .sort((a, b) => a.order - b.order || a.optionValueId.localeCompare(b.optionValueId))
      const a = normalizeAssigned(originalDishOptions)
      const b = normalizeAssigned(currentDishOptions)
      const hasDishOptionChanges =
        a.length !== b.length ||
        a.some((item, idx) => {
          const other = b[idx]
          return (
            item.optionValueId !== other?.optionValueId ||
            item.priceAdjust !== other.priceAdjust ||
            item.isAvailable !== other.isAvailable ||
            item.subscriptionEligible !== other?.subscriptionEligible
          )
        })
      const shouldPersistDishOptions = hasDishOptionChanges
      const shouldSave = hasDishPatch || shouldPersistDishOptions
      if (shouldSave) {
        setSavingDishStep('сохраняем…')
        const payload: Record<string, unknown> = hasDishPatch ? patch : { id }
        if (shouldPersistDishOptions) payload.optionValues = b
        const res = await fetchWithTimeout('/api/admin/menu/dishes', {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.ok) {
          toast.error(data?.error || 'Не удалось сохранить')
          return
        }
        if (shouldPersistDishOptions && b.length > 0 && Number(data?.optionsUpdated ?? 0) === 0) {
          toast.error(data?.optionsWarning || 'Опции не сохранены. Проверьте значения и попробуйте снова.')
          return
        }
      }
      const optionMeta = new Map<
        string,
        { name: string; subscriptionImageUrl?: string | null; group: { id: string; name: string; order: number } }
      >()
      for (const group of menuOptionGroups) {
        for (const value of group.values ?? []) {
          optionMeta.set(value.id, {
            name: value.name,
            subscriptionImageUrl: value.subscriptionImageUrl ?? null,
            group: { id: group.id, name: group.name, order: Number(group.order ?? 0) },
          })
        }
      }
      for (const ov of original.optionValues ?? []) {
        if (!optionMeta.has(ov.optionValue.id)) {
          optionMeta.set(ov.optionValue.id, {
            name: ov.optionValue.name,
            subscriptionImageUrl: ov.optionValue.subscriptionImageUrl ?? null,
            group: {
              id: ov.optionValue.group.id,
              name: ov.optionValue.group.name,
              order: Number(ov.optionValue.group.order ?? 0),
            },
          })
        }
      }
      const nextModifiers = original.modifiers ?? []
      const nextOptionValues = shouldPersistDishOptions
        ? b.map((item, idx) => {
            const meta = optionMeta.get(item.optionValueId)
            return {
              id: `${id}:${item.optionValueId}:${idx}`,
              priceAdjust: item.priceAdjust,
              order: item.order,
              isAvailable: item.isAvailable !== false,
              optionValue: {
                id: item.optionValueId,
                name: meta?.name || item.optionValueId,
                subscriptionImageUrl: meta?.subscriptionImageUrl ?? null,
                group: meta?.group ?? { id: 'unknown', name: 'опция', order: 0 },
              },
            }
          })
        : (original.optionValues ?? [])
      const updatedDish: MenuDish = {
        ...original,
        name: nextName || original.name,
        price: Number.isFinite(nextPrice) ? nextPrice : Number(original.price || 0),
        costPrice:
          Number.isFinite(nextCostPrice) && nextCostPrice > 0
            ? nextCostPrice
            : (original.costPrice ?? null),
        categoryId: String(editForm.categoryId || original.categoryId),
        description: nextDescription || null,
        weightLabel: nextWeight || null,
        isAvailable: Boolean(editForm.isAvailable),
        tags: nextTags,
        subscriptionEligible: Boolean(editForm.subscriptionEligible),
        emoji: nextEmoji || null,
        image: nextImage || null,
        modifiers: nextModifiers,
        optionValues: nextOptionValues,
      }
      setDishes((prev) => {
        const next = prev.map((dish) => (dish.id === id ? updatedDish : dish))
        writeOwnerMenuCacheSafe(getOwnerMenuCacheStorage(), categories, next)
        return next
      })
      setEditingDishId(null)
      setEditForm(null)
      setEditOptionDrafts((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      setNewOptionDraft((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      setDishOptionDrafts((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      const changed = hasDishPatch || hasDishOptionChanges
      toast.success(changed ? 'Сохранено' : 'Без изменений')
      setSavingDishStep('обновляем список…')
      void load({ silent: true, skipCache: true })
    } catch (e: any) {
      if (e?.name === 'AbortError' || e?.name === 'TimeoutError') {
        toast.error('Сервер долго отвечает. Попробуйте еще раз.')
      } else {
        toast.error('Ошибка')
      }
    } finally {
      setSavingDishId(null)
      setSavingDishStep(null)
    }
  }

  function startEdit(d: MenuDish) {
    setEditingDishId(d.id)
    setEditForm({
      name: d.name,
      price: d.price,
      costPrice: Number(d.costPrice ?? 0),
      categoryId: d.categoryId,
      description: d.description ?? '',
      weightLabel: d.weightLabel ?? '',
      isAvailable: d.isAvailable,
      tags: d.tags ?? [],
      subscriptionEligible: d.subscriptionEligible ?? true,
      emoji: d.emoji ?? null,
      image: d.image ?? null,
    })
    const optionMods = (d.modifiers ?? [])
      .filter((m) => String(m.type || '').toUpperCase() === 'OPTION')
      .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0))
      .map((m) => ({
        id: m.id,
        name: m.name,
        priceAdjust: Number(m.priceAdjust || 0),
        subscriptionImageUrl: m.subscriptionImageUrl ?? null,
      }))
    setEditOptionDrafts((prev) => ({ ...prev, [d.id]: optionMods }))
    setNewOptionDraft((prev) => ({ ...prev, [d.id]: { name: '', priceAdjust: 0, subscriptionImageUrl: '' } }))
    setDishOptionDrafts((prev) => ({
      ...prev,
      [d.id]: (d.optionValues ?? []).map((ov, idx) => ({
        optionValueId: ov.optionValue.id,
        priceAdjust: Number(ov.priceAdjust || 0),
        order: Number(ov.order ?? idx),
        isAvailable: ov.isAvailable !== false,
        subscriptionEligible: ov.subscriptionEligible !== false,
        costPrice: ov.costPrice == null ? null : Number(ov.costPrice),
      })),
    }))
  }

  function toggleEditFormTag(tag: string) {
    if (!editForm) return
    const has = editForm.tags.includes(tag)
    setEditForm((s) => s ? { ...s, tags: has ? s.tags.filter((t) => t !== tag) : [...s.tags, tag] } : null)
  }

  async function deleteDish(id: string) {
    if (!confirm('Удалить блюдо? Это действие нельзя отменить.')) return
    try {
      const res = await fetch(`/api/admin/menu/dishes?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.ok) {
        await load()
        setSelectedDishIds((s) => { const n = new Set(s); n.delete(id); return n })
        toast.success('Блюдо удалено')
      } else {
        toast.error(data?.error || 'Не удалось удалить')
      }
    } catch {
      toast.error('Ошибка при удалении')
    }
  }

  async function deleteSelectedDishes() {
    const ids = Array.from(selectedDishIds)
    if (ids.length === 0) return
    if (!confirm(`Удалить выбранные блюда (${ids.length})? Это действие нельзя отменить.`)) return
    try {
      const res = await fetch(
        `/api/admin/menu/dishes?ids=${ids.map((id) => encodeURIComponent(id)).join(',')}`,
        { method: 'DELETE', credentials: 'include' }
      )
      const data = await res.json().catch(() => null)
      if (res.ok && data?.ok) {
        await load()
        setSelectedDishIds(new Set())
        toast.success(`Удалено блюд: ${data?.deleted ?? ids.length}`)
      } else {
        toast.error(data?.error || 'Не удалось удалить')
      }
    } catch {
      toast.error('Ошибка при удалении')
    }
  }

  function toggleDishSelection(id: string) {
    setSelectedDishIds((s) => {
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

  async function updateCategory(id: string, patch: { name?: string; order?: number; prepTimeMinutes?: number | null; maxOrderQuantity?: number | null; emoji?: string | null }) {
    try {
      const res = await fetch('/api/admin/menu/categories', {
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

  async function deleteCategory(id: string) {
    if (!confirm('Удалить категорию и все блюда в ней? Нельзя отменить.')) return
    try {
      setError(null)
      const res = await fetch(`/api/admin/menu/categories?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.ok && Number(data?.deleted ?? 0) > 0) {
        setCategories((prev) => prev.filter((c) => c.id !== id))
        setDishes((prev) => prev.filter((d) => d.categoryId !== id))
        setSelectedCategoryIds((s) => { const n = new Set(s); n.delete(id); return n })
        const archived = Number(data?.archivedDishes ?? 0)
        toast.success(archived > 0 ? `Категория удалена, блюд в архив: ${archived}` : 'Категория удалена')
        void load({ silent: true, skipCache: true })
      } else {
        const msg = data?.error || 'Категория не удалена (возможно уже удалена или недоступна)'
        setError(msg)
        toast.error(msg)
      }
    } catch {
      setError('Ошибка при удалении категории')
      toast.error('Ошибка при удалении')
    }
  }

  async function deleteSelectedCategories() {
    const ids = Array.from(selectedCategoryIds)
    if (ids.length === 0) return
    if (!confirm(`Удалить ${ids.length} категорий и все блюда в них? Нельзя отменить.`)) return
    try {
      setError(null)
      const res = await fetch(
        `/api/admin/menu/categories?ids=${ids.map((id) => encodeURIComponent(id)).join(',')}`,
        { method: 'DELETE', credentials: 'include' }
      )
      const data = await res.json().catch(() => null)
      const deleted = Number(data?.deleted ?? 0)
      if (res.ok && data?.ok && deleted > 0) {
        const idsSet = new Set(ids)
        setCategories((prev) => prev.filter((c) => !idsSet.has(c.id)))
        setDishes((prev) => prev.filter((d) => !idsSet.has(d.categoryId)))
        setSelectedCategoryIds(new Set())
        const archived = Number(data?.archivedDishes ?? 0)
        toast.success(
          archived > 0
            ? `Удалено категорий: ${deleted}, блюд в архив: ${archived}`
            : `Удалено категорий: ${deleted}`
        )
        void load({ silent: true, skipCache: true })
      } else {
        const msg = data?.error || 'Категории не удалены (возможно уже удалены или недоступны)'
        setError(msg)
        toast.error(msg)
      }
    } catch {
      setError('Ошибка при удалении категорий')
      toast.error('Ошибка при удалении')
    }
  }

  async function deleteAllMenu() {
    const ids = categories.map((c) => c.id)
    if (ids.length === 0) return
    if (!confirm(`Удалить все категории (${ids.length}) и все блюда?`)) return
    try {
      setError(null)
      const res = await fetch(
        `/api/admin/menu/categories?ids=${ids.map((id) => encodeURIComponent(id)).join(',')}`,
        { method: 'DELETE', credentials: 'include' }
      )
      const data = await res.json().catch(() => null)
      const deleted = Number(data?.deleted ?? 0)
      if (res.ok && data?.ok && deleted > 0) {
        setCategories([])
        setDishes([])
        setSelectedCategoryIds(new Set())
        setSelectedDishIds(new Set())
        setSelectedCategoryFilter('')
        toast.success(`Меню очищено. Удалено категорий: ${deleted}`)
        void load({ silent: true, skipCache: true })
      } else {
        const msg = data?.error || 'Не удалось очистить меню'
        setError(msg)
        toast.error(msg)
      }
    } catch {
      setError('Ошибка при удалении меню')
      toast.error('Ошибка при удалении меню')
    }
  }

  function toggleDishTag(tag: string) {
    setNewDish((s) => {
      const has = s.tags.includes(tag)
      const tags = has ? s.tags.filter((t) => t !== tag) : [...s.tags, tag]
      return { ...s, tags }
    })
  }

  function getCardShapeFromTags(tags: string[]): 'auto' | 'square' | 'wide' | 'tall' {
    const normalized = new Set((tags || []).map((t) => String(t || '').toLowerCase()))
    if (normalized.has(CARD_SHAPE_TAGS.square)) return 'square'
    if (normalized.has(CARD_SHAPE_TAGS.wide)) return 'wide'
    if (normalized.has(CARD_SHAPE_TAGS.tall)) return 'tall'
    return 'auto'
  }

  function applyCardShapeTag(tags: string[], shape: 'auto' | 'square' | 'wide' | 'tall'): string[] {
    const cleaned = (tags || []).filter((t) => {
      const key = String(t || '').toLowerCase()
      return key !== CARD_SHAPE_TAGS.square && key !== CARD_SHAPE_TAGS.wide && key !== CARD_SHAPE_TAGS.tall
    })
    if (shape === 'auto') return cleaned
    const nextTag =
      shape === 'square'
        ? CARD_SHAPE_TAGS.square
        : shape === 'wide'
          ? CARD_SHAPE_TAGS.wide
          : CARD_SHAPE_TAGS.tall
    return [...cleaned, nextTag]
  }

  function dishToDraft(d: MenuDish): DishEditDraft {
    return {
      name: d.name,
      price: d.price,
      costPrice: Number(d.costPrice ?? 0),
      description: d.description ?? '',
      weightLabel: d.weightLabel ?? '',
      isAvailable: d.isAvailable,
      tags: d.tags ?? [],
      subscriptionEligible: d.subscriptionEligible ?? true,
      emoji: d.emoji ?? null,
      image: d.image ?? null,
    }
  }

  function startCategoryEdit(categoryId: string, list: MenuDish[]) {
    const next: Record<string, DishEditDraft> = {}
    for (const d of list) next[d.id] = dishToDraft(d)
    setEditingDishId(null)
    setEditForm(null)
    setEditingCategoryId(categoryId)
    setCategoryDrafts(next)
  }

  function updateCategoryDraft(id: string, patch: Partial<DishEditDraft>) {
    setCategoryDrafts((s) => (s[id] ? { ...s, [id]: { ...s[id], ...patch } } : s))
  }

  function toggleCategoryDraftTag(id: string, tag: string) {
    setCategoryDrafts((s) => {
      const draft = s[id]
      if (!draft) return s
      const has = draft.tags.includes(tag)
      const tags = has ? draft.tags.filter((t) => t !== tag) : [...draft.tags, tag]
      return { ...s, [id]: { ...draft, tags } }
    })
  }

  async function saveCategoryEdit(categoryId: string, list: MenuDish[]) {
    if (list.length === 0) {
      setEditingCategoryId(null)
      setCategoryDrafts({})
      return
    }
    setSavingCategoryId(categoryId)
    try {
      const responses = await Promise.all(
        list.map(async (dish) => {
          const draft = categoryDrafts[dish.id] || dishToDraft(dish)
          const res = await fetch('/api/admin/menu/dishes', {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              id: dish.id,
              name: draft.name.trim(),
              price: Number(draft.price) || 0,
              costPrice: Number(draft.costPrice) > 0 ? Number(draft.costPrice) : null,
              description: draft.description.trim() || undefined,
              weightLabel: normalizeText(draft.weightLabel).slice(0, 120) || null,
              isAvailable: draft.isAvailable,
              tags: draft.tags,
              subscriptionEligible: draft.subscriptionEligible,
              emoji: draft.emoji ?? undefined,
              image: draft.image ?? undefined,
            }),
          })
          return res.ok
        })
      )
      const okCount = responses.filter(Boolean).length
      if (okCount !== list.length) {
        toast.error(`Сохранено ${okCount} из ${list.length}. Проверьте сеть и повторите.`)
        return
      }
      toast.success(`Сохранено блюд: ${okCount}`)
      setEditingCategoryId(null)
      setCategoryDrafts({})
      await load()
    } catch {
      toast.error('Ошибка сохранения категории')
    } finally {
      setSavingCategoryId(null)
    }
  }

  const cardClass = 'overflow-hidden border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] shadow-[var(--shadow-soft)] p-4'
  const cardRadius = { borderRadius: 'var(--radius-large)' } as const

  return (
    <div className="min-w-0 max-w-full overflow-x-hidden space-y-5">
      {!menuEnabled && (
        <div className="rounded-[18px] border border-amber-200 bg-amber-50/80 p-3 text-[13px] text-amber-900">
          Включите «Готовые блюда» в настройках заведения, чтобы меню видели гости.
        </div>
      )}

      {/* CSV: выгрузка в бот и загрузка */}
      <details id="menu-option-groups" className={cn(cardClass, 'group')} style={cardRadius}>
        <summary className="flex cursor-pointer list-none items-center justify-between text-[13px] font-extrabold tracking-tight text-black/70 [&::-webkit-details-marker]:hidden">
          меню (CSV)
          <span className="text-[11px] font-semibold text-[color:var(--muted)] group-open:hidden">показать</span>
          <span className="hidden text-[11px] font-semibold text-[color:var(--muted)] group-open:inline">скрыть</span>
        </summary>
        <p className="ui-muted mt-2 text-[12px]">
          Выгрузка — файл приходит в бот. Загрузка — CSV с колонками: category, name, price (slug — автоматически). Сразу после загрузки появятся категории и блюда ниже.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={exporting}
            onClick={async () => {
              setExporting(true)
              setExportStatus(null)
              try {
                const res = await fetch('/api/admin/export/notify-bot?type=menu', {
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
                    const dl = await fetch('/api/admin/import/template?type=menu&data=1', {
                      method: 'GET',
                      credentials: 'include',
                    })
                    if (dl.ok) {
                      const blob = await dl.blob()
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = 'menu-export.csv'
                      document.body.appendChild(a)
                      a.click()
                      a.remove()
                      URL.revokeObjectURL(url)
                      try {
                        const directUrl = `${window.location.origin}/api/admin/import/template?type=menu&data=1`
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
                  // Fallback: direct CSV download from browser, so export works even if bot delivery fails.
                  const dl = await fetch('/api/admin/import/template?type=menu&data=1', {
                    method: 'GET',
                    credentials: 'include',
                  })
                  if (dl.ok) {
                    const blob = await dl.blob()
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = 'menu-export.csv'
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
              setImportError(null)
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
          <button
            type="button"
            onClick={migrateMenuImagesToCdn}
            disabled={migratingImages}
            className="btn btn-soft rounded-full py-2 px-4 text-[12px] font-semibold disabled:opacity-50"
            style={{ borderRadius: 'var(--radius-pill)' }}
            title="Перенести старые встроенные фото в CDN"
          >
            {migratingImages ? 'переносим фото…' : 'фото в CDN'}
          </button>
        </div>
        {exportStatus && (
          <p className={cn('mt-2 text-[12px]', exportStatus.ok ? 'text-green-700' : 'text-amber-700')}>
            {exportStatus.msg}
          </p>
        )}
        {importError && (
          <p className="mt-2 text-[12px] font-medium text-red-600">
            {importError}
          </p>
        )}
        {importResult && (
          <p className="mt-2 text-[12px] font-medium text-green-700">
            Загружено: {importResult.categories} категорий, {importResult.dishes} блюд. Обновите страницу, если не видите изменения.
          </p>
        )}
        {migrationStatus && (
          <p className="mt-2 text-[12px] font-medium text-[color:var(--muted)]">
            {migrationStatus.msg}
          </p>
        )}
      </details>

      {/* Опции заведения */}
      <details className={cn(cardClass, 'group')} style={cardRadius}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
          <div className="text-[13px] font-extrabold tracking-tight text-black/70">опции блюд</div>
          <span className="text-[11px] font-semibold text-[color:var(--muted)] group-open:hidden">⌄</span>
          <span className="hidden text-[11px] font-semibold text-[color:var(--muted)] group-open:inline">⌃</span>
        </summary>
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="ui-muted text-[11px]">
              {optionGroupStats.active.length}
              {optionGroupStats.hidden.length > 0 ? ` · ${optionGroupStats.hidden.length}` : ''}
            </span>
            {optionGroupStats.hidden.length > 0 ? (
              <button
                type="button"
                onClick={() => setShowHiddenOptionGroups((s) => !s)}
                className="btn btn-soft rounded-full px-3 py-1.5 text-[11px] font-semibold"
                style={{ borderRadius: 'var(--radius-pill)' }}
                title={showHiddenOptionGroups ? 'Скрыть архивные' : 'Показать архивные'}
              >
                {showHiddenOptionGroups ? '✕' : '◌'}
              </button>
            ) : null}
          </div>
          {visibleOptionGroups.length > 0 && (
            <div className="space-y-2">
              {visibleOptionGroups.map((group) => (
                <div
                  key={group.id}
                  className={cn(
                    'rounded-xl border p-2.5 bg-[color:var(--surface)]',
                    group.isActive === false ? 'border-amber-200/90 bg-amber-50/25' : 'border-[color:var(--stroke)]'
                  )}
                  style={{ borderRadius: 'var(--radius-medium)' }}
                >
                  {group.isActive === false && (
                    <div className="mb-2 rounded-lg border border-amber-200/80 bg-amber-50/60 px-2 py-1 text-[10px] font-semibold text-amber-950">
                      скрыто для гостей
                    </div>
                  )}
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-0 flex-1">
                      <input
                        key={`gname-${group.id}-${group.name}`}
                        className="input input--pill w-full min-w-0 text-[12px] font-semibold"
                        defaultValue={group.name}
                        disabled={optionEditBusy === `g-${group.id}`}
                        onBlur={(e) => {
                          const v = e.target.value.trim()
                          if (v && v !== group.name) void patchMenuOptionGroup(group.id, { name: v })
                        }}
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        min={0}
                        className="input input--pill w-14 py-1.5 text-center text-[12px] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        defaultValue={group.order}
                        disabled={optionEditBusy === `g-${group.id}`}
                        onBlur={(e) => {
                          const v = Math.max(0, Math.floor(Number((e.target as HTMLInputElement).value) || 0))
                          if (v !== group.order) void patchMenuOptionGroup(group.id, { order: v })
                        }}
                      />
                    </div>
                    <div className="ml-auto flex items-center gap-1.5">
                      {group.isActive !== false ? (
                        <button
                          type="button"
                          disabled={!!optionEditBusy}
                          onClick={() => deleteMenuOptionGroup(group.id)}
                          className="btn btn-soft rounded-full px-3 py-2 text-[11px] font-semibold text-amber-800 disabled:opacity-50"
                          style={{ borderRadius: 'var(--radius-pill)' }}
                          title="Скрыть"
                        >
                          <IconEyeOff className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={!!optionEditBusy}
                          onClick={() => patchMenuOptionGroup(group.id, { isActive: true })}
                          className="btn btn-soft rounded-full px-3 py-2 text-[11px] font-semibold text-emerald-800 disabled:opacity-50"
                          style={{ borderRadius: 'var(--radius-pill)' }}
                          title="Вернуть"
                        >
                          <IconUndo className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={!!optionEditBusy}
                        onClick={() => hardDeleteMenuOptionGroup(group.id)}
                        className="btn btn-soft rounded-full px-3 py-2 text-[11px] font-semibold text-red-700 disabled:opacity-50"
                        style={{ borderRadius: 'var(--radius-pill)' }}
                        title="Удалить"
                      >
                        <IconTrash className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <ul className="mt-2 space-y-1.5">
                    {group.values.map((value) => (
                      <li
                        key={value.id}
                        className={cn(
                          'rounded-lg border border-[color:var(--stroke)]/70 bg-[color:var(--surface)] p-2 space-y-1.5',
                          value.isActive === false && 'border-amber-200/70 bg-amber-50/20'
                        )}
                      >
                        {value.isActive === false && (
                          <div className="text-[10px] font-extrabold uppercase tracking-wide text-amber-900">вариант скрыт</div>
                        )}
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            key={`vname-${value.id}-${value.name}`}
                            className="input input--pill min-w-0 flex-1 text-[12px] sm:max-w-[220px]"
                            defaultValue={value.name}
                            disabled={optionEditBusy === `v-${value.id}`}
                            onBlur={(e) => {
                              const v = e.target.value.trim()
                              if (v && v !== value.name) void patchMenuOptionValue(value.id, { name: v })
                            }}
                          />
                          <input
                            type="number"
                            min={0}
                            className="input input--pill w-12 shrink-0 py-1 text-center text-[11px] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            defaultValue={value.order}
                            disabled={optionEditBusy === `v-${value.id}`}
                            onBlur={(e) => {
                              const o = Math.max(0, Math.floor(Number((e.target as HTMLInputElement).value) || 0))
                              if (o !== value.order) void patchMenuOptionValue(value.id, { order: o })
                            }}
                          />
                          <div className="ml-auto flex items-center gap-1">
                            {value.isActive !== false ? (
                              <button
                                type="button"
                                disabled={!!optionEditBusy}
                                onClick={() => deleteMenuOptionValue(value.id)}
                                className="btn btn-soft rounded-full px-2.5 py-1 text-[10px] font-semibold text-amber-800 disabled:opacity-50"
                                style={{ borderRadius: 'var(--radius-pill)' }}
                                title="Скрыть"
                              >
                                <IconEyeOff className="h-3 w-3" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={!!optionEditBusy}
                                onClick={() => patchMenuOptionValue(value.id, { isActive: true })}
                                className="btn btn-soft rounded-full px-2.5 py-1 text-[10px] font-semibold text-emerald-800 disabled:opacity-50"
                                style={{ borderRadius: 'var(--radius-pill)' }}
                                title="Вернуть"
                              >
                                <IconUndo className="h-3 w-3" />
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={!!optionEditBusy}
                              onClick={() => hardDeleteMenuOptionValue(value.id)}
                              className="btn btn-soft rounded-full px-2.5 py-1 text-[10px] font-semibold text-red-700 disabled:opacity-50"
                              style={{ borderRadius: 'var(--radius-pill)' }}
                              title="Удалить"
                            >
                              <IconTrash className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {value.subscriptionImageUrl ? (
                            <img
                              src={value.subscriptionImageUrl}
                              alt={value.name}
                              className="h-8 w-8 shrink-0 rounded-lg border border-[color:var(--stroke)] object-cover"
                            />
                          ) : null}
                          <input
                            key={`vsub-${value.id}-${value.subscriptionImageUrl ?? ''}`}
                            className="input input--pill min-w-0 flex-1 text-[11px] sm:max-w-[240px]"
                            placeholder="https://"
                            defaultValue={value.subscriptionImageUrl ?? ''}
                            disabled={optionEditBusy === `v-${value.id}`}
                            onBlur={(e) => {
                              const u = e.target.value.trim()
                              const cur = (value.subscriptionImageUrl ?? '').trim()
                              if (u !== cur) void patchMenuOptionValue(value.id, { subscriptionImageUrl: u.length ? u : null })
                            }}
                          />
                          <label className="inline-flex shrink-0 cursor-pointer">
                            <input
                              type="file"
                              accept="image/*"
                              className="sr-only"
                              disabled={!!optionEditBusy || uploadingImageTarget === `opt-val-${value.id}`}
                              onChange={async (e) => {
                                const file = e.target.files?.[0]
                                if (!file) return
                                const url = await uploadDishImage(file, `opt-val-${value.id}`)
                                if (url) void patchMenuOptionValue(value.id, { subscriptionImageUrl: url })
                                e.currentTarget.value = ''
                              }}
                            />
                            <span className="btn btn-soft rounded-full px-2.5 py-1.5 text-[10px] font-semibold">
                              {uploadingImageTarget === `opt-val-${value.id}` ? '…' : <IconCamera className="h-3.5 w-3.5" />}
                            </span>
                          </label>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      className="input input--pill min-w-0 flex-1 text-[12px] sm:max-w-[280px]"
                      placeholder="+"
                      value={newOptionValueDraft[group.id] ?? ''}
                      onChange={(e) =>
                        setNewOptionValueDraft((s) => ({ ...s, [group.id]: e.target.value }))
                      }
                    />
                    <button
                      type="button"
                      disabled={!((newOptionValueDraft[group.id] || '').trim()) || optionEditBusy === `add-${group.id}`}
                      onClick={() => addMenuOptionValue(group.id)}
                      className="btn btn-soft rounded-full px-3 py-2 text-[11px] font-semibold disabled:opacity-50"
                      style={{ borderRadius: 'var(--radius-pill)' }}
                      title="Добавить значение"
                    >
                      {optionEditBusy === `add-${group.id}` ? '…' : <IconPlus className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[180px_1fr_auto]">
            <input
              className="input input--pill text-[12px]"
              placeholder="название: начинка"
              value={newOptionGroupDraft.name}
              onChange={(e) => setNewOptionGroupDraft((s) => ({ ...s, name: e.target.value }))}
            />
            <input
              className="input input--pill text-[12px]"
              placeholder="значения через запятую"
              value={newOptionGroupDraft.values}
              onChange={(e) => setNewOptionGroupDraft((s) => ({ ...s, values: e.target.value }))}
            />
            <button
              type="button"
              onClick={createMenuOptionGroup}
              disabled={!newOptionGroupDraft.name.trim() || optionGroupSaving}
              className="btn btn-soft rounded-full px-4 py-2 text-[12px] font-semibold disabled:opacity-50"
              style={{ borderRadius: 'var(--radius-pill)' }}
            >
              {optionGroupSaving ? 'создаём…' : 'добавить'}
            </button>
          </div>
          {optionGroupMessage && (
            <p
              className={cn(
                'text-[12px] font-semibold',
                optionGroupMessage.type === 'success' ? 'text-emerald-700' : 'text-red-600'
              )}
            >
              {optionGroupMessage.text}
            </p>
          )}
        </div>
      </details>

      {/* Добавить категорию */}
      <details className={cn(cardClass, 'group')} style={cardRadius}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
          <div className="text-[13px] font-extrabold tracking-tight text-black/70">добавить категорию</div>
          <span className="text-[11px] font-semibold text-[color:var(--muted)] group-open:hidden">показать</span>
          <span className="hidden text-[11px] font-semibold text-[color:var(--muted)] group-open:inline">скрыть</span>
          {newCategory.name.trim() && (
            <span className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[12px] font-semibold shrink-0" style={{ borderRadius: 'var(--radius-pill)' }}>
              {newCategory.emoji ? `${newCategory.emoji} ` : ''}{newCategory.name.trim()}
            </span>
          )}
        </summary>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-black/70">Название</label>
            <input
              className="input input--pill"
              placeholder="например: Завтраки"
              value={newCategory.name}
              onChange={(e) => setNewCategory((s) => ({ ...s, name: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-[12px] font-semibold text-black/70">Эмодзи (необязательно)</label>
            <div className="flex flex-wrap gap-1.5">
              {EMOJI_OPTIONS.slice(0, 8).map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setNewCategory((s) => ({ ...s, emoji }))}
                  className={cn(
                    'rounded-full border px-2.5 py-1.5 text-[14px] transition',
                    newCategory.emoji === emoji
                      ? 'border-[color:var(--accent)] bg-[color:var(--accent)]/10'
                      : 'border-[color:var(--stroke)] bg-[color:var(--surface)]'
                  )}
                  style={{ borderRadius: 'var(--radius-pill)' }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={createCategory}
          disabled={!canCreateCategory}
          className="btn btn-primary mt-3 w-full rounded-full py-2.5 text-[13px] font-semibold disabled:opacity-50"
          style={{ borderRadius: 'var(--radius-pill)' }}
        >
          создать категорию
        </button>
      </details>

      {/* Добавить блюдо */}
      <details className={cn('overflow-visible group', cardClass)} style={cardRadius}>
        <summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-3 [&::-webkit-details-marker]:hidden">
          <div>
            <div className="text-[13px] font-extrabold tracking-tight text-black/70">добавить блюдо</div>
            <p className="ui-muted mt-0.5 text-[12px]">Заполните поля и нажмите «сохранить».</p>
          </div>
          <span className="text-[11px] font-semibold text-[color:var(--muted)] group-open:hidden">показать</span>
          <span className="hidden text-[11px] font-semibold text-[color:var(--muted)] group-open:inline">скрыть</span>
          {newDish.name.trim() && (
            <div className="relative w-[160px] shrink-0 overflow-hidden rounded-xl border border-black/10 bg-white p-2 shadow-sm" style={{ borderRadius: 'var(--radius-medium)' }}>
              <button
                type="button"
                onClick={() => (document.getElementById('new-dish-image-input') as HTMLInputElement | null)?.click()}
                className="relative h-20 w-full overflow-hidden bg-black/[0.03]"
                style={{ borderRadius: 'var(--radius-small)' }}
                title="загрузить фото"
              >
                {newDish.image.trim() ? (
                  <img
                    src={newDish.image.trim()}
                    alt={newDish.name.trim()}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-3xl">
                    {newDish.emoji || categories.find((c) => c.id === newDish.categoryId)?.emoji || '🍛'}
                  </div>
                )}
                <span className="absolute bottom-1.5 right-1.5 rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--text)]">
                  {uploadingImageTarget === 'new-dish' ? 'загрузка…' : 'фото'}
                </span>
              </button>
              <input
                id="new-dish-image-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const url = await uploadDishImage(file, 'new-dish')
                  if (url) setNewDish((s) => ({ ...s, image: url }))
                  e.currentTarget.value = ''
                }}
              />
              <div className="mt-2 truncate text-[12px] font-semibold">{newDish.name.trim()}</div>
              <div className="text-[11px] text-black/50">{newDish.price ? `${newDish.price} ฿` : '—'}</div>
            </div>
          )}
        </summary>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-black/70">Название</label>
            <input
              className="input input--pill"
              placeholder="например: Паста карбонара"
              value={newDish.name}
              onChange={(e) => setNewDish((s) => ({ ...s, name: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-[12px] font-semibold text-black/50">Эмодзи (необязательно)</label>
            <div className="flex flex-wrap gap-1.5">
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setNewDish((s) => ({ ...s, emoji }))}
                  className={cn(
                    'rounded-full border px-2.5 py-1.5 text-[14px] transition',
                    newDish.emoji === emoji
                      ? 'border-[color:var(--accent)] bg-[color:var(--accent)]/10'
                      : 'border-[color:var(--stroke)] bg-[color:var(--surface)]'
                  )}
                  style={{ borderRadius: 'var(--radius-pill)' }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-[12px] font-semibold text-black/70">Фото (URL)</label>
            <input
              className="input input--pill"
              placeholder="https://...jpg/png/webp"
              value={newDish.image}
              onChange={(e) => setNewDish((s) => ({ ...s, image: e.target.value }))}
            />
            <p className="mt-1 text-[11px] text-[color:var(--muted)]">или тапните по превью сверху, чтобы выбрать фото из галереи</p>
            {imageUploadError && (
              <p className="mt-1 text-[11px] font-medium text-red-600">{imageUploadError}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-black/70">Категория</label>
            <CustomSelect
              value={newDish.categoryId}
              onChange={(v) => setNewDish((s) => ({ ...s, categoryId: v }))}
              placeholder="— выбрать —"
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-black/70">Цена (฿)</label>
            <input
              className="input input--pill"
              placeholder="например 250"
              inputMode="numeric"
              value={String(newDish.price)}
              onChange={(e) => setNewDish((s) => ({ ...s, price: Number(e.target.value || 0) }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-black/70">Себестоимость (฿)</label>
            <input
              className="input input--pill"
              placeholder="например 140"
              inputMode="numeric"
              value={String(newDish.costPrice)}
              onChange={(e) => setNewDish((s) => ({ ...s, costPrice: Number(e.target.value || 0) }))}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-[12px] font-semibold text-black/50">Описание (необязательно)</label>
            <input
              className="input input--pill"
              placeholder="подпись к блюду"
              value={newDish.description}
              onChange={(e) => setNewDish((s) => ({ ...s, description: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-[12px] font-semibold text-black/50">Вес / порция (витрина)</label>
            <input
              className="input input--pill"
              placeholder="например 350 г или 250 мл"
              maxLength={120}
              value={newDish.weightLabel}
              onChange={(e) => setNewDish((s) => ({ ...s, weightLabel: e.target.value }))}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="flex cursor-pointer items-center gap-2 text-[12px] font-semibold text-black/70">
              <input
                type="checkbox"
                checked={newDish.subscriptionEligible}
                onChange={(e) => setNewDish((s) => ({ ...s, subscriptionEligible: e.target.checked }))}
              />
              В подписку
            </label>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-[12px] font-semibold text-black/70">Форма карточки</label>
            <div className="flex items-center gap-2">
              {(['auto', 'square', 'wide'] as const).map((shape) => {
                const active = getCardShapeFromTags(newDish.tags) === shape
                return (
                  <button
                    key={`new-shape-${shape}`}
                    type="button"
                    aria-label={`форма: ${shape}`}
                    onClick={() => setNewDish((s) => ({ ...s, tags: applyCardShapeTag(s.tags, shape) }))}
                    className={cn(
                      'inline-flex h-9 w-12 items-center justify-center rounded-xl border transition',
                      active
                        ? 'border-[color:var(--accent)] bg-[color:var(--accent)]/10'
                        : 'border-[color:var(--stroke)] bg-[color:var(--surface)]'
                    )}
                    style={{ borderRadius: 'var(--radius-medium)' }}
                  >
                    {shape === 'auto' ? (
                      <span className="h-2 w-2 rounded-full bg-black/50" />
                    ) : shape === 'square' ? (
                      <span className="h-5 w-5 rounded-[6px] border border-black/55" />
                    ) : shape === 'wide' ? (
                      <span className="h-4 w-7 rounded-[6px] border border-black/55" />
                    ) : (
                      <span className="h-7 w-4 rounded-[6px] border border-black/55" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-[12px] font-semibold text-black/70">Теги</label>
            <div className="flex flex-wrap gap-1.5">
              {DISH_TAGS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => toggleDishTag(t.value)}
                  className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
                    newDish.tags.includes(t.value)
                      ? 'bg-black/15 text-black/90'
                      : 'bg-black/[0.06] text-black/50 hover:bg-black/10'
                  }`}
                  style={{ borderRadius: 'var(--radius-pill)' }}
                >
                  {tagWithEmoji(t.value)}
                </button>
              ))}
            </div>
          </div>
        </div>
        {categories.length === 0 && (
          <p className="mt-2 text-[12px] text-amber-700">
            Сначала создайте категорию — блюда добавляются только в существующие категории.
          </p>
        )}
        <button
          type="button"
          onClick={createDish}
          disabled={!canCreateDish}
          className="btn btn-primary mt-4 w-full rounded-full py-2.5 text-[13px] font-semibold disabled:opacity-50"
          style={{ borderRadius: 'var(--radius-pill)' }}
        >
          сохранить
        </button>
      </details>

      {error && <p className="text-[12px] font-semibold text-red-600">{error}</p>}

      {/* Список по категориям */}
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[13px] font-extrabold tracking-tight text-[color:var(--text)]">блюда по категориям</span>
          <button
            type="button"
            onClick={() => setSelectMode((s) => !s)}
            className={cn(
              'rounded-full px-3 py-1.5 text-[12px] font-semibold transition',
              selectMode
                ? 'bg-[color:var(--surface-strong)] text-[color:var(--text)]'
                : 'bg-[color:var(--surface)] text-[color:var(--muted)]'
            )}
            style={{ borderRadius: 'var(--radius-pill)' }}
          >
            {selectMode ? 'готово' : 'выбрать'}
          </button>
          {selectMode && (selectedDishIds.size > 0 || selectedCategoryIds.size > 0) && (
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
              {selectedDishIds.size > 0 && (
                <button
                  type="button"
                  onClick={deleteSelectedDishes}
                  className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-[12px] font-semibold text-red-700 transition active:opacity-80"
                  style={{ borderRadius: 'var(--radius-pill)' }}
                >
                  × блюда ({selectedDishIds.size})
                </button>
              )}
            </div>
          )}
        </div>
        {categories.length > 0 && (
          <div className="mb-3 min-w-0 rounded-2xl border border-[color:var(--stroke)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-soft)]">
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
              {!selectedCategoryFilter && categories.length > 0 && (
                <button
                  type="button"
                  onClick={deleteAllMenu}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[color:var(--muted)] transition hover:bg-red-50 hover:text-red-600"
                  aria-label="удалить все категории"
                >
                  ×
                </button>
              )}
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className={cn(
                    'flex items-center gap-1 shrink-0',
                    draggingCategoryId === cat.id && 'opacity-70'
                  )}
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
                    {cat.emoji ? <span>{cat.emoji}</span> : null}
                    {cat.name}
                    <span className="text-[11px] opacity-75">({dishesByCategory.get(cat.id)?.length ?? 0})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteCategory(cat.id)}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[color:var(--muted)] transition hover:bg-red-50 hover:text-red-600"
                    aria-label={`удалить ${cat.name}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        {loading ? (
          <div className={cardClass} style={cardRadius}>
            <span className="ui-muted text-[13px]">загрузка…</span>
          </div>
        ) : dishes.length === 0 ? (
          <div className={cardClass} style={cardRadius}>
            <p className="ui-muted text-[13px]">Пока нет блюд. Создайте категорию и добавьте блюдо.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {(filteredCategories.length ? filteredCategories : categories.length ? categories : [{ id: 'uncat', name: 'без категории', slug: 'uncat' }]).map((cat) => {
              const list = dishesByCategory.get(cat.id) ?? []
              const isCategoryOpen = openCategoryIds.has(cat.id)
              return (
                <div key={cat.id} className={cn('overflow-visible', cardClass)} style={cardRadius}>
                    <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      {selectMode && (
                        <input
                          type="checkbox"
                          checked={selectedCategoryIds.has(cat.id)}
                          onChange={() => toggleCategorySelection(cat.id)}
                          className="h-4 w-4 shrink-0"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => setEditingCategoryEmojiId(editingCategoryEmojiId === cat.id ? null : cat.id)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--surface)] text-[18px] transition hover:bg-[color:var(--surface-strong)]"
                        style={{ borderRadius: 'var(--radius-pill)' }}
                        title="сменить эмодзи"
                      >
                        {cat.emoji || '🍛'}
                      </button>
                      {editingCategoryEmojiId === cat.id && (
                        <div className="flex-1 min-w-[200px]">
                          <div className="flex flex-wrap gap-1.5">
                            {EMOJI_OPTIONS.slice(0, 8).map((emoji) => (
                              <button
                                key={`${cat.id}-${emoji}`}
                                type="button"
                                onClick={() => {
                                  updateCategory(cat.id, { emoji })
                                  setEditingCategoryEmojiId(null)
                                }}
                                className={cn(
                                  'rounded-full border px-2 py-1 text-[13px] transition',
                                  cat.emoji === emoji
                                    ? 'border-[color:var(--accent)] bg-[color:var(--accent)]/10'
                                    : 'border-[color:var(--stroke)] bg-[color:var(--surface)]'
                                )}
                                style={{ borderRadius: 'var(--radius-pill)' }}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      <input
                        key={`cat-name-${cat.id}-${cat.name}`}
                        className="input input--pill min-w-0 max-w-[min(100%,240px)] text-[13px] font-extrabold tracking-tight text-[color:var(--text)]"
                        defaultValue={cat.name}
                        title="Название категории"
                        onBlur={(e) => {
                          const v = (e.target as HTMLInputElement).value.trim()
                          if (v && v !== cat.name) void updateCategory(cat.id, { name: v })
                        }}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setOpenCategoryIds((prev) => {
                            const next = new Set(prev)
                            if (next.has(cat.id)) next.delete(cat.id)
                            else next.add(cat.id)
                            return next
                          })
                        }
                        className="rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--muted)] transition"
                        style={{ borderRadius: 'var(--radius-pill)' }}
                      >
                        {isCategoryOpen ? 'свернуть' : `открыть (${list.length})`}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (editingCategoryId === cat.id) {
                            setEditingCategoryId(null)
                            setCategoryDrafts({})
                          } else {
                            setOpenCategoryIds((prev) => new Set(prev).add(cat.id))
                            startCategoryEdit(cat.id, list)
                          }
                        }}
                        className={cn(
                          'rounded-full border px-2.5 py-1 text-[11px] font-semibold transition',
                          editingCategoryId === cat.id
                            ? 'border-[color:var(--stroke)] bg-[color:var(--surface-strong)] text-[color:var(--text)]'
                            : 'border-[color:var(--stroke)] bg-[color:var(--surface)] text-[color:var(--muted)]'
                        )}
                        style={{ borderRadius: 'var(--radius-pill)' }}
                        title="Правка блюд в этой категории, не названия"
                      >
                        блюда
                      </button>
                      <details className="group">
                        <summary className="cursor-pointer list-none text-[11px] text-[color:var(--muted)] [&::-webkit-details-marker]:hidden">порядок и витрина</summary>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="text-[11px] text-[color:var(--muted)]" title="Порядок в списке">
                            №
                          </span>
                          <input
                            type="number"
                            min={0}
                            key={`${cat.id}-order-${cat.order ?? 0}`}
                            defaultValue={cat.order ?? 0}
                            title="Порядок"
                            className="input input--pill w-12 shrink-0 py-1 text-center text-[12px] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            onBlur={(e) => {
                              const v = Number((e.target as HTMLInputElement).value)
                              if (Number.isFinite(v) && v !== (cat.order ?? 0)) updateCategory(cat.id, { order: v })
                            }}
                          />
                          <span className="text-[11px] text-[color:var(--muted)]" title="Среднее время готовки, мин.">
                            гот., мин
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={120}
                            key={`${cat.id}-prep-${cat.prepTimeMinutes ?? ''}`}
                            placeholder="—"
                            title="Среднее время готовки (мин), для ориентира гостю"
                            className="input input--pill w-12 shrink-0 py-1 text-center text-[12px] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            defaultValue={cat.prepTimeMinutes ?? ''}
                            onBlur={(e) => {
                              const raw = (e.target as HTMLInputElement).value
                              const v = raw === '' ? null : Math.max(0, Math.min(120, Number(raw) || 0))
                              if (v !== (cat.prepTimeMinutes ?? null)) updateCategory(cat.id, { prepTimeMinutes: v })
                            }}
                          />
                          <span className="text-[11px] text-[color:var(--muted)]" title="Лимит позиций из категории в одном заказе">
                            макс/заказ
                          </span>
                          <input
                            type="number"
                            min={1}
                            max={100}
                            key={`${cat.id}-max-${cat.maxOrderQuantity ?? ''}`}
                            placeholder="—"
                            title="Максимум блюд из этой категории в одном заказе"
                            className="input input--pill w-12 shrink-0 py-1 text-center text-[12px] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            defaultValue={cat.maxOrderQuantity ?? ''}
                            onBlur={(e) => {
                              const raw = (e.target as HTMLInputElement).value
                              const v = raw === '' ? null : Math.max(1, Math.min(100, Number(raw) || 10))
                              if (v !== (cat.maxOrderQuantity ?? null)) updateCategory(cat.id, { maxOrderQuantity: v })
                            }}
                          />
                        </div>
                      </details>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteCategory(cat.id)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[color:var(--stroke)] text-[16px] leading-none text-[color:var(--muted)] transition hover:bg-red-50 hover:border-red-200 hover:text-red-600"
                      aria-label="удалить категорию"
                    >
                      ×
                    </button>
                  </div>
                  {isCategoryOpen && editingCategoryId === cat.id && (
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
                  {isCategoryOpen && <div className="overflow-x-auto pb-2 [scrollbar-width:thin] [-webkit-overflow-scrolling:touch]">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {list.length === 0 ? (
                      <p className="ui-muted py-4 text-[12px]">нет блюд</p>
                    ) : list.map((d) => {
                      const isCategoryEditing = editingCategoryId === cat.id
                      const categoryForm = isCategoryEditing ? categoryDrafts[d.id] : null
                      const isEditing = editingDishId === d.id
                      const form = isEditing ? editForm : null
                      const previewDish = form
                        ? {
                            ...d,
                            name: form.name,
                            price: form.price,
                            description: form.description,
                            weightLabel: form.weightLabel,
                            isAvailable: form.isAvailable,
                            tags: form.tags,
                            image: form.image ?? d.image,
                          }
                        : d
                      return (
                      <div key={d.id} className={cn('w-full', isCategoryEditing ? 'max-w-none' : isEditing && form ? 'max-w-none' : 'max-w-none')} style={{ borderRadius: 'var(--radius-medium)' }}>
                        <div className="flex items-start gap-2">
                          {selectMode && (
                            <input
                              type="checkbox"
                              checked={selectedDishIds.has(d.id)}
                              onChange={() => toggleDishSelection(d.id)}
                              className="mt-3 h-4 w-4 shrink-0"
                            />
                          )}
                          <div className={cn('min-w-0 flex-1 overflow-hidden border border-black/[0.06] bg-[color:var(--surface-strong)] shadow-[var(--shadow-soft)]', isCategoryEditing || (isEditing && form) ? 'p-4' : 'p-3')} style={{ borderRadius: 'var(--radius-large)' }}>
                            {isCategoryEditing && categoryForm ? (
                              <div className="space-y-3">
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                  <input
                                    className="input input--pill w-full text-[12px] sm:col-span-2"
                                    placeholder="Название"
                                    value={categoryForm.name}
                                    onChange={(e) => updateCategoryDraft(d.id, { name: e.target.value })}
                                  />
                                  <div className="sm:col-span-2">
                                    <span className="text-[11px] font-semibold text-[color:var(--muted)]">Эмодзи</span>
                                    <div className="mt-1 flex flex-wrap gap-1.5">
                                      {EMOJI_OPTIONS.map((emoji) => (
                                        <button
                                          key={`${d.id}-${emoji}`}
                                          type="button"
                                          onClick={() => updateCategoryDraft(d.id, { emoji })}
                                          className={cn(
                                            'rounded-full border px-2 py-1 text-[13px] transition',
                                            categoryForm.emoji === emoji
                                              ? 'border-[color:var(--accent)] bg-[color:var(--accent)]/10'
                                              : 'border-[color:var(--stroke)] bg-[color:var(--surface)]'
                                          )}
                                          style={{ borderRadius: 'var(--radius-pill)' }}
                                        >
                                          {emoji}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                  <input
                                    className="input input--pill w-full text-[12px] sm:col-span-2"
                                    placeholder="Фото (URL)"
                                    value={categoryForm.image ?? ''}
                                    onChange={(e) => updateCategoryDraft(d.id, { image: e.target.value })}
                                  />
                                  <div className="sm:col-span-2">
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="text-[12px] file:mr-2 file:rounded-full file:border-0 file:bg-black/10 file:px-3 file:py-1.5 file:text-[12px] file:font-semibold"
                                      onChange={async (e) => {
                                        const file = e.target.files?.[0]
                                        if (!file) return
                                        const url = await uploadDishImage(file, `category-${d.id}`)
                                        if (url) updateCategoryDraft(d.id, { image: url })
                                        e.currentTarget.value = ''
                                      }}
                                    />
                                    {uploadingImageTarget === `category-${d.id}` && (
                                      <span className="ml-2 text-[11px] text-[color:var(--muted)]">загрузка фото…</span>
                                    )}
                                    {imageUploadError && (
                                      <p className="mt-1 text-[11px] font-medium text-red-600">{imageUploadError}</p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-semibold uppercase text-black/45">цена</span>
                                    <input
                                      className="input input--pill w-24 text-[12px]"
                                      type="number"
                                      placeholder="0"
                                      value={String(categoryForm.price)}
                                      onChange={(e) => updateCategoryDraft(d.id, { price: Number(e.target.value) || 0 })}
                                    />
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-semibold uppercase text-black/45">себес.</span>
                                    <input
                                      className="input input--pill w-28 text-[12px]"
                                      type="number"
                                      placeholder="0"
                                      value={String(categoryForm.costPrice)}
                                      onChange={(e) => updateCategoryDraft(d.id, { costPrice: Number(e.target.value) || 0 })}
                                    />
                                  </div>
                                  <label className="flex items-center gap-2 text-[12px]">
                                    <input
                                      type="checkbox"
                                      checked={categoryForm.isAvailable}
                                      onChange={(e) => updateCategoryDraft(d.id, { isAvailable: e.target.checked })}
                                    />
                                    доступно
                                  </label>
                                  <label className="flex items-center gap-2 text-[12px]">
                                    <input
                                      type="checkbox"
                                      checked={categoryForm.subscriptionEligible}
                                      onChange={(e) => updateCategoryDraft(d.id, { subscriptionEligible: e.target.checked })}
                                    />
                                    в подписку
                                  </label>
                                  <input
                                    className="input input--pill w-full text-[12px] sm:col-span-2"
                                    placeholder="Описание"
                                    value={categoryForm.description}
                                    onChange={(e) => updateCategoryDraft(d.id, { description: e.target.value })}
                                  />
                                  <input
                                    className="input input--pill w-full text-[12px] sm:col-span-2"
                                    placeholder="Вес / порция (витрина)"
                                    maxLength={120}
                                    value={categoryForm.weightLabel}
                                    onChange={(e) => updateCategoryDraft(d.id, { weightLabel: e.target.value })}
                                  />
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {DISH_TAGS.map((t) => (
                                    <button
                                      key={t.value}
                                      type="button"
                                      onClick={() => toggleCategoryDraftTag(d.id, t.value)}
                                      className={cn(
                                        'rounded-full px-2.5 py-1 text-[11px] font-medium transition',
                                        categoryForm.tags.includes(t.value)
                                          ? 'bg-black/15 text-black/90'
                                          : 'bg-black/[0.06] text-black/50'
                                      )}
                                      style={{ borderRadius: 'var(--radius-pill)' }}
                                    >
                                      {tagWithEmoji(t.value)}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ) : isEditing && form ? (
                              <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
                                {/* Live preview — обновляется сразу */}
                                <div className="w-full shrink-0">
                                  <div className="text-[11px] font-semibold text-black/50 mb-1.5">превью</div>
                                  <ProductCard
                                    id={d.id}
                                    name={form.name}
                                    description={form.description}
                                    price={form.price}
                                    image={form.image ?? d.image}
                                    isAvailable={form.isAvailable}
                                    variant="full"
                                    kind="restaurant"
                                    tags={form.tags}
                                    categoryIcon={form.emoji || cat.emoji || '🍛'}
                                    previewMode
                                    onImageClick={() => (document.getElementById(`dish-image-input-${d.id}`) as HTMLInputElement | null)?.click()}
                                    imageUploading={uploadingImageTarget === `edit-${d.id}`}
                                    imageClickHint="сменить фото"
                                    hideSecondaryLine
                                  />
                                  <input
                                    id={`dish-image-input-${d.id}`}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0]
                                      if (!file) return
                                      const url = await uploadDishImage(file, `edit-${d.id}`)
                                      if (url) setEditForm((s) => s ? { ...s, image: url } : null)
                                      e.currentTarget.value = ''
                                    }}
                                  />
                                </div>
                                {/* Форма — по ширине */}
                                <div className="flex-1 min-w-0 space-y-3">
                                  <div className="flex items-start justify-between gap-2">
                                    <span className="text-[12px] font-semibold text-[color:var(--muted)]">параметры</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingDishId(null)
                                        setEditForm(null)
                                        setEditOptionDrafts((prev) => {
                                          const next = { ...prev }
                                          delete next[d.id]
                                          return next
                                        })
                                        setNewOptionDraft((prev) => {
                                          const next = { ...prev }
                                          delete next[d.id]
                                          return next
                                        })
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
                                      value={form.name}
                                      onChange={(e) => setEditForm((s) => s ? { ...s, name: e.target.value } : null)}
                                    />
                                    <div className="sm:col-span-2">
                                      <label className="mb-1 block text-[11px] font-semibold text-black/50">Категория</label>
                                      <CustomSelect
                                        value={form.categoryId}
                                        onChange={(v) => setEditForm((s) => s ? { ...s, categoryId: v } : null)}
                                        placeholder="— выбрать —"
                                        options={categories.map((c) => ({ value: c.id, label: c.name }))}
                                      />
                                    </div>
                                    {imageUploadError && (
                                      <p className="text-[11px] font-medium text-red-600 sm:col-span-2">{imageUploadError}</p>
                                    )}
                                    <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-semibold uppercase text-black/45">цена</span>
                                        <input
                                          className="input input--pill w-24 text-[12px]"
                                          type="number"
                                          placeholder="0"
                                          value={String(form.price)}
                                          onChange={(e) => setEditForm((s) => s ? { ...s, price: Number(e.target.value) || 0 } : null)}
                                        />
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-semibold uppercase text-black/45">себес.</span>
                                        <input
                                          className="input input--pill w-28 text-[12px]"
                                          type="number"
                                          placeholder="0"
                                          value={String(form.costPrice)}
                                          onChange={(e) => setEditForm((s) => s ? { ...s, costPrice: Number(e.target.value) || 0 } : null)}
                                        />
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => setEditForm((s) => s ? { ...s, isAvailable: !s.isAvailable } : null)}
                                        className={cn(
                                          'rounded-full px-3 py-2 text-[12px] font-semibold transition',
                                          form.isAvailable ? 'bg-black text-white' : 'bg-black/[0.06] text-black/55'
                                        )}
                                        style={{ borderRadius: 'var(--radius-pill)' }}
                                      >
                                        доступно
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditForm((s) => s ? { ...s, subscriptionEligible: !s.subscriptionEligible } : null)}
                                        className={cn(
                                          'rounded-full px-3 py-2 text-[12px] font-semibold transition',
                                          form.subscriptionEligible ? 'bg-black text-white' : 'bg-black/[0.06] text-black/55'
                                        )}
                                        style={{ borderRadius: 'var(--radius-pill)' }}
                                      >
                                        в подписку
                                      </button>
                                    </div>
                                    <input
                                      className="input input--pill w-full text-[12px] sm:col-span-2"
                                      placeholder="Описание"
                                      value={form.description}
                                      onChange={(e) => setEditForm((s) => s ? { ...s, description: e.target.value } : null)}
                                    />
                                    <input
                                      className="input input--pill w-full text-[12px] sm:col-span-2"
                                      placeholder="Вес / порция (витрина), напр. 350 г"
                                      maxLength={120}
                                      value={form.weightLabel}
                                      onChange={(e) => setEditForm((s) => s ? { ...s, weightLabel: e.target.value } : null)}
                                    />
                                  </div>
                                  <details className="rounded-2xl border border-[color:var(--stroke)] bg-[color:var(--surface)] p-3">
                                    <summary className="flex cursor-pointer list-none items-center justify-between text-[12px] font-semibold text-[color:var(--text)] [&::-webkit-details-marker]:hidden">
                                      <span>медиа и форма</span>
                                      <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] text-black/65">
                                        {form.emoji || 'авто'}
                                      </span>
                                    </summary>
                                    <p className="mt-2 text-[11px] text-[color:var(--muted)]">
                                      Тап по фото в превью, чтобы заменить изображение
                                    </p>
                                    <div className="mt-3">
                                      <span className="text-[11px] font-semibold text-black/50">Эмодзи</span>
                                      <div className="mt-1 flex flex-wrap gap-1.5">
                                        {EMOJI_OPTIONS.map((emoji) => (
                                          <button
                                            key={`${d.id}-single-${emoji}`}
                                            type="button"
                                            onClick={() => setEditForm((s) => s ? { ...s, emoji } : null)}
                                            className={cn(
                                              'rounded-full border px-2 py-1 text-[13px] transition',
                                              form.emoji === emoji
                                                ? 'border-[color:var(--accent)] bg-[color:var(--accent)]/10'
                                                : 'border-[color:var(--stroke)] bg-[color:var(--surface)]'
                                            )}
                                            style={{ borderRadius: 'var(--radius-pill)' }}
                                          >
                                            {emoji}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                    <div className="mt-3">
                                      <label className="mb-1 block text-[11px] font-semibold text-black/50">Форма карточки</label>
                                      <div className="flex items-center gap-2">
                                        {(['auto', 'square', 'wide'] as const).map((shape) => {
                                          const active = getCardShapeFromTags(form.tags) === shape
                                          return (
                                            <button
                                              key={`${d.id}-shape-${shape}`}
                                              type="button"
                                              aria-label={`форма: ${shape}`}
                                              onClick={() => setEditForm((s) => s ? { ...s, tags: applyCardShapeTag(s.tags, shape) } : null)}
                                              className={cn(
                                                'inline-flex h-9 w-12 items-center justify-center rounded-xl border transition',
                                                active
                                                  ? 'border-[color:var(--accent)] bg-[color:var(--accent)]/10'
                                                  : 'border-[color:var(--stroke)] bg-[color:var(--surface)]'
                                              )}
                                              style={{ borderRadius: 'var(--radius-medium)' }}
                                            >
                                              {shape === 'auto' ? (
                                                <span className="h-2 w-2 rounded-full bg-black/50" />
                                              ) : shape === 'square' ? (
                                                <span className="h-5 w-5 rounded-[6px] border border-black/55" />
                                              ) : (
                                                <span className="h-4 w-7 rounded-[6px] border border-black/55" />
                                              )}
                                            </button>
                                          )
                                        })}
                                      </div>
                                    </div>
                                  </details>
                                  <div className="rounded-2xl border border-[color:var(--stroke)] bg-[color:var(--surface)] p-3">
                                    <div className="flex items-center justify-between gap-2">
                                      <div>
                                        <div className="text-[12px] font-semibold text-[color:var(--text)]">опции</div>
                                        <p className="mt-0.5 text-[11px] text-[color:var(--muted)]">
                                          выбрано: {(dishOptionDrafts[d.id] ?? []).length}
                                        </p>
                                      </div>
                                      <button
                                        type="button"
                                        className="btn btn-soft rounded-full px-3 py-1.5 text-[11px] font-semibold"
                                        style={{ borderRadius: 'var(--radius-pill)' }}
                                        onClick={() => {
                                          const el = document.getElementById('menu-option-groups') as HTMLDetailsElement | null
                                          if (el) el.open = true
                                          el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                                        }}
                                      >
                                        настроить
                                      </button>
                                    </div>
                                    <div className="mt-2 space-y-2">
                                      {menuOptionGroups.filter((group) => group.isActive !== false && group.values.some((v) => v.isActive !== false)).length === 0 ? (
                                        <p className="text-[11px] text-[color:var(--muted)]">
                                          Сначала добавьте группы и значения в блоке «опции блюд» выше.
                                        </p>
                                      ) : (
                                        menuOptionGroups
                                          .filter((group) => group.isActive !== false && group.values.some((v) => v.isActive !== false))
                                          .map((group) => (
                                            <div key={`dish-opt-group-${d.id}-${group.id}`}>
                                              <div className="mb-1 text-[11px] font-semibold text-[color:var(--muted)]">{group.name}</div>
                                              <div className="flex flex-wrap gap-1.5">
                                                {group.values
                                                  .filter((v) => v.isActive !== false)
                                                  .map((value) => {
                                                    const selected = (dishOptionDrafts[d.id] ?? []).some(
                                                      (item) => item.optionValueId === value.id
                                                    )
                                                    return (
                                                      <button
                                                        key={`dish-opt-val-${d.id}-${value.id}`}
                                                        type="button"
                                                        onClick={() => {
                                                          setDishOptionDrafts((prev) => {
                                                            const current = normalizeDishAssignedOptions(prev[d.id] ?? [])
                                                            const exists = current.some((item) => item.optionValueId === value.id)
                                                            const next = exists
                                                              ? current.filter((item) => item.optionValueId !== value.id)
                                                              : [...current, { optionValueId: value.id, priceAdjust: 0, isAvailable: true }]
                                                            return { ...prev, [d.id]: normalizeDishAssignedOptions(next) }
                                                          })
                                                        }}
                                                        className={cn(
                                                          'rounded-full px-2.5 py-1 text-[11px] font-semibold transition',
                                                          selected
                                                            ? 'bg-[color:var(--accent)] text-white'
                                                            : 'bg-black/[0.06] text-black/65'
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
                                      {(dishOptionDrafts[d.id] ?? []).length > 0 && (
                                        <div className="rounded-xl border border-[color:var(--stroke)] bg-[color:var(--surface)] p-2 space-y-1.5">
                                          {(dishOptionDrafts[d.id] ?? []).map((assigned, idx) => {
                                            const valueMeta = menuOptionGroups
                                              .flatMap((g) => g.values.map((v) => ({ groupName: g.name, ...v })))
                                              .find((v) => v.id === assigned.optionValueId)
                                            return (
                                              <div key={`dish-opt-price-${d.id}-${assigned.optionValueId}`} className="flex items-center gap-2">
                                                <span className="min-w-0 flex-1 truncate text-[11px] text-[color:var(--text)]">
                                                  {valueMeta ? `${valueMeta.groupName}: ${valueMeta.name}` : assigned.optionValueId}
                                                </span>
                                                <button
                                                  type="button"
                                                  title="в подписке"
                                                  onClick={() => {
                                                    setDishOptionDrafts((prev) => {
                                                      const current = normalizeDishAssignedOptions(prev[d.id] ?? [])
                                                      const next = current.map((item, i) =>
                                                        i === idx
                                                          ? { ...item, subscriptionEligible: item.subscriptionEligible === false }
                                                          : item
                                                      )
                                                      return { ...prev, [d.id]: normalizeDishAssignedOptions(next) }
                                                    })
                                                  }}
                                                  className={cn(
                                                    'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                                                    assigned.subscriptionEligible !== false
                                                      ? 'bg-emerald-100 text-emerald-800'
                                                      : 'bg-black/5 text-black/45'
                                                  )}
                                                >
                                                  sub
                                                </button>
                                                <input
                                                  type="number"
                                                  className="input input--pill w-20 py-1 text-center text-[11px]"
                                                  value={String(Number(assigned.priceAdjust || 0))}
                                                  onChange={(e) => {
                                                    const nextPrice = Number(e.target.value) || 0
                                                    setDishOptionDrafts((prev) => {
                                                      const current = normalizeDishAssignedOptions(prev[d.id] ?? [])
                                                      const next = current.map((item, i) =>
                                                        i === idx ? { ...item, priceAdjust: nextPrice } : item
                                                      )
                                                      return { ...prev, [d.id]: normalizeDishAssignedOptions(next) }
                                                    })
                                                  }}
                                                />
                                              </div>
                                            )
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <details className="rounded-2xl border border-[color:var(--stroke)] bg-[color:var(--surface)] p-3">
                                    <summary className="flex cursor-pointer list-none items-center justify-between text-[12px] font-semibold text-[color:var(--text)] [&::-webkit-details-marker]:hidden">
                                      <span>чипы</span>
                                      <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] text-black/65">
                                        {normalizeTags(form.tags).filter((tag) => !tag.startsWith('card-')).length}
                                      </span>
                                    </summary>
                                    <div className="mt-2 flex flex-wrap gap-1">
                                      {DISH_TAGS.map((t) => (
                                        <button
                                          key={t.value}
                                          type="button"
                                          onClick={() => toggleEditFormTag(t.value)}
                                          className={cn(
                                            'rounded-full px-2.5 py-1 text-[11px] font-medium transition',
                                            form.tags.includes(t.value)
                                              ? 'bg-black/15 text-black/90'
                                              : 'bg-black/[0.06] text-black/50'
                                          )}
                                          style={{ borderRadius: 'var(--radius-pill)' }}
                                        >
                                          {tagWithEmoji(t.value)}
                                        </button>
                                      ))}
                                    </div>
                                  </details>
                                  <div className="flex gap-2 pt-1">
                                    <button
                                      type="button"
                                      onClick={() => patchDish(d.id)}
                                      disabled={savingDishId === d.id}
                                      className="btn btn-primary flex-1 rounded-full py-2 text-[12px] font-semibold"
                                      style={{ borderRadius: 'var(--radius-pill)' }}
                                    >
                                      {savingDishId === d.id ? 'сохраняем…' : 'сохранить'}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={savingDishId === d.id}
                                      onClick={() => {
                                        setEditingDishId(null)
                                        setEditForm(null)
                                        setEditOptionDrafts((prev) => {
                                          const next = { ...prev }
                                          delete next[d.id]
                                          return next
                                        })
                                        setNewOptionDraft((prev) => {
                                          const next = { ...prev }
                                          delete next[d.id]
                                          return next
                                        })
                                      }}
                                      className="btn btn-soft rounded-full py-2 px-4 text-[12px] font-semibold"
                                      style={{ borderRadius: 'var(--radius-pill)' }}
                                    >
                                      закрыть
                                    </button>
                                  </div>
                                  {savingDishId === d.id && savingDishStep ? (
                                    <p className="mt-1 text-center text-[11px] text-[color:var(--muted)]">{savingDishStep}</p>
                                  ) : null}
                                </div>
                              </div>
                            ) : (
                              <ProductCard
                                id={d.id}
                                name={previewDish.name}
                                description={previewDish.description}
                                price={previewDish.price}
                                image={previewDish.image}
                                isAvailable={previewDish.isAvailable}
                                variant="full"
                                kind="restaurant"
                                tags={previewDish.tags}
                                categoryIcon={(isEditing && form ? form.emoji : d.emoji) || cat.emoji || '🍛'}
                                previewMode
                                hideSecondaryLine
                                onEdit={() => startEdit(d)}
                              />
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => deleteDish(d.id)}
                            className="flex h-7 w-7 shrink-0 items-center justify-center self-start rounded-full border border-black/10 text-[14px] leading-none text-black/45 transition hover:bg-red-50 hover:border-red-200 hover:text-red-600"
                            disabled={isCategoryEditing}
                            aria-label="удалить"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    )})}
                    </div>
                  </div>}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
