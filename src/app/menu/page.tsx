'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import type { Dish, Category } from '@/types'
import { useCartStore } from '@/store/cart-store'
import { useVenue } from '@/lib/venue-context'
import { IconChevronRight, IconHeart } from '@/components/ui/icons'
import { FilterBar } from '@/components/ui/FilterBar'
import { PillTabToggle } from '@/components/ui/PillTabToggle'
import { SearchInput } from '@/components/ui/SearchInput'
import { Chip } from '@/components/ui/Chip'
import { ProductCard } from '@/components/ui/ProductCard'
import { EmptyStatePlaceholder } from '@/components/ui/EmptyStatePlaceholder'
import { InlineCounter } from '@/components/ui/InlineCounter'
import { cn } from '@/lib/utils'
import { tagWithEmoji } from '@/lib/tag-labels'
import {
  dishMenuOrderHint,
  isDishMenuMetaTag,
  isDishOrderableForCart,
  isStoreProductOrderable,
  storeMenuOrderHint,
} from '@/lib/consumer-menu-orderable'
import { IMAGE_SIZES, OptimizedImage } from '@/components/ui/OptimizedImage'

type StoreCategory = { id: string; name: string; slug: string; emoji?: string }
type StoreVariant = { id: string; name: string; price: number; qty: number }
type StoreOptionValue = { id: string; name: string; priceAdjust?: number; order?: number }
type StoreOptionGroup = { id: string; name: string; order?: number; values: StoreOptionValue[] }
type StoreProduct = {
  id: string
  name: string
  description?: string | null
  image?: string | null
  categoryId: string
  variants: StoreVariant[]
  optionGroups?: StoreOptionGroup[]
  tags?: string[]
  emoji?: string | null
}
const ARCHIVE_CATEGORY_SLUG = '__archive'
/** Статика из `public/fonts/` — анимация на экране загрузки меню. */
const MENU_LOADING_GIF = '/fonts/free-animated-icon-frying-pan-15578744.gif'
const MENU_REVALIDATE_TTL_MS = 90 * 1000
const FOOD_CATEGORIES_CACHE_KEY_PREFIX = 'ufo:menu:food:categories:v4:'
const FAVORITES_CACHE_KEY_PREFIX = 'ufo:menu:favorites:v1:'
const STORE_FAVORITES_CACHE_KEY_PREFIX = 'ufo:menu:store:favorites:v1:'
const SELECTED_CATEGORY_CACHE_KEY_PREFIX = 'ufo:menu:selected-category:v1:'
const FAVORITES_CATEGORY_ID = '__favorites'
const STORE_FAVORITES_CATEGORY_ID = '__store_favorites'
/** «Всё меню» — как в ЛК; не пустая строка, чтобы эффекты не путали с «не выбрано». */
const MENU_ALL_CATEGORY_ID = '__ufo_all_menu__'
type FoodCache = {
  ts: number
  restaurantId?: string
  version?: string
  categories: Category[]
  dishes: Dish[]
  /** снимок флага при записи; иначе после включения меню TTL-кэш остаётся пустым */
  menuEnabled?: boolean
}
type StoreCache = {
  ts: number
  restaurantId?: string
  version?: string
  categories: StoreCategory[]
  products: StoreProduct[]
  storeEnabled?: boolean
}
type FavoritesCache = { ts: number; restaurantId?: string; ids: string[] }
const memoryFoodCache = new Map<string, FoodCache>()
const memoryStoreCache = new Map<string, StoreCache>()
const memoryFavoritesCache = new Map<string, FavoritesCache>()
const memoryStoreFavoritesCache = new Map<string, FavoritesCache>()

const DEMO_CATEGORIES: Category[] = [
  { id: 'demo-soups', name: 'супы', slug: 'soups' },
  { id: 'demo-mains', name: 'горячее', slug: 'mains' },
  { id: 'demo-salads', name: 'салаты', slug: 'salads' },
  { id: 'demo-drinks', name: 'напитки', slug: 'drinks' },
]

const DEMO_DISHES: Dish[] = [
  { id: 'demo-borscht', name: 'борщ', description: 'свекла, мясо, сметана', price: 180, categoryId: 'demo-soups', isAvailable: true },
  { id: 'demo-tom-yam', name: 'том ям', description: 'креветки, имбирь, лимонная трава', price: 220, categoryId: 'demo-soups', isAvailable: true },
  { id: 'demo-chicken-soup', name: 'куриный суп', description: 'лапша, курица, зелень', price: 150, categoryId: 'demo-soups', isAvailable: true },
  { id: 'demo-carbonara', name: 'паста карбонара', description: 'бекон, сливки, пармезан', price: 280, categoryId: 'demo-mains', isAvailable: true },
  { id: 'demo-salmon', name: 'стейк из лосося', description: '180 г, овощи гриль', price: 450, categoryId: 'demo-mains', isAvailable: true },
  { id: 'demo-rice-chicken', name: 'рис с курицей', description: 'карри, зелень', price: 200, categoryId: 'demo-mains', isAvailable: true },
  { id: 'demo-kiev', name: 'котлета по‑киевски', description: 'куриная грудка, масло', price: 320, categoryId: 'demo-mains', isAvailable: true },
  { id: 'demo-caesar', name: 'цезарь', description: 'курица, салат, пармезан', price: 250, categoryId: 'demo-salads', isAvailable: true },
  { id: 'demo-greek', name: 'греческий', description: 'фета, оливки, огурец', price: 190, categoryId: 'demo-salads', isAvailable: true },
  { id: 'demo-latte', name: 'латте', description: 'эспрессо, молоко', price: 120, categoryId: 'demo-drinks', isAvailable: true },
  { id: 'demo-juice', name: 'апельсиновый сок', description: 'свежевыжатый', price: 80, categoryId: 'demo-drinks', isAvailable: true },
  { id: 'demo-tea', name: 'чай зелёный', description: 'жасмин', price: 60, categoryId: 'demo-drinks', isAvailable: true },
  { id: 'demo-lemonade', name: 'лимонад', description: 'мятный, лёд', price: 90, categoryId: 'demo-drinks', isAvailable: true },
]

function getMenuCacheStorage(): Storage | null {
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

function readSessionCache<T>(key: string): T | null {
  const storage = getMenuCacheStorage()
  if (!storage) return null
  try {
    const raw = storage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function writeSessionCache(key: string, value: unknown) {
  const storage = getMenuCacheStorage()
  if (!storage) return
  try {
    storage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore storage errors
  }
}

function normalizeFavoriteIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return []
  return [...new Set(ids.map((id) => String(id || '').trim()).filter(Boolean))]
}

function writeFavoritesCache(restaurantId: string, ids: Iterable<string>) {
  const cache: FavoritesCache = {
    ts: Date.now(),
    restaurantId,
    ids: normalizeFavoriteIds(Array.from(ids)),
  }
  memoryFavoritesCache.set(restaurantId, cache)
  writeSessionCache(`${FAVORITES_CACHE_KEY_PREFIX}${restaurantId}`, cache)
}

function writeStoreFavoritesCache(restaurantId: string, ids: Iterable<string>) {
  const cache: FavoritesCache = {
    ts: Date.now(),
    restaurantId,
    ids: normalizeFavoriteIds(Array.from(ids)),
  }
  memoryStoreFavoritesCache.set(restaurantId, cache)
  writeSessionCache(`${STORE_FAVORITES_CACHE_KEY_PREFIX}${restaurantId}`, cache)
}

function normalizeStoreVariantName(value: unknown): string {
  const label = String(value ?? '').trim()
  const normalized = label.toLowerCase()
  if (!label || normalized === 'по умолчанию' || normalized === 'default') return ''
  return label
}

function readTelegramIdForActivity() {
  if (typeof window === 'undefined') return undefined
  try {
    const raw = window.localStorage.getItem('tg_user')
    const user = raw ? JSON.parse(raw) : null
    return user?.id ? String(user.id) : undefined
  } catch {
    return undefined
  }
}

function readTelegramInitData() {
  if (typeof window === 'undefined') return ''
  try {
    return String((window as any)?.Telegram?.WebApp?.initData || '')
  } catch {
    return ''
  }
}

function readTelegramUserId() {
  if (typeof window === 'undefined') return ''
  try {
    const fromUnsafe = String((window as any)?.Telegram?.WebApp?.initDataUnsafe?.user?.id || '').trim()
    if (fromUnsafe) return fromUnsafe
  } catch {
    // ignore
  }
  try {
    const initData = String((window as any)?.Telegram?.WebApp?.initData || '')
    if (initData) {
      const rawUser = new URLSearchParams(initData).get('user')
      if (rawUser) {
        const parsed = JSON.parse(rawUser)
        const fromInitData = String(parsed?.id || '').trim()
        if (fromInitData) return fromInitData
      }
    }
  } catch {
    // ignore
  }
  try {
    const raw = window.localStorage.getItem('tg_user')
    const parsed = raw ? JSON.parse(raw) : null
    return String(parsed?.id || '').trim()
  } catch {
    return ''
  }
}

function sendMenuActivity(type: string, metadata?: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  try {
    const payload = JSON.stringify({
      type,
      path: window.location.pathname,
      telegramId: readTelegramIdForActivity(),
      metadata,
    })
    void fetch('/api/activity', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payload,
      keepalive: true,
    })
  } catch {}
}

function sanitizeFoodCategoriesForClient(list: Category[]): Category[] {
  return (list || []).filter((c) => String(c?.slug || '').toLowerCase() !== ARCHIVE_CATEGORY_SLUG)
}

async function fetchMenuVersions(restaurantId: string): Promise<{ foodVersion: string; storeVersion: string } | null> {
  try {
    const res = await fetch('/api/menu/version', {
      cache: 'no-store',
      credentials: 'include',
      headers: { 'x-ufo-restaurant': restaurantId },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.ok) return null
    return {
      foodVersion: String(data.foodVersion || ''),
      storeVersion: String(data.storeVersion || ''),
    }
  } catch {
    return null
  }
}

function hashString(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0
  }
  return h
}

/** Индикатор свайпа в полноэкранном блюде: визуал как на главной, не больше 5 капсул. */
const MAX_VIEWER_SWIPE_DOTS = 5

type ViewerSwipeDots = {
  dotCount: number
  activeSlot: number
  dishIndexForSlot: (slot: number) => number
}

function getViewerSwipeDotsState(focusedIndex: number, total: number): ViewerSwipeDots | null {
  if (total <= 1 || focusedIndex < 0) return null
  if (total <= MAX_VIEWER_SWIPE_DOTS) {
    return {
      dotCount: total,
      activeSlot: Math.min(focusedIndex, total - 1),
      dishIndexForSlot: (slot: number) => Math.max(0, Math.min(total - 1, slot)),
    }
  }
  return {
    dotCount: MAX_VIEWER_SWIPE_DOTS,
    activeSlot: Math.round((focusedIndex / (total - 1)) * (MAX_VIEWER_SWIPE_DOTS - 1)),
    dishIndexForSlot: (slot: number) => Math.round((slot / (MAX_VIEWER_SWIPE_DOTS - 1)) * (total - 1)),
  }
}

function MenuPageInner() {
  const searchParams = useSearchParams()
  const { settings, restaurantId, isLoading: venueLoading } = useVenue()
  const { menuEnabled, storeEnabled } = settings
  const [mode, setMode] = useState<'food' | 'store'>('food')
  const [requestedCategory, setRequestedCategory] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string>(MENU_ALL_CATEGORY_ID)
  /** При «все меню» — какая категория сейчас у верхней границы (только подсвет чипов, без смены фильтра). */
  const [scrollSpyCategoryId, setScrollSpyCategoryId] = useState<string | null>(null)
  const suppressMenuScrollSpyRef = useRef(0)
  const filterBarChipsRef = useRef<HTMLDivElement | null>(null)
  const allMenuChipRef = useRef<HTMLButtonElement | null>(null)
  const [dishes, setDishes] = useState<Dish[]>([])
  const [foodCategories, setFoodCategories] = useState<Category[]>([])
  const [foodLoading, setFoodLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const addItem = useCartStore((s) => s.addItem)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const removeItem = useCartStore((s) => s.removeItem)
  const cartItems = useCartStore((s) => s.items)
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [storeFavorites, setStoreFavorites] = useState<Set<string>>(new Set())

  const [storeCategories, setStoreCategories] = useState<StoreCategory[]>([])
  const [storeProducts, setStoreProducts] = useState<StoreProduct[]>([])
  const [storeLoading, setStoreLoading] = useState(false)
  const [foodRefreshing, setFoodRefreshing] = useState(false)

  useEffect(() => {
    const m = String(searchParams?.get('mode') || '').trim()
    const category = String(searchParams?.get('category') || '').trim()
    if (category) setRequestedCategory(category)
    if (category && menuEnabled) setMode('food')
    if (m === 'food' && menuEnabled) setMode('food')
    else if (m === 'store' && storeEnabled) setMode('store')
  }, [searchParams, menuEnabled, storeEnabled])

  useEffect(() => {
    if (mode === 'food' && !menuEnabled && storeEnabled) setMode('store')
    else if (mode === 'store' && !storeEnabled && menuEnabled) setMode('food')
  }, [mode, menuEnabled, storeEnabled])

  useEffect(() => {
    if (mode !== 'food' || venueLoading || !restaurantId) return
    let cancelled = false
    async function loadFood() {
      const cacheKey = `ufo:menu:food:v4:${restaurantId}`
      const categoriesKey = `${FOOD_CATEGORIES_CACHE_KEY_PREFIX}${restaurantId}`
      const quickCategories = readSessionCache<{ ts: number; categories: Category[] }>(categoriesKey)
      if (quickCategories?.categories?.length) {
        setFoodCategories(sanitizeFoodCategoriesForClient(quickCategories.categories))
      }
      const memoryCached = memoryFoodCache.get(restaurantId) ?? null
      const storageCached = readSessionCache<FoodCache>(cacheKey)
      const rawCached = memoryCached ?? storageCached
      let cached = rawCached && (!rawCached.restaurantId || rawCached.restaurantId === restaurantId) ? rawCached : null
      const cachedLooksPoisoned = Boolean(
        cached &&
        Array.isArray(cached.categories) &&
        cached.categories.length > 0 &&
        Array.isArray(cached.dishes) &&
        cached.dishes.length === 0
      )
      if (cachedLooksPoisoned) {
        try {
          const st = getMenuCacheStorage()
          st?.removeItem(cacheKey)
          st?.removeItem(`${SELECTED_CATEGORY_CACHE_KEY_PREFIX}${restaurantId}:food`)
          memoryFoodCache.delete(restaurantId)
        } catch {
          // ignore
        }
        cached = null
      }
      const hasCachedData = Boolean(
        cached &&
        Array.isArray(cached.categories) &&
        Array.isArray(cached.dishes) &&
        !cachedLooksPoisoned
      )
      const menuCacheStale = Boolean(
        cached &&
        (cached.menuEnabled === undefined || cached.menuEnabled !== menuEnabled)
      )
      const freshCached = Boolean(
        cached &&
        !cachedLooksPoisoned &&
        !menuCacheStale &&
        Date.now() - Number(cached.ts || 0) < MENU_REVALIDATE_TTL_MS
      )
      setFoodRefreshing(false)
      if (hasCachedData && cached && !menuCacheStale) {
        setFoodCategories(sanitizeFoodCategoriesForClient(cached.categories))
        setDishes(cached.dishes)
        setFoodLoading(false)
      } else {
        setFoodLoading(true)
      }
      // Нельзя выходить по TTL до проверки версии: иначе витрина до 90 с не видит правки из ЛК.
      const versions = await fetchMenuVersions(restaurantId)
      // Не выходить по версии, если кэш «ядовитый» (категории есть, блюд 0) — иначе навсегда не дернём API и витрина пустая.
      if (
        freshCached &&
        !cachedLooksPoisoned &&
        !menuCacheStale &&
        versions?.foodVersion &&
        cached?.version &&
        versions.foodVersion === cached.version
      ) {
        const refreshed: FoodCache = {
          ts: Date.now(),
          restaurantId,
          version: cached.version,
          categories: sanitizeFoodCategoriesForClient(cached.categories),
          dishes: cached.dishes,
          menuEnabled: cached.menuEnabled ?? false,
        }
        memoryFoodCache.set(restaurantId, refreshed)
        writeSessionCache(cacheKey, refreshed)
        writeSessionCache(categoriesKey, { ts: Date.now(), categories: refreshed.categories })
        return
      }
      if (hasCachedData) setFoodRefreshing(true)
      try {
        const [cRes, dRes] = await Promise.all([
          fetch('/api/categories', {
            cache: 'no-store',
            credentials: 'include',
            headers: { 'x-ufo-restaurant': restaurantId },
          }),
          fetch('/api/dishes', {
            cache: 'no-store',
            credentials: 'include',
            headers: { 'x-ufo-restaurant': restaurantId },
          }),
        ])
        let cData = await cRes.json().catch(() => null)
        let dData = await dRes.json().catch(() => null)
        const categoriesOk = cRes.ok && Array.isArray(cData)
        // Retry once for transient dishes failures (webview/network hiccups).
        let dResOk = dRes.ok
        if (!dResOk || !Array.isArray(dData)) {
          try {
            const dRetryRes = await fetch('/api/dishes', {
              cache: 'no-store',
              credentials: 'include',
              headers: { 'x-ufo-restaurant': restaurantId },
            })
            const dRetryData = await dRetryRes.json().catch(() => null)
            if (dRetryRes.ok && Array.isArray(dRetryData)) {
              dResOk = true
              dData = dRetryData
            }
          } catch {
            // ignore retry failure
          }
        }
        if (cancelled) return
        const cats = categoriesOk
          ? cData.map((c: any) => ({ id: c.id, name: c.name, slug: c.slug, emoji: c.emoji, description: c.description, image: c.image }))
          : []
        const mapGuestDish = (d: any) => ({
          id: d.id,
          name: d.name,
          description: d.description ?? undefined,
          weightLabel: d.weightLabel ?? undefined,
          price: Number(d.price ?? 0),
          image: d.image ?? undefined,
          emoji: d.emoji ?? undefined,
          categoryId: d.categoryId,
          isAvailable: Boolean(d.isAvailable ?? true),
          calories: d.calories,
          allergens: d.allergens,
          tags: d.tags,
          modifiers: (d.modifiers || []).map((m: any) => ({
            id: m.id,
            name: m.name,
            type: m.type ?? 'REMOVE',
            priceAdjust: Number(m.priceAdjust ?? 0),
            order: m.order,
          })),
          optionGroups: (d.optionGroups || []).map((group: any) => ({
            id: group.id,
            name: group.name,
            order: group.order,
            values: (group.values || []).map((value: any) => ({
              id: value.id,
              name: value.name,
              priceAdjust: Number(value.priceAdjust ?? 0),
              order: value.order,
            })),
          })),
          category: d.category,
        })
        let dishList =
          dResOk && Array.isArray(dData)
            ? dData.map(mapGuestDish)
            : []
        if (
          !cancelled &&
          restaurantId !== 'default' &&
          dResOk &&
          Array.isArray(dData) &&
          dData.length === 0 &&
          (cats.length > 0 || !categoriesOk)
        ) {
          for (let attempt = 0; attempt < 4; attempt++) {
            if (cancelled) break
            await new Promise((r) => setTimeout(r, 280 + attempt * 120))
            try {
              const r2 = await fetch('/api/dishes', {
                cache: 'no-store',
                credentials: 'include',
                headers: { 'x-ufo-restaurant': restaurantId },
              })
              const j2 = await r2.json().catch(() => null)
              if (r2.ok && Array.isArray(j2) && j2.length > 0) {
                dData = j2
                dResOk = true
                dishList = j2.map(mapGuestDish)
                break
              }
            } catch {
              // ignore
            }
          }
        }
        const useDemo = restaurantId === 'default' && cats.length === 0 && dishList.length === 0
        const legitimatelyEmptyMenu =
          restaurantId !== 'default' &&
          categoriesOk &&
          cats.length === 0 &&
          dResOk &&
          Array.isArray(dData) &&
          dData.length === 0
        const prevCategories =
          cached && Array.isArray(cached.categories) && cached.categories.length > 0
            ? sanitizeFoodCategoriesForClient(cached.categories)
            : []
        const quickCatsSanitized =
          quickCategories?.categories?.length && Array.isArray(quickCategories.categories)
            ? sanitizeFoodCategoriesForClient(quickCategories.categories)
            : []
        const nextCategoriesRaw =
          cats.length > 0
            ? cats
            : useDemo
              ? DEMO_CATEGORIES
              : !categoriesOk && prevCategories.length > 0
                ? prevCategories
                : !categoriesOk && quickCatsSanitized.length > 0
                  ? quickCatsSanitized
                  : []
        const nextCategories = sanitizeFoodCategoriesForClient(nextCategoriesRaw)
        const suspectEmptyDishesResponse =
          restaurantId !== 'default' &&
          dResOk &&
          Array.isArray(dData) &&
          dData.length === 0 &&
          !legitimatelyEmptyMenu
        const canUseFreshDishes =
          dishList.length > 0 || useDemo || (dResOk && Array.isArray(dData) && !suspectEmptyDishesResponse)
        const nextDishes = canUseFreshDishes
          ? (dishList.length > 0 ? dishList : useDemo ? DEMO_DISHES : [])
          : (cached?.dishes ?? [])
        setFoodCategories(nextCategories)
        if (canUseFreshDishes || (cached?.dishes?.length ?? 0) > 0) {
          setDishes(nextDishes)
        }
        const nextCache: FoodCache = {
          ts: Date.now(),
          restaurantId,
          version: versions?.foodVersion || `${nextCategories.length}:${nextDishes.length}`,
          categories: nextCategories,
          dishes: nextDishes,
          menuEnabled,
        }
        // Never poison cache with empty dishes when dishes endpoint failed.
        if (canUseFreshDishes || (cached?.dishes?.length ?? 0) > 0) {
          memoryFoodCache.set(restaurantId, nextCache)
          writeSessionCache(cacheKey, nextCache)
          writeSessionCache(categoriesKey, { ts: Date.now(), categories: nextCategories })
        } else {
          writeSessionCache(categoriesKey, { ts: Date.now(), categories: nextCategories })
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) {
          setFoodLoading(false)
          setFoodRefreshing(false)
        }
      }
    }
    loadFood()
    return () => {
      cancelled = true
      setFoodLoading(false)
      setFoodRefreshing(false)
    }
  }, [mode, restaurantId, venueLoading, menuEnabled])

  useEffect(() => {
    if (mode !== 'store' || venueLoading || !restaurantId) return
    let cancelled = false
    async function loadStore() {
      const cacheKey = `ufo:menu:store:${restaurantId}`
      const memoryCached = memoryStoreCache.get(restaurantId) ?? null
      const storageCached = readSessionCache<StoreCache>(cacheKey)
      const rawCached = memoryCached ?? storageCached
      const cached = rawCached && (!rawCached.restaurantId || rawCached.restaurantId === restaurantId) ? rawCached : null
      const hasCachedData = Boolean(cached && Array.isArray(cached.categories) && Array.isArray(cached.products))
      const storeCacheStale = Boolean(
        cached &&
        (cached.storeEnabled === undefined || cached.storeEnabled !== storeEnabled)
      )
      const freshCached = Boolean(
        cached &&
        !storeCacheStale &&
        Date.now() - Number(cached.ts || 0) < MENU_REVALIDATE_TTL_MS
      )
      if (hasCachedData && cached && !storeCacheStale) {
        setStoreCategories(cached.categories)
        setStoreProducts(cached.products)
        setStoreLoading(false)
      } else {
        setStoreLoading(true)
      }
      const versions = await fetchMenuVersions(restaurantId)
      if (
        freshCached &&
        versions?.storeVersion &&
        cached?.version &&
        versions.storeVersion === cached.version &&
        !storeCacheStale
      ) {
        const refreshed: StoreCache = {
          ts: Date.now(),
          restaurantId,
          version: cached.version,
          categories: cached.categories,
          products: cached.products,
          storeEnabled: cached.storeEnabled ?? false,
        }
        memoryStoreCache.set(restaurantId, refreshed)
        writeSessionCache(cacheKey, refreshed)
        return
      }
      try {
        const [cRes, pRes] = await Promise.all([
          fetch('/api/store/categories', {
            cache: 'no-store',
            credentials: 'include',
            headers: { 'x-ufo-restaurant': restaurantId },
          }),
          fetch('/api/store/products', {
            cache: 'no-store',
            credentials: 'include',
            headers: { 'x-ufo-restaurant': restaurantId },
          }),
        ])
        const cData = await cRes.json().catch(() => null)
        const pData = await pRes.json().catch(() => null)
        if (cancelled) return
        const nextCategories = cRes.ok && cData?.ok && Array.isArray(cData.categories) ? cData.categories : []
        const nextProducts = pRes.ok && pData?.ok && Array.isArray(pData.products) ? pData.products : []
        // Important: apply empty arrays too, otherwise deleted store data lingers in UI.
        setStoreCategories(nextCategories)
        setStoreProducts(nextProducts)
        const nextCache: StoreCache = {
          ts: Date.now(),
          restaurantId,
          version: versions?.storeVersion || `${nextCategories.length}:${nextProducts.length}`,
          categories: nextCategories,
          products: nextProducts,
          storeEnabled,
        }
        memoryStoreCache.set(restaurantId, nextCache)
        writeSessionCache(cacheKey, nextCache)
      } catch {
        // ignore
      } finally {
        if (!cancelled) setStoreLoading(false)
      }
    }
    loadStore()
    return () => {
      cancelled = true
      setStoreLoading(false)
    }
  }, [mode, restaurantId, venueLoading, storeEnabled])

  useEffect(() => {
    if (venueLoading || !restaurantId) return
    let cancelled = false
    const cacheKey = `${FAVORITES_CACHE_KEY_PREFIX}${restaurantId}`
    const cached = memoryFavoritesCache.get(restaurantId) ?? readSessionCache<FavoritesCache>(cacheKey)
    if (cached && (!cached.restaurantId || cached.restaurantId === restaurantId)) {
      const cachedIds = normalizeFavoriteIds(cached.ids)
      setFavorites(new Set(cachedIds))
      memoryFavoritesCache.set(restaurantId, { ...cached, ids: cachedIds })
    }
    const fetchFavorites = async () => {
      const doFetch = async () =>
        fetch('/api/favorites', {
          cache: 'no-store',
          credentials: 'include',
          headers: {
            'x-ufo-restaurant': restaurantId,
            'x-telegram-init-data': readTelegramInitData(),
            'x-telegram-start-param': String((window as any)?.Telegram?.WebApp?.initDataUnsafe?.start_param || ''),
            'x-telegram-user-id': readTelegramUserId(),
          },
        })
      let res = await doFetch()
      if (res.status === 401) {
        await new Promise((r) => setTimeout(r, 450))
        res = await doFetch()
      }
      if (res.status === 401) return
      const data = await res.json().catch(() => null)
      if (cancelled || !data?.ok || !Array.isArray(data.ids)) return
      const nextIds = normalizeFavoriteIds(data.ids)
      setFavorites(new Set(nextIds))
      writeFavoritesCache(restaurantId, nextIds)
    }
    void fetchFavorites().catch(() => {})
    return () => {
      cancelled = true
    }
  }, [restaurantId, venueLoading])
  useEffect(() => {
    if (venueLoading || !restaurantId) return
    const cacheKey = `${STORE_FAVORITES_CACHE_KEY_PREFIX}${restaurantId}`
    const cached = memoryStoreFavoritesCache.get(restaurantId) ?? readSessionCache<FavoritesCache>(cacheKey)
    if (cached && (!cached.restaurantId || cached.restaurantId === restaurantId)) {
      const ids = normalizeFavoriteIds(cached.ids)
      setStoreFavorites(new Set(ids))
      memoryStoreFavoritesCache.set(restaurantId, { ...cached, ids })
    }
  }, [restaurantId, venueLoading])

  const qtyById = useMemo(() => {
    const map = new Map<string, number>()
    for (const it of cartItems || []) {
      const id = String((it as any)?.dishId ?? '')
      if (!id) continue
      map.set(id, (map.get(id) ?? 0) + Number((it as any)?.quantity ?? 0))
    }
    return map
  }, [cartItems])

  const qtyByVariantId = useMemo(() => {
    const map = new Map<string, number>()
    for (const it of cartItems || []) {
      if ((it as any)?.kind !== 'store') continue
      const id = String((it as any)?.storeVariantId ?? '')
      if (!id) continue
      map.set(id, (map.get(id) ?? 0) + Number((it as any)?.quantity ?? 0))
    }
    return map
  }, [cartItems])
  const qtyByStoreLineId = useMemo(() => {
    const map = new Map<string, number>()
    for (const it of cartItems || []) {
      if ((it as any)?.kind !== 'store') continue
      const id = String((it as any)?.id ?? '')
      if (!id) continue
      map.set(id, (map.get(id) ?? 0) + Number((it as any)?.quantity ?? 0))
    }
    return map
  }, [cartItems])

  const baseDishes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return dishes.filter((dish) => {
      if (!q) return true
      return (
        dish.name.toLowerCase().includes(q) ||
        String(dish.description ?? '').toLowerCase().includes(q) ||
        String(dish.weightLabel ?? '').toLowerCase().includes(q)
      )
    })
  }, [dishes, searchQuery])

  const filteredDishes = useMemo(() => {
    return baseDishes.filter((dish) => {
      if (selectedCategory === FAVORITES_CATEGORY_ID) return favorites.has(dish.id)
      return (
        selectedCategory === MENU_ALL_CATEGORY_ID ||
        selectedCategory === '' ||
        dish.categoryId === selectedCategory
      )
    })
  }, [baseDishes, selectedCategory, favorites])

  const dishesByCategory = useMemo(() => {
    const map = new Map<string, Dish[]>()
    for (const d of baseDishes) {
      const key = String(d.categoryId ?? '')
      if (!key) continue
      const arr = map.get(key) ?? []
      arr.push(d)
      map.set(key, arr)
    }
    return map
  }, [baseDishes])

  const storeBaseFiltered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return storeProducts.filter((p) => {
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        String(p.description ?? '').toLowerCase().includes(q) ||
        (p.variants || []).some((v) => String(v.name || '').toLowerCase().includes(q))
      return matchesSearch
    })
  }, [storeProducts, searchQuery])

  const storeFiltered = useMemo(() => {
    return storeBaseFiltered.filter((p) => {
      if (selectedCategory === STORE_FAVORITES_CATEGORY_ID) return storeFavorites.has(p.id)
      return (
        selectedCategory === MENU_ALL_CATEGORY_ID ||
        selectedCategory === '' ||
        p.categoryId === selectedCategory
      )
    })
  }, [storeBaseFiltered, selectedCategory, storeFavorites])

  const storeByCategory = useMemo(() => {
    const map = new Map<string, StoreProduct[]>()
    for (const p of storeBaseFiltered) {
      const key = String(p.categoryId ?? '')
      if (!key) continue
      const arr = map.get(key) ?? []
      arr.push(p)
      map.set(key, arr)
    }
    return map
  }, [storeBaseFiltered])

  /** Порядок категорий из ЛК — для «все меню» и scroll-spy. */
  const foodMenuSections = useMemo(() => {
    if (mode !== 'food') return [] as Array<{ category: any; dishes: Dish[] }>
    const out: Array<{ category: any; dishes: Dish[] }> = []
    for (const c of foodCategories as any[]) {
      const id = String(c?.id ?? '')
      if (!id) continue
      const list = dishesByCategory.get(id) ?? []
      if (!list.length) continue
      out.push({ category: c, dishes: list })
    }
    return out
  }, [mode, foodCategories, dishesByCategory])

  const storeMenuSections = useMemo(() => {
    if (mode !== 'store') return [] as Array<{ category: any; products: StoreProduct[] }>
    const out: Array<{ category: any; products: StoreProduct[] }> = []
    for (const c of storeCategories as any[]) {
      const id = String(c?.id ?? '')
      if (!id) continue
      const list = storeByCategory.get(id) ?? []
      if (!list.length) continue
      out.push({ category: c, products: list })
    }
    return out
  }, [mode, storeCategories, storeByCategory])

  const foodLayoutSlices = useMemo(() => {
    if (mode !== 'food') return [] as Array<{ sectionId: string | null; heading: string | null; dishes: Dish[] }>
    if (selectedCategory === FAVORITES_CATEGORY_ID) {
      return [{ sectionId: null, heading: null, dishes: filteredDishes }]
    }
    if (selectedCategory === MENU_ALL_CATEGORY_ID || selectedCategory === '') {
      const slices = foodMenuSections.map(({ category, dishes }) => ({
        sectionId: String(category.id),
        heading: String(category.name || '').trim() || null,
        dishes,
      }))
      const used = new Set(slices.flatMap((s) => s.dishes.map((d) => d.id)))
      const orphans = filteredDishes.filter((d) => !used.has(d.id))
      if (orphans.length) {
        slices.push({
          sectionId: '__ufo_other_dishes__',
          heading: 'ещё в меню',
          dishes: orphans,
        })
      }
      return slices
    }
    const cat = (foodCategories as any[]).find((c) => String(c?.id) === String(selectedCategory))
    return [
      {
        sectionId: String(selectedCategory),
        heading: cat?.name ? String(cat.name).trim() : null,
        dishes: filteredDishes,
      },
    ]
  }, [mode, selectedCategory, filteredDishes, foodMenuSections, foodCategories])

  const storeLayoutSlices = useMemo(() => {
    if (mode !== 'store') return [] as Array<{ sectionId: string | null; heading: string | null; products: StoreProduct[] }>
    if (selectedCategory === STORE_FAVORITES_CATEGORY_ID) {
      return [{ sectionId: null, heading: null, products: storeFiltered }]
    }
    if (selectedCategory === MENU_ALL_CATEGORY_ID || selectedCategory === '') {
      const slices = storeMenuSections.map(({ category, products }) => ({
        sectionId: String(category.id),
        heading: String(category.name || '').trim() || null,
        products,
      }))
      const used = new Set(slices.flatMap((s) => s.products.map((p) => p.id)))
      const orphans = storeFiltered.filter((p) => !used.has(p.id))
      if (orphans.length) {
        slices.push({
          sectionId: '__ufo_other_store__',
          heading: 'ещё в магазине',
          products: orphans,
        })
      }
      return slices
    }
    const cat = (storeCategories as any[]).find((c) => String(c?.id) === String(selectedCategory))
    return [
      {
        sectionId: String(selectedCategory),
        heading: cat?.name ? String(cat.name).trim() : null,
        products: storeFiltered,
      },
    ]
  }, [mode, selectedCategory, storeFiltered, storeMenuSections, storeCategories])

  /** Секции с реальными категориями ЛК — для scroll-spy (без служебных «ещё»). */
  const foodScrollSpySlices = useMemo(
    () => foodLayoutSlices.filter((s) => s.sectionId && !String(s.sectionId).startsWith('__ufo')),
    [foodLayoutSlices]
  )
  const storeScrollSpySlices = useMemo(
    () => storeLayoutSlices.filter((s) => s.sectionId && !String(s.sectionId).startsWith('__ufo')),
    [storeLayoutSlices]
  )

  const categories = useMemo(() => {
    if (mode !== 'food') {
      return storeFavorites.size > 0
        ? [{ id: STORE_FAVORITES_CATEGORY_ID, name: 'избранное', slug: 'favorites', emoji: '♥' }, ...(storeCategories as any[])]
        : (storeCategories as any[])
    }
    return favorites.size > 0
      ? [{ id: FAVORITES_CATEGORY_ID, name: 'избранное', slug: 'favorites', emoji: '♥' }, ...(foodCategories as any[])]
      : (foodCategories as any[])
  }, [mode, storeCategories, favorites, storeFavorites, foodCategories])

  useEffect(() => {
    if (!requestedCategory || mode !== 'food' || categories.length === 0) return
    const normalized = requestedCategory.toLowerCase()
    const match = categories.find((c: any) => {
      const bySlug = String(c?.slug || '').toLowerCase()
      const byId = String(c?.id || '').toLowerCase()
      return bySlug === normalized || byId === normalized
    })
    if (match?.id) {
      setSelectedCategory((prev) => (String(prev) === String(match.id) ? prev : String(match.id)))
    }
    setRequestedCategory('')
  }, [requestedCategory, mode, categories])
  const activeCategoryName = useMemo(() => {
    if (selectedCategory === FAVORITES_CATEGORY_ID || selectedCategory === STORE_FAVORITES_CATEGORY_ID) return 'Избранное'
    if (selectedCategory === MENU_ALL_CATEGORY_ID || selectedCategory === '') return 'Всё меню'
    const hit = categories.find((c) => String(c?.id) === String(selectedCategory))
    return String(hit?.name ?? (mode === 'store' ? 'Магазин' : 'Меню'))
  }, [categories, selectedCategory, mode])

  const isSearching = searchQuery.trim().length > 0
  const sectionLimit = 8

  useEffect(() => {
    const selectedCategoryKey = restaurantId ? `${SELECTED_CATEGORY_CACHE_KEY_PREFIX}${restaurantId}:${mode}` : ''
    const cachedSelected = selectedCategoryKey ? readSessionCache<{ id: string }>(selectedCategoryKey)?.id : ''
    const normalizedCache =
      cachedSelected === '' || cachedSelected === MENU_ALL_CATEGORY_ID ? MENU_ALL_CATEGORY_ID : cachedSelected
    const defaultCategory = () => {
      if (normalizedCache && categories.some((c: any) => String(c?.id) === String(normalizedCache))) {
        if (
          mode === 'food' &&
          String(normalizedCache) === FAVORITES_CATEGORY_ID &&
          favorites.size === 0
        ) {
          return MENU_ALL_CATEGORY_ID
        }
        if (
          mode === 'store' &&
          String(normalizedCache) === STORE_FAVORITES_CATEGORY_ID &&
          storeFavorites.size === 0
        ) {
          return MENU_ALL_CATEGORY_ID
        }
        return String(normalizedCache)
      }
      return MENU_ALL_CATEGORY_ID
    }

    if (categories.length === 0) {
      if (selectedCategory && selectedCategory !== MENU_ALL_CATEGORY_ID) setSelectedCategory(MENU_ALL_CATEGORY_ID)
      return
    }
    if (!selectedCategory || selectedCategory === '') {
      setSelectedCategory(defaultCategory())
      return
    }
    const exists =
      selectedCategory === MENU_ALL_CATEGORY_ID ||
      categories.some((c: any) => String(c?.id) === String(selectedCategory))
    if (!exists) {
      setSelectedCategory(defaultCategory())
      return
    }
    // Пока блюда ещё грузятся (baseDishes пустой), не считаем категорию «пустой» — иначе сброс на кэш (часто избранное) отменяет тап по чипу.
    // Во время фоновой подгрузки не перетираем выбранный чип из‑за временного рассинхрона.
    if (mode === 'food' && selectedCategory === FAVORITES_CATEGORY_ID && baseDishes.length > 0 && !foodRefreshing) {
      const anyFavoriteVisible = baseDishes.some((d) => favorites.has(d.id))
      if (!anyFavoriteVisible) {
        const fallback = categories.find((c: any) =>
          String(c?.id) !== FAVORITES_CATEGORY_ID &&
          baseDishes.some((d) => String(d.categoryId) === String(c?.id))
        )?.id
        if (fallback) {
          setSelectedCategory(String(fallback))
          return
        }
        setSelectedCategory(MENU_ALL_CATEGORY_ID)
      }
    }
    if (
      mode === 'store' &&
      selectedCategory === STORE_FAVORITES_CATEGORY_ID &&
      storeBaseFiltered.length > 0 &&
      !storeLoading
    ) {
      const anyStoreFavVisible = storeBaseFiltered.some((p) => storeFavorites.has(p.id))
      if (!anyStoreFavVisible) {
        const fallback = categories.find((c: any) =>
          String(c?.id) !== STORE_FAVORITES_CATEGORY_ID &&
          storeBaseFiltered.some((p) => String(p.categoryId) === String(c?.id))
        )?.id
        if (fallback) {
          setSelectedCategory(String(fallback))
          return
        }
        setSelectedCategory(MENU_ALL_CATEGORY_ID)
      }
    }
    if (
      mode === 'food' &&
      selectedCategory !== FAVORITES_CATEGORY_ID &&
      selectedCategory !== MENU_ALL_CATEGORY_ID &&
      baseDishes.length > 0 &&
      !foodRefreshing
    ) {
      const hasDishesInCategory = baseDishes.some((d) => String(d.categoryId) === String(selectedCategory))
      if (!hasDishesInCategory) {
        const fallback = categories.find((c: any) =>
          baseDishes.some((d) => String(d.categoryId) === String(c?.id))
        )?.id
        setSelectedCategory(String(fallback || defaultCategory()))
      }
    }
    if (
      mode === 'store' &&
      selectedCategory !== STORE_FAVORITES_CATEGORY_ID &&
      selectedCategory !== MENU_ALL_CATEGORY_ID &&
      storeBaseFiltered.length > 0 &&
      !storeLoading
    ) {
      const hasProducts = storeBaseFiltered.some((p) => String(p.categoryId) === String(selectedCategory))
      if (!hasProducts) {
        const fallback = categories.find((c: any) =>
          storeBaseFiltered.some((p) => String(p.categoryId) === String(c?.id))
        )?.id
        setSelectedCategory(String(fallback || defaultCategory()))
      }
    }
  }, [
    categories,
    selectedCategory,
    mode,
    baseDishes,
    storeBaseFiltered,
    restaurantId,
    favorites,
    storeFavorites,
    foodRefreshing,
    storeLoading,
  ])

  useEffect(() => {
    if (!restaurantId) return
    const exists =
      selectedCategory === MENU_ALL_CATEGORY_ID ||
      categories.some((c: any) => String(c?.id) === String(selectedCategory))
    if (!exists) return
    writeSessionCache(`${SELECTED_CATEGORY_CACHE_KEY_PREFIX}${restaurantId}:${mode}`, { id: selectedCategory, ts: Date.now() })
  }, [categories, mode, restaurantId, selectedCategory])

  const menuIsAllScope =
    selectedCategory === MENU_ALL_CATEGORY_ID || selectedCategory === ''

  useEffect(() => {
    if (!menuIsAllScope) setScrollSpyCategoryId(null)
  }, [menuIsAllScope, mode])

  useEffect(() => {
    if (mode !== 'food' || !menuIsAllScope || !foodScrollSpySlices.length) return
    let raf = 0
    const HEADER_ANCHOR = 112

    const tick = () => {
      if (suppressMenuScrollSpyRef.current > Date.now()) return
      let current: string | null = null
      for (const slice of foodScrollSpySlices) {
        const id = String(slice.sectionId)
        const el = document.getElementById(`cat-${id}`)
        if (!el) continue
        if (el.getBoundingClientRect().top <= HEADER_ANCHOR) current = id
      }
      setScrollSpyCategoryId((prev) => (prev === current ? prev : current))
    }

    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(tick)
    }

    tick()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [mode, menuIsAllScope, foodScrollSpySlices, foodLayoutSlices])

  useEffect(() => {
    if (mode !== 'store' || !menuIsAllScope || !storeScrollSpySlices.length) return
    let raf = 0
    const HEADER_ANCHOR = 112

    const tick = () => {
      if (suppressMenuScrollSpyRef.current > Date.now()) return
      let current: string | null = null
      for (const { category } of storeMenuSections) {
        const id = String(category.id)
        const el = document.getElementById(`cat-store-${id}`)
        if (!el) continue
        if (el.getBoundingClientRect().top <= HEADER_ANCHOR) current = id
      }
      setScrollSpyCategoryId((prev) => (prev === current ? prev : current))
    }

    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(tick)
    }

    tick()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [mode, menuIsAllScope, storeScrollSpySlices, storeLayoutSlices])

  useEffect(() => {
    if (!menuIsAllScope) return
    const bar = filterBarChipsRef.current
    const el = scrollSpyCategoryId
      ? categoryChipRefs.current.get(scrollSpyCategoryId)
      : allMenuChipRef.current
    if (!el || !bar) return
    try {
      const er = el.getBoundingClientRect()
      const br = bar.getBoundingClientRect()
      if (er.left < br.left + 10) {
        bar.scrollLeft += er.left - br.left - 16
      } else if (er.right > br.right - 10) {
        bar.scrollLeft += er.right - br.right + 16
      }
    } catch {
      // ignore
    }
  }, [scrollSpyCategoryId, menuIsAllScope, mode, categories])

  const categorySlugById = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of foodCategories as any[]) {
      if (c?.id && c?.slug) map.set(String(c.id), String(c.slug))
    }
    for (const c of storeCategories) {
      if (c?.id && c?.slug) map.set(String(c.id), String(c.slug))
    }
    return map
  }, [foodCategories, storeCategories])

  const getCategoryEmoji = (slug: string, isFood: boolean) => {
    const foodMap: Record<string, string> = {
      soups: '🍜',
      mains: '🍛',
      salads: '🥗',
      drinks: '🥤',
      popular: '🔥',
      burgers: '🍔',
      snacks: '🍟',
    }
    const storeMap: Record<string, string> = {
      frozen: '🥟',
      sauces: '🫙',
      drinks: '🥤',
    }
    const slugKey = String(slug || '').toLowerCase()
    if (isFood && foodMap[slugKey]) return foodMap[slugKey]
    if (!isFood && storeMap[slugKey]) return storeMap[slugKey]
    const foodFallback = ['🍽️', '🥘', '🍲', '🍱', '🥙', '🍳']
    const storeFallback = ['🛍️', '📦', '🧺', '🧴', '🫙', '🥫']
    const pool = isFood ? foodFallback : storeFallback
    return pool[hashString(slugKey || (isFood ? 'food' : 'store')) % pool.length]
  }

  const [focusedDishId, setFocusedDishId] = useState<string | null>(null)
  const [focusedOptionId, setFocusedOptionId] = useState<string | null>(null)
  const [focusedGroupSelections, setFocusedGroupSelections] = useState<Record<string, string>>({})
  const [focusedDraftQty, setFocusedDraftQty] = useState(1)
  const [focusedAddedPulse, setFocusedAddedPulse] = useState(false)
  const [focusedLikePulse, setFocusedLikePulse] = useState(false)
  const [focusedStoreProductId, setFocusedStoreProductId] = useState<string | null>(null)
  const [focusedStoreSelections, setFocusedStoreSelections] = useState<Record<string, string>>({})
  const [focusedStoreDraftQty, setFocusedStoreDraftQty] = useState(1)
  const [focusedStoreAddedPulse, setFocusedStoreAddedPulse] = useState(false)
  const categoryChipRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const chipScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const viewerDishes = baseDishes
  const focusedDish = useMemo(
    () => viewerDishes.find((dish) => dish.id === focusedDishId) ?? null,
    [viewerDishes, focusedDishId]
  )
  const focusedDishIndex = useMemo(
    () => viewerDishes.findIndex((dish) => dish.id === focusedDishId),
    [viewerDishes, focusedDishId]
  )
  const viewerSwipeDots = useMemo(
    () => getViewerSwipeDotsState(focusedDishIndex, viewerDishes.length),
    [focusedDishIndex, viewerDishes.length]
  )
  const focusedOptionModifiers = useMemo(
    () => (focusedDish?.modifiers ?? []).filter((m) => String(m.type || '').toUpperCase() === 'OPTION'),
    [focusedDish]
  )
  const focusedOptionGroups = focusedDish?.optionGroups ?? []
  const focusedSelectedOptionValues = useMemo(() => {
    return focusedOptionGroups
      .map((group) => {
        const selectedId = focusedGroupSelections[group.id]
        return group.values.find((value) => value.id === selectedId) ?? null
      })
      .filter(Boolean) as Array<{ id: string; name: string; priceAdjust: number }>
  }, [focusedOptionGroups, focusedGroupSelections])
  const focusedLegacyOption = focusedOptionModifiers.find((m) => m.id === focusedOptionId) ?? null
  const focusedOptionPriceAdjust = focusedSelectedOptionValues.reduce((sum, value) => sum + Number(value.priceAdjust || 0), 0) + Number(focusedLegacyOption?.priceAdjust || 0)
  const focusedUnitPrice = focusedDish ? focusedDish.price + focusedOptionPriceAdjust : 0
  const focusedCategory = useMemo(
    () => foodCategories.find((c) => String(c.id) === String(focusedDish?.categoryId ?? '')) ?? null,
    [foodCategories, focusedDish]
  )
  const focusedCategoryName = focusedCategory?.name || (focusedDish as any)?.category?.name || ''
  const focusedVisibleTags = useMemo(
    () => (Array.isArray(focusedDish?.tags) ? focusedDish.tags : [])
      .map((tag) => String(tag || '').trim())
      .filter((tag) => tag && !tag.startsWith('card-') && !isDishMenuMetaTag(tag))
      .slice(0, 4),
    [focusedDish]
  )
  const focusedDishOrderable = useMemo(
    () => (focusedDish ? isDishOrderableForCart(focusedDish) : false),
    [focusedDish]
  )
  const focusedModifierIds = [
    ...focusedSelectedOptionValues.map((value) => value.id),
    ...(focusedOptionId ? [focusedOptionId] : []),
  ]
  const focusedModifierLabels = [
    ...focusedSelectedOptionValues.map((value) => value.name),
    ...(focusedLegacyOption?.name ? [focusedLegacyOption.name] : []),
  ]
  const focusedLineId = useMemo(() => {
    if (!focusedDish) return ''
    const key = focusedModifierIds.length ? `_${[...focusedModifierIds].sort().join(',')}` : ''
    return `${focusedDish.id}${key}`
  }, [focusedDish, focusedModifierIds])
  const focusedQty = useMemo(() => {
    if (!focusedLineId) return 0
    const item = (cartItems || []).find((it: any) => String(it?.id ?? '') === focusedLineId)
    return item ? Number((item as any)?.quantity ?? 0) : 0
  }, [cartItems, focusedLineId])
  const focusedCheckoutQty = focusedQty > 0 ? focusedQty : focusedDraftQty
  const focusedTotalPrice = focusedUnitPrice * Math.max(1, focusedCheckoutQty)
  const swipeStartXRef = useRef<number | null>(null)
  const lastFocusedImageTapRef = useRef(0)
  const storeLineId = useCallback((variantId: string, modifierIds: string[]) => {
    const key = modifierIds.length ? `_${[...modifierIds].sort().join(',')}` : ''
    return `${variantId}${key}`
  }, [])
  const focusedStoreProduct = useMemo(
    () => storeProducts.find((p) => p.id === focusedStoreProductId) ?? null,
    [storeProducts, focusedStoreProductId]
  )
  const focusedStoreIndex = useMemo(
    () => storeFiltered.findIndex((p) => p.id === focusedStoreProductId),
    [storeFiltered, focusedStoreProductId]
  )
  const focusedStoreVariant = focusedStoreProduct?.variants?.[0] ?? null
  const focusedStoreGroups = focusedStoreProduct?.optionGroups ?? []
  const focusedStoreSelectedValues = useMemo(() => {
    return focusedStoreGroups
      .map((group) => {
        const selectedId = focusedStoreSelections[group.id]
        return group.values.find((value) => value.id === selectedId) ?? null
      })
      .filter(Boolean) as StoreOptionValue[]
  }, [focusedStoreGroups, focusedStoreSelections])
  const focusedStoreModifierIds = focusedStoreSelectedValues.map((v) => v.id)
  const focusedStoreModifierLabels = focusedStoreSelectedValues.map((v) => v.name)
  const focusedStoreUnitPrice = Number(focusedStoreVariant?.price ?? 0) + focusedStoreSelectedValues.reduce((sum, v) => sum + Number(v.priceAdjust ?? 0), 0)
  const focusedStoreLine = focusedStoreVariant?.id ? storeLineId(String(focusedStoreVariant.id), focusedStoreModifierIds) : ''
  const focusedStoreQty = focusedStoreLine ? qtyByStoreLineId.get(focusedStoreLine) ?? 0 : 0
  const focusedStoreCheckoutQty = focusedStoreQty > 0 ? focusedStoreQty : focusedStoreDraftQty
  const focusedStoreTotalPrice = focusedStoreUnitPrice * Math.max(1, focusedStoreCheckoutQty)
  const focusedStoreOrderable = useMemo(
    () => (focusedStoreProduct ? isStoreProductOrderable(focusedStoreProduct as StoreProduct) : false),
    [focusedStoreProduct]
  )
  const focusStoreByOffset = useCallback((delta: number) => {
    if (!storeFiltered.length || focusedStoreIndex < 0) return
    const next = Math.max(0, Math.min(storeFiltered.length - 1, focusedStoreIndex + delta))
    const nextProduct = storeFiltered[next]
    if (nextProduct?.id && nextProduct.id !== focusedStoreProductId) {
      setFocusedStoreProductId(nextProduct.id)
    }
  }, [storeFiltered, focusedStoreProductId, focusedStoreIndex])

  const focusDishByOffset = useCallback((delta: number) => {
    if (!viewerDishes.length || focusedDishIndex < 0) return
    const next = Math.max(0, Math.min(viewerDishes.length - 1, focusedDishIndex + delta))
    const nextDish = viewerDishes[next]
    if (nextDish?.id && nextDish.id !== focusedDishId) {
      setFocusedDishId(nextDish.id)
    }
  }, [viewerDishes, focusedDishId, focusedDishIndex])

  useEffect(() => {
    if (!focusedDishId && !focusedStoreProductId) return
    const prevHtmlOverflow = document.documentElement.style.overflow
    const prevBodyOverflow = document.body.style.overflow
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow
      document.body.style.overflow = prevBodyOverflow
    }
  }, [focusedDishId, focusedStoreProductId])

  useEffect(() => {
    const nextSelections: Record<string, string> = {}
    for (const group of focusedDish?.optionGroups ?? []) {
      const firstValue = group.values?.[0]
      if (firstValue?.id) nextSelections[group.id] = firstValue.id
    }
    setFocusedGroupSelections(nextSelections)
    setFocusedOptionId(focusedDish?.optionGroups?.length ? null : (focusedOptionModifiers[0]?.id ?? null))
    setFocusedDraftQty(1)
    setFocusedAddedPulse(false)
    setFocusedLikePulse(false)
  }, [focusedDish, focusedDishId, focusedOptionModifiers])
  useEffect(() => {
    const nextSelections: Record<string, string> = {}
    for (const group of focusedStoreProduct?.optionGroups ?? []) {
      const firstValue = group.values?.[0]
      if (firstValue?.id) nextSelections[group.id] = firstValue.id
    }
    setFocusedStoreSelections(nextSelections)
    setFocusedStoreDraftQty(1)
    setFocusedStoreAddedPulse(false)
  }, [focusedStoreProduct, focusedStoreProductId])

  useEffect(() => {
    setFocusedDraftQty(1)
  }, [focusedLineId])
  useEffect(() => {
    setFocusedStoreDraftQty(1)
  }, [focusedStoreLine])

  useEffect(() => {
    if (!focusedDish?.id) return
    sendMenuActivity('VIEW_DISH', {
      dishId: focusedDish.id,
      dishName: focusedDish.name,
      price: focusedDish.price,
      categoryId: focusedDish.categoryId,
    })
  }, [focusedDish?.id])

  useEffect(() => {
    if (!focusedDishId || !focusedDish?.categoryId) return
    if (menuIsAllScope) return
    if (chipScrollTimerRef.current) clearTimeout(chipScrollTimerRef.current)
    chipScrollTimerRef.current = setTimeout(() => {
      const el = categoryChipRefs.current.get(String(focusedDish.categoryId))
      if (!el) return
      try {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
      } catch {
        // ignore
      }
    }, 80)
    return () => {
      if (chipScrollTimerRef.current) {
        clearTimeout(chipScrollTimerRef.current)
        chipScrollTimerRef.current = null
      }
    }
  }, [focusedDishId, focusedDish?.categoryId, menuIsAllScope])

  const handleToggleFavorite = (id: string) => {
    const wasFavorite = favorites.has(id)
    const dish = dishes.find((d) => d.id === id)
    sendMenuActivity(wasFavorite ? 'REMOVE_FAVORITE' : 'ADD_FAVORITE', {
      dishId: id,
      dishName: dish?.name,
      price: dish?.price,
      categoryId: dish?.categoryId,
    })
    setFavorites((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      if (restaurantId) writeFavoritesCache(restaurantId, next)
      return next
    })
    fetch(`/api/favorites${wasFavorite ? `?dishId=${encodeURIComponent(id)}` : ''}`, {
      method: wasFavorite ? 'DELETE' : 'POST',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        'x-ufo-restaurant': restaurantId,
        'x-telegram-init-data': readTelegramInitData(),
        'x-telegram-start-param': String((window as any)?.Telegram?.WebApp?.initDataUnsafe?.start_param || ''),
        'x-telegram-user-id': readTelegramUserId(),
      },
      body: wasFavorite ? undefined : JSON.stringify({ dishId: id }),
    }).then((res) => {
      if (res.status === 401) return
      if (res.ok) return
      setFavorites((prev) => {
        const next = new Set(prev)
        if (wasFavorite) next.add(id)
        else next.delete(id)
        if (restaurantId) writeFavoritesCache(restaurantId, next)
        return next
      })
    }).catch(() => {
      setFavorites((prev) => {
        const next = new Set(prev)
        if (wasFavorite) next.add(id)
        else next.delete(id)
        if (restaurantId) writeFavoritesCache(restaurantId, next)
        return next
      })
    })
  }

  const handleToggleStoreFavorite = (productId: string) => {
    setStoreFavorites((prev) => {
      const next = new Set(prev)
      if (next.has(productId)) next.delete(productId)
      else next.add(productId)
      if (restaurantId) writeStoreFavoritesCache(restaurantId, next)
      return next
    })
  }

  const handleFocusedImageTap = () => {
    if (!focusedDish) return
    const now = Date.now()
    const isDoubleTap = now - lastFocusedImageTapRef.current < 280
    lastFocusedImageTapRef.current = now
    if (!isDoubleTap) return
    if (!favorites.has(focusedDish.id)) handleToggleFavorite(focusedDish.id)
    setFocusedLikePulse(true)
    setTimeout(() => setFocusedLikePulse(false), 560)
    try {
      ;(window as any)?.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.('light')
    } catch {
      // ignore haptic failures outside Telegram
    }
  }

  const navOptions = useMemo(() => {
    const opts = [
      ...(menuEnabled ? [{ id: 'food', label: 'ресторан' }] : []),
      ...(storeEnabled ? [{ id: 'store', label: 'магазин' }] : []),
    ]
    return opts
  }, [menuEnabled, storeEnabled])

  /** Заглушка загрузки: по центру экрана под FilterBar (не «уголок» сверху). */
  const menuLoadingAreaClass =
    'flex w-full min-h-[min(72dvh,calc(100dvh-10.5rem))] flex-col items-center justify-center px-4 py-10'

  return (
    <main className="ui-container ui-screen menu-page flex min-h-dvh flex-col">
      <FilterBar
        ref={filterBarChipsRef}
        className="sticky top-0 z-30 mb-2 bg-[color:var(--surface)]/95 backdrop-blur supports-[backdrop-filter]:bg-[color:var(--surface)]/85"
        topLeft={
          navOptions.length > 0 ? (
            <PillTabToggle
              className="w-full"
              options={navOptions}
              value={navOptions.some((o) => o.id === mode) ? mode : navOptions[0]?.id ?? 'store'}
              onChange={(v) => {
                setMode(v as 'food' | 'store')
                setSelectedCategory(MENU_ALL_CATEGORY_ID)
                setScrollSpyCategoryId(null)
              }}
            />
          ) : null
        }
        search={
          <SearchInput
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="поиск"
          />
        }
        chips={
          <>
            <button
              type="button"
              ref={allMenuChipRef}
              onClick={() => {
                setSelectedCategory(MENU_ALL_CATEGORY_ID)
                setScrollSpyCategoryId(null)
                suppressMenuScrollSpyRef.current = Date.now() + 420
                try {
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                } catch {
                  // ignore
                }
              }}
              className="transition active:scale-[0.98]"
              aria-label="Всё меню"
            >
              <Chip
                accent={menuIsAllScope && !scrollSpyCategoryId}
                className="whitespace-nowrap py-2.5 px-4 text-[14px]"
              >
                все
              </Chip>
            </button>
            {categories.map((c: any) => {
              const favChip =
                c.id === FAVORITES_CATEGORY_ID || c.id === STORE_FAVORITES_CATEGORY_ID
              const chipActive = favChip
                ? selectedCategory === c.id
                : menuIsAllScope
                  ? scrollSpyCategoryId === String(c.id)
                  : selectedCategory === c.id
              const emoji = c.emoji || getCategoryEmoji(c.slug ?? c.id, mode === 'food')
              return (
                <button
                  key={c.id}
                  type="button"
                  ref={(el: HTMLButtonElement | null) => {
                    const key = String(c.id)
                    if (!el) categoryChipRefs.current.delete(key)
                    else categoryChipRefs.current.set(key, el)
                  }}
                  onClick={() => {
                    if (favChip) {
                      setScrollSpyCategoryId(null)
                      suppressMenuScrollSpyRef.current = Date.now() + 400
                      setSelectedCategory(c.id)
                      return
                    }
                    if (menuIsAllScope) {
                      suppressMenuScrollSpyRef.current = Date.now() + 450
                      setScrollSpyCategoryId(String(c.id))
                      const anchor =
                        mode === 'store' ? `cat-store-${String(c.id)}` : `cat-${String(c.id)}`
                      try {
                        document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      } catch {
                        // ignore
                      }
                      return
                    }
                    setSelectedCategory(c.id)
                    try {
                      const anchor =
                        mode === 'store' ? `cat-store-${String(c.id)}` : `cat-${String(c.id)}`
                      document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    } catch {
                      // ignore
                    }
                  }}
                  className="transition active:scale-[0.98]"
                >
                  <Chip
                    accent={chipActive}
                    className="whitespace-nowrap py-2.5 px-4 text-[14px]"
                  >
                    {emoji ? <span className="mr-2 text-[1.35em] leading-none" aria-hidden>{emoji}</span> : null}
                    {c.name}
                  </Chip>
                </button>
              )
            })}
          </>
        }
      />
      {!menuEnabled && !storeEnabled ? (
        <EmptyStatePlaceholder variant="delivery" />
      ) : mode === 'store' && !storeEnabled ? (
        <EmptyStatePlaceholder variant="store" message="Магазин временно недоступен. Настройте в ЛК." />
      ) : mode === 'food' && !menuEnabled ? (
        <EmptyStatePlaceholder variant="delivery" message="Меню временно недоступно. Настройте в ЛК." />
      ) : mode === 'food' ? (
        venueLoading ? (
          <div className={cn(menuLoadingAreaClass, 'flex-1')} role="status" aria-live="polite">
            <div className="ui-surface w-full max-w-sm overflow-hidden rounded-[var(--radius-large)] border border-[color:var(--stroke)] p-8 text-center shadow-[var(--shadow-soft)]">
              <img
                src={MENU_LOADING_GIF}
                alt=""
                width={200}
                height={200}
                className="mx-auto h-36 w-auto max-h-[40dvh] max-w-[min(220px,72vw)] object-contain"
                decoding="async"
              />
              <div className="ui-body mt-4 text-[16px]">открываем меню…</div>
            </div>
          </div>
        ) : restaurantId !== 'default' && foodCategories.length === 0 && dishes.length === 0 ? (
          <EmptyStatePlaceholder variant="menuEmpty" />
        ) : foodLoading ? (
          <div className={cn(menuLoadingAreaClass, 'flex-1')} role="status" aria-live="polite">
            <div className="ui-surface w-full max-w-3xl overflow-hidden rounded-[var(--radius-large)] border border-[color:var(--stroke)] p-5 shadow-[var(--shadow-soft)]">
              <div className="mb-4 flex flex-col items-center justify-center gap-3 text-center text-[14px] font-semibold text-[color:var(--muted)]">
                <img
                  src={MENU_LOADING_GIF}
                  alt=""
                  width={160}
                  height={160}
                  className="h-28 w-auto max-w-[min(200px,55vw)] object-contain"
                  decoding="async"
                />
                <span>загружаем меню…</span>
              </div>
              <div className="columns-2 gap-3 sm:columns-3">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div
                    key={`menu-skeleton-${idx}`}
                    className="mb-3 break-inside-avoid overflow-hidden rounded-[18px] border border-[color:var(--stroke)] bg-[color:var(--surface)]"
                  >
                    <div className={cn('relative bg-[color:var(--surface-strong)]', idx % 4 === 0 ? 'h-56' : 'h-40')}>
                      <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-transparent via-white/30 to-transparent" />
                      <div className="absolute inset-0 grid place-items-center">
                        <div className="h-8 w-8 rounded-full bg-white/60" />
                      </div>
                    </div>
                    <div className="border-t border-[color:var(--stroke)] px-3 py-2 text-center">
                      <div className="mx-auto h-4 w-4/5 animate-pulse rounded bg-[color:var(--surface-strong)]" />
                      <div className="mx-auto mt-2 h-3 w-16 animate-pulse rounded bg-[color:var(--surface-strong)]" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : filteredDishes.length === 0 ? (
          <div className="ui-section">
            <div className="ui-surface overflow-hidden p-6 text-center">
              <div className="ui-body">ничего не нашли</div>
            </div>
          </div>
        ) : (
          <div className="relative">
            {focusedDishId && (
              <button
                type="button"
                aria-label="закрыть превью блюда"
                onClick={() => setFocusedDishId(null)}
                className="fixed inset-0 z-[210] bg-[color:var(--bg)]/90 backdrop-blur-2xl [-webkit-backdrop-filter:blur(22px)] saturate-150 [html.dark_&]:bg-slate-950/30 [html.dark_&]:backdrop-blur-[40px] [html.dark_&]:[-webkit-backdrop-filter:blur(40px)_saturate(1.45)]"
              />
            )}
            {focusedDish && (
              <div className="fixed inset-0 z-[220] isolate animate-[fadeIn_.18s_ease-out]">
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 z-0 bg-[color:var(--bg)]/40 backdrop-blur-xl [-webkit-backdrop-filter:blur(18px)] [html.dark_&]:bg-slate-950/15 [html.dark_&]:backdrop-blur-2xl [html.dark_&]:[-webkit-backdrop-filter:blur(22px)_saturate(1.3)]"
                />
                <div
                  className="absolute inset-0 z-10 flex items-center justify-center px-3 pb-[calc(var(--ufo-bottomnav-h)+250px)] pt-12 sm:px-6"
                  onClick={(e) => e.stopPropagation()}
                  onTouchStart={(e) => { swipeStartXRef.current = e.touches[0]?.clientX ?? null }}
                  onTouchEnd={(e) => {
                    const start = swipeStartXRef.current
                    const end = e.changedTouches[0]?.clientX ?? null
                    swipeStartXRef.current = null
                    if (start == null || end == null) return
                    const dx = end - start
                    if (Math.abs(dx) < 42) return
                    if (dx < 0) focusDishByOffset(1)
                    else focusDishByOffset(-1)
                  }}
                >
                  <div className="relative h-full w-full max-w-[760px]">
                    <div className="absolute left-3 right-16 top-1 z-10">
                      <h2 className="max-w-[88%] text-[27px] font-extrabold leading-[0.96] tracking-[-0.04em] text-[color:var(--text)] sm:text-[38px]">
                        {focusedDish.name}
                      </h2>
                      <div className="mt-2 flex max-w-[92%] items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {focusedCategoryName && (
                          <span className="shrink-0 rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] px-3 py-1 text-[12px] font-extrabold text-[color:var(--muted)] shadow-[var(--shadow-soft)] backdrop-blur-md">
                            {focusedCategoryName}
                          </span>
                        )}
                        {focusedVisibleTags.map((tag) => (
                          <span
                            key={`focused-top-tag-${tag}`}
                            className="shrink-0 rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] px-3 py-1 text-[12px] font-extrabold text-[color:var(--text)] shadow-[var(--shadow-soft)] backdrop-blur-md"
                          >
                            {tagWithEmoji(tag)}
                          </span>
                        ))}
                        {favorites.has(focusedDish.id) && (
                          <span className="shrink-0 rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface)] px-3 py-1 text-[12px] font-extrabold text-rose-400 shadow-[var(--shadow-soft)] backdrop-blur-md">
                            ♥ избранное
                          </span>
                        )}
                      </div>
                    </div>
                    <div
                      className="relative h-full w-full"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleFocusedImageTap()
                      }}
                    >
                      {focusedDish.image ? (
                        <OptimizedImage
                          key={`focused-image-${focusedDish.id}`}
                          src={focusedDish.image}
                          alt={focusedDish.name}
                          sizes={IMAGE_SIZES.menuFullscreen}
                          priority
                          quality={86}
                          className="animate-[fadeIn_.24s_ease-out] object-contain px-1 pb-1 pt-10"
                        />
                      ) : (
                        <div className="grid h-full place-items-center pt-10 text-8xl">
                          {focusedDish.emoji || getCategoryEmoji(categorySlugById.get(focusedDish.categoryId) ?? focusedDish.categoryId, true)}
                        </div>
                      )}
                      {focusedLikePulse && (
                        <div className="pointer-events-none absolute inset-0 grid place-items-center">
                          <div className="animate-[ufo-emoji-pop_.56s_ease-out] text-[86px] leading-none text-rose-500 drop-shadow-[0_16px_34px_rgba(244,63,94,0.28)]">
                            ♥
                          </div>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setFocusedDishId(null)}
                      className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center text-[22px] leading-none text-[color:var(--muted)]"
                      aria-label="закрыть"
                    >
                      ×
                    </button>
                  </div>
                </div>

                <div className="pointer-events-none absolute inset-x-0 bottom-[calc(var(--ufo-bottomnav-h)+8px)] z-30">
                  <div className="pointer-events-auto mx-auto w-full max-w-[760px] px-3">
                    {viewerSwipeDots ? (
                      <div
                        className="mb-3 flex justify-center gap-2 pt-1"
                        role="tablist"
                        aria-label="навигация по блюдам свайпом"
                      >
                        {Array.from({ length: viewerSwipeDots.dotCount }).map((_, slot) => (
                          <button
                            key={slot}
                            type="button"
                            role="tab"
                            aria-selected={slot === viewerSwipeDots.activeSlot}
                            aria-label={`перейти к позиции ${viewerSwipeDots.dishIndexForSlot(slot) + 1}`}
                            onClick={() => {
                              const i = viewerSwipeDots.dishIndexForSlot(slot)
                              const d = viewerDishes[i]
                              if (d?.id) setFocusedDishId(d.id)
                            }}
                            className={cn(
                              'h-1.5 rounded-full transition-all',
                              slot === viewerSwipeDots.activeSlot
                                ? 'w-5 bg-[color:var(--accent)]'
                                : 'w-1.5 bg-[color:var(--stroke)]',
                            )}
                          />
                        ))}
                      </div>
                    ) : null}
                    <div
                      className={cn(
                        'ufo-drift-in text-[color:var(--text)] transition-transform duration-200',
                        focusedAddedPulse && 'scale-[1.015]'
                      )}
                    >
                      <div className="mb-2 rounded-[24px] border border-[color:var(--stroke)] bg-[color:var(--surface-strong)]/95 p-3 shadow-[var(--shadow-card)] backdrop-blur-xl [html.dark_&]:border-white/[0.1] [html.dark_&]:bg-white/[0.07] [html.dark_&]:shadow-[0_12px_40px_rgba(0,0,0,0.35)] [html.dark_&]:backdrop-blur-2xl">
                        {focusedDish.description && (
                          <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-[color:var(--muted)]">
                            {focusedDish.description}
                          </p>
                        )}
                        {focusedDish.weightLabel && String(focusedDish.weightLabel).trim() && (
                          <p className="mt-1.5 text-[12px] font-extrabold tabular-nums tracking-wide text-[color:var(--text)]">
                            {String(focusedDish.weightLabel).trim()}
                          </p>
                        )}
                      </div>
                      {focusedOptionGroups.length > 0 && (
                        <div
                          className={cn(
                            'mb-2 space-y-2.5 px-1',
                            !focusedDishOrderable && focusedQty === 0 && 'pointer-events-none opacity-45',
                          )}
                        >
                          {focusedOptionGroups.map((group) => (
                            <div key={`focused-group-${group.id}`}>
                              <div className="mb-1.5 px-1 text-[11px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">{group.name}</div>
                              <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                {group.values.map((value) => {
                                  const checked = focusedGroupSelections[group.id] === value.id
                                  return (
                                    <button
                                      key={value.id}
                                      type="button"
                                      onClick={() =>
                                        setFocusedGroupSelections((prev) => ({
                                          ...prev,
                                          [group.id]: value.id,
                                        }))
                                      }
                                      className={cn(
                                        'shrink-0 rounded-full border px-4 py-2.5 text-[14px] font-extrabold shadow-[var(--shadow-soft)] backdrop-blur-md transition active:scale-95',
                                        checked
                                          ? 'border-[color:var(--accent)] bg-[color:var(--accent)] text-white shadow-[var(--shadow-card)]'
                                          : 'border-[color:var(--stroke)] bg-[color:var(--surface-strong)] text-[color:var(--text)]'
                                      )}
                                    >
                                      {value.name}
                                      {value.priceAdjust > 0 ? ` +${value.priceAdjust} ฿` : ''}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {focusedOptionGroups.length === 0 && focusedOptionModifiers.length > 0 && (
                        <div
                          className={cn(
                            'mb-2 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
                            !focusedDishOrderable && focusedQty === 0 && 'pointer-events-none opacity-45',
                          )}
                        >
                          {focusedOptionModifiers.map((mod) => {
                            const checked = focusedOptionId === mod.id
                            return (
                              <button
                                key={mod.id}
                                type="button"
                                onClick={() => setFocusedOptionId((prev) => (prev === mod.id ? null : mod.id))}
                                className={cn(
                                  'shrink-0 rounded-full border px-4 py-2.5 text-[14px] font-extrabold shadow-[var(--shadow-soft)] backdrop-blur-md transition active:scale-95',
                                  checked
                                    ? 'border-[color:var(--accent)] bg-[color:var(--accent)] text-white shadow-[var(--shadow-card)]'
                                    : 'border-[color:var(--stroke)] bg-[color:var(--surface-strong)] text-[color:var(--text)]'
                                )}
                              >
                                {mod.name}
                                {mod.priceAdjust > 0 ? ` +${mod.priceAdjust} ฿` : ''}
                              </button>
                            )
                          })}
                        </div>
                      )}

                      <div className="rounded-[28px] border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] p-3 text-[color:var(--text)] shadow-[var(--shadow-card)] backdrop-blur-xl [html.dark_&]:border-white/[0.1] [html.dark_&]:bg-white/[0.08] [html.dark_&]:shadow-[0_16px_48px_rgba(0,0,0,0.4)] [html.dark_&]:backdrop-blur-2xl">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          {focusedDishOrderable || focusedUnitPrice > 0 ? (
                            <>
                              <div className="pl-1 text-[31px] font-extrabold leading-none tabular-nums text-[color:var(--text)]">
                                {focusedTotalPrice} ฿
                              </div>
                              <div className="pl-1 text-[11px] font-semibold text-[color:var(--muted)]">
                                {focusedCheckoutQty > 1 ? `${focusedUnitPrice} ฿ × ${focusedCheckoutQty}` : 'за порцию'}
                              </div>
                            </>
                          ) : (
                            <div className="pl-1 text-[20px] font-extrabold leading-tight text-[color:var(--muted)]">
                              цена по запросу
                            </div>
                          )}
                        </div>
                        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                          {focusedQty > 0 ? (
                            <InlineCounter
                              value={focusedQty}
                              onInc={() => {
                                if (!focusedDishOrderable) return
                                updateQuantity(focusedLineId, focusedQty + 1, 'dish')
                              }}
                              onDec={() => {
                                if (focusedQty <= 1) removeItem(focusedLineId, 'dish')
                                else updateQuantity(focusedLineId, focusedQty - 1, 'dish')
                              }}
                              max={focusedDish.maxOrderQuantity ?? 20}
                            />
                          ) : focusedDishOrderable ? (
                            <>
                              <div className="flex items-center rounded-full bg-[color:var(--surface)] p-1">
                                <button
                                  type="button"
                                  onClick={() => setFocusedDraftQty((q) => Math.max(1, q - 1))}
                                  className="grid h-8 w-8 place-items-center rounded-full text-[18px] font-bold text-[color:var(--text)]"
                                  aria-label="уменьшить количество"
                                >
                                  −
                                </button>
                                <span className="min-w-6 text-center text-[15px] font-extrabold tabular-nums">{focusedDraftQty}</span>
                                <button
                                  type="button"
                                  onClick={() => setFocusedDraftQty((q) => Math.min(focusedDish.maxOrderQuantity ?? 20, q + 1))}
                                  className="grid h-8 w-8 place-items-center rounded-full text-[18px] font-bold text-[color:var(--text)]"
                                  aria-label="увеличить количество"
                                >
                                  +
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  addItem(
                                    {
                                      dishId: focusedDish.id,
                                      name: focusedDish.name,
                                      description: focusedDish.description ?? undefined,
                                      price: focusedDish.price + focusedOptionPriceAdjust,
                                      quantity: focusedDraftQty,
                                      imageUrl: focusedDish.image ?? undefined,
                                      modifierIds: focusedModifierIds,
                                      modifierLabels: focusedModifierLabels,
                                    },
                                    restaurantId
                                  )
                                  sendMenuActivity('ADD_TO_CART', {
                                    kind: 'dish',
                                    dishId: focusedDish.id,
                                    dishName: focusedDish.name,
                                    price: focusedDish.price + focusedOptionPriceAdjust,
                                    quantity: focusedDraftQty,
                                    optionIds: focusedModifierIds,
                                    optionLabels: focusedModifierLabels,
                                  })
                                  setFocusedAddedPulse(true)
                                  setTimeout(() => setFocusedAddedPulse(false), 700)
                                  try {
                                    ;(window as any)?.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.('light')
                                  } catch {
                                    // ignore haptic failures outside Telegram
                                  }
                                }}
                                className={cn(
                                  'rounded-full bg-[color:var(--accent)] px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_8px_16px_rgba(0,0,0,0.2)] transition active:scale-95',
                                  focusedAddedPulse && 'bg-emerald-600'
                                )}
                              >
                                {focusedAddedPulse ? 'добавлено' : 'в корзину'}
                              </button>
                            </>
                          ) : (
                            <p className="max-w-[14rem] text-right text-[12px] font-semibold leading-snug text-[color:var(--muted)]">
                              {dishMenuOrderHint(focusedDish) || 'сейчас нельзя добавить в заказ'}
                            </p>
                          )}
                        </div>
                      </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div className="relative z-20 mt-4">
              {foodLayoutSlices.map((slice, sliceIdx) => {
                const sectionKey = slice.sectionId ?? `food-slice-${sliceIdx}`
                const dishIdxOffset = foodLayoutSlices
                  .slice(0, sliceIdx)
                  .reduce((acc, s) => acc + s.dishes.length, 0)
                const grid = (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
                    {slice.dishes.map((dish, idx) => {
                  const isFocused = focusedDishId === dish.id
                  const dishTags = Array.isArray(dish.tags) ? dish.tags.map((t) => String(t).toLowerCase()) : []
                  const orderable = isDishOrderableForCart(dish)
                  const menuHint = orderable ? null : dishMenuOrderHint(dish)
                  const isHeroByTag =
                    dishTags.includes('hit') ||
                    dishTags.includes('popular') ||
                    dishTags.includes('chef-choice')
                  const forcedWide = dishTags.includes('card-wide')
                  const sizeVariant = forcedWide || isHeroByTag ? 'wide' : 'standard'
                  const cardSpanClass =
                    sizeVariant === 'wide'
                      ? 'col-span-2'
                        : ''
                  const mediaHeightClass =
                    sizeVariant === 'wide' ? 'h-56 sm:h-64' : 'h-52 sm:h-58'
                  const catEmoji = foodCategories.find((cat) => cat.id === dish.categoryId)?.emoji
                  const fallback = dish.emoji ?? catEmoji ?? getCategoryEmoji(categorySlugById.get(dish.categoryId) ?? dish.categoryId, true)
                  const qty = qtyById.get(dish.id) ?? 0
                  const optionModifiers = (dish.modifiers ?? []).filter((m) => String(m.type || '').toUpperCase() === 'OPTION')
                  const hasOptions = optionModifiers.length > 0 || (dish.optionGroups ?? []).some((group) => group.values.length > 0)
                  const visibleTags = dishTags
                    .filter((tag) => tag && !tag.startsWith('card-') && !isDishMenuMetaTag(tag))
                    .slice(0, 1)
                  return (
                    <div
                      key={dish.id}
                      onClick={() => setFocusedDishId(dish.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setFocusedDishId(dish.id)
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      className={cn(
                        'group relative block w-full overflow-hidden rounded-[16px] border border-[color:var(--stroke)] bg-[color:var(--surface)] text-left shadow-[var(--shadow-soft)] transition',
                        cardSpanClass,
                        focusedDishId === dish.id && 'opacity-0 pointer-events-none',
                        focusedDishId && dish.id !== focusedDishId && 'pointer-events-none opacity-40 blur-[1px]',
                        !orderable && 'opacity-[0.78]',
                      )}
                    >
                      <div className={cn('relative overflow-hidden bg-[color:var(--surface-strong)]', mediaHeightClass)}>
                        {dish.image ? (
                          <OptimizedImage
                            src={dish.image}
                            alt={dish.name}
                            sizes={IMAGE_SIZES.menuGrid}
                            priority={dishIdxOffset + idx < 8}
                            quality={76}
                            className="object-cover transition duration-300 group-hover:scale-[1.03]"
                          />
                        ) : (
                          <div className="grid h-full place-items-center">
                            <div className="flex flex-col items-center">
                              <div className="grid h-16 w-16 place-items-center rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface)] text-4xl">
                                {fallback}
                              </div>
                            </div>
                          </div>
                        )}
                        {visibleTags.length > 0 && (
                          <div className="pointer-events-none absolute left-2 top-2 flex max-w-[72%] gap-1.5">
                            {visibleTags.map((tag) => (
                              <span
                                key={`${dish.id}-tag-${tag}`}
                                className="truncate rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface-strong)]/95 px-2.5 py-1 text-[11px] font-extrabold text-[color:var(--text)] shadow-[var(--shadow-soft)] backdrop-blur-md"
                                style={{ borderRadius: 'var(--radius-pill)' }}
                              >
                                {tagWithEmoji(tag)}
                              </span>
                            ))}
                          </div>
                        )}
                        <button
                          type="button"
                          aria-label={favorites.has(dish.id) ? 'убрать из избранного' : 'добавить в избранное'}
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleToggleFavorite(dish.id)
                          }}
                          className={cn(
                            'absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface-strong)]/95 text-[color:var(--muted)] shadow-[var(--shadow-soft)] backdrop-blur-md transition active:scale-95',
                            favorites.has(dish.id) && 'border-rose-400/30 text-rose-400'
                          )}
                        >
                          <IconHeart className={cn('h-4 w-4', favorites.has(dish.id) && 'fill-current')} />
                        </button>
                      </div>
                      <div className="flex items-end justify-between gap-2 p-2.5">
                        <div className="min-w-0 flex-1">
                          <div className={cn(
                            'min-h-[2.6rem] text-[14px] font-semibold leading-tight text-[color:var(--text)] line-clamp-2'
                          )}>
                            {dish.name}
                          </div>
                          <div
                            className={cn(
                              'mt-1 text-[16px] font-extrabold tabular-nums',
                              orderable ? 'text-[color:var(--text)]' : 'text-[color:var(--muted)]',
                            )}
                          >
                            {!orderable && Number(dish.price) <= 0
                              ? '—'
                              : hasOptions
                                ? `от ${dish.price} ฿`
                                : `${dish.price} ฿`}
                          </div>
                          {menuHint ? (
                            <div className="mt-0.5 text-[10px] font-semibold leading-tight text-[color:var(--muted)]">{menuHint}</div>
                          ) : null}
                        </div>
                        {qty > 0 && !hasOptions ? (
                          <div
                            className="flex shrink-0 items-center rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] p-1 shadow-[var(--shadow-soft)]"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                            }}
                          >
                            <button
                              type="button"
                              aria-label="убрать из корзины"
                              onClick={() => {
                                if (qty <= 1) removeItem(dish.id, 'dish')
                                else updateQuantity(dish.id, qty - 1, 'dish')
                              sendMenuActivity('REMOVE_FROM_CART', {
                                kind: 'dish',
                                dishId: dish.id,
                                dishName: dish.name,
                                quantity: 1,
                              })
                              }}
                              className="grid h-8 w-8 place-items-center rounded-full text-[17px] font-extrabold text-[color:var(--text)] active:scale-95"
                            >
                              −
                            </button>
                            <span className="min-w-5 text-center text-[13px] font-extrabold tabular-nums text-[color:var(--text)]">{qty}</span>
                            <button
                              type="button"
                              aria-label="добавить ещё"
                              onClick={() => {
                                if (!orderable) return
                                updateQuantity(dish.id, Math.min(qty + 1, dish.maxOrderQuantity ?? 20), 'dish')
                              }}
                              className="grid h-8 w-8 place-items-center rounded-full text-[17px] font-extrabold text-[color:var(--text)] active:scale-95"
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={!orderable && !hasOptions}
                            aria-label={hasOptions ? 'выбрать вариант' : 'добавить в корзину'}
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              if (hasOptions) {
                                setFocusedDishId(dish.id)
                                return
                              }
                              if (!orderable) return
                              addItem(
                                {
                                  dishId: dish.id,
                                  name: dish.name,
                                  description: dish.description ?? undefined,
                                  price: dish.price,
                                  quantity: 1,
                                  imageUrl: dish.image ?? undefined,
                                },
                                restaurantId
                              )
                              sendMenuActivity('ADD_TO_CART', {
                                kind: 'dish',
                                dishId: dish.id,
                                dishName: dish.name,
                                price: dish.price,
                                quantity: 1,
                              })
                            }}
                            className={cn(
                              'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] text-[18px] font-extrabold leading-none text-[color:var(--text)] shadow-[var(--shadow-soft)] transition active:scale-95',
                              !orderable && !hasOptions && 'cursor-not-allowed opacity-35',
                            )}
                          >
                            {hasOptions ? '›' : '+'}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                    })}
                  </div>
                )
                const heading =
                  slice.heading ? (
                    <h3 className="mb-2.5 px-0.5 text-[13px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">
                      {slice.heading}
                    </h3>
                  ) : null
                return slice.sectionId ? (
                  <section key={sectionKey} id={`cat-${slice.sectionId}`} className="mb-6 scroll-mt-[6.25rem]">
                    {heading}
                    {grid}
                  </section>
                ) : (
                  <div key={sectionKey} className="mb-2">
                    {heading}
                    {grid}
                  </div>
                )
              })}
            </div>
          </div>
        )
      ) : storeLoading ? (
        <EmptyStatePlaceholder variant="store" message="Загружаем магазин…" />
      ) : storeCategories.length === 0 && storeProducts.length === 0 ? (
        <EmptyStatePlaceholder variant="store" message="Магазин пуст. Добавьте товары в ЛК." />
      ) : storeFiltered.length === 0 ? (
        <div className="ui-section">
          <div className="ui-surface overflow-hidden p-6 text-center">
            <div className="ui-body">ничего не нашли</div>
          </div>
        </div>
      ) : (
        <div className="mt-6">
          {focusedStoreProductId && (
            <button
              type="button"
              aria-label="закрыть превью товара"
              onClick={() => setFocusedStoreProductId(null)}
              className="fixed inset-0 z-[210] bg-[color:var(--bg)]/90 backdrop-blur-2xl [-webkit-backdrop-filter:blur(22px)] saturate-150 [html.dark_&]:bg-slate-950/30 [html.dark_&]:backdrop-blur-[40px] [html.dark_&]:[-webkit-backdrop-filter:blur(40px)_saturate(1.45)]"
            />
          )}
          {focusedStoreProduct && (
            <div className="fixed inset-0 z-[220] isolate animate-[fadeIn_.18s_ease-out]">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 z-0 bg-[color:var(--bg)]/40 backdrop-blur-xl [-webkit-backdrop-filter:blur(18px)] [html.dark_&]:bg-slate-950/15 [html.dark_&]:backdrop-blur-2xl [html.dark_&]:[-webkit-backdrop-filter:blur(22px)_saturate(1.3)]"
              />
              <div
                className="absolute inset-0 z-10 flex items-center justify-center px-3 pb-[calc(var(--ufo-bottomnav-h)+250px)] pt-12 sm:px-6"
                onClick={(e) => e.stopPropagation()}
                onTouchStart={(e) => { swipeStartXRef.current = e.touches[0]?.clientX ?? null }}
                onTouchEnd={(e) => {
                  const start = swipeStartXRef.current
                  const end = e.changedTouches[0]?.clientX ?? null
                  swipeStartXRef.current = null
                  if (start == null || end == null) return
                  const dx = end - start
                  if (Math.abs(dx) < 42) return
                  if (dx < 0) focusStoreByOffset(1)
                  else focusStoreByOffset(-1)
                }}
              >
                <div className="relative h-full w-full max-w-[760px]">
                  <div className="absolute left-3 right-16 top-1 z-10">
                    <h2 className="max-w-[88%] text-[27px] font-extrabold leading-[0.96] tracking-[-0.04em] text-[color:var(--text)] sm:text-[38px]">
                      {focusedStoreProduct.name}
                    </h2>
                    <div className="mt-2 flex max-w-[92%] items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      <span className="shrink-0 rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] px-3 py-1 text-[12px] font-extrabold text-[color:var(--muted)] shadow-[var(--shadow-soft)] backdrop-blur-md">
                        {activeCategoryName}
                      </span>
                    </div>
                    {focusedStoreProduct.description ? (
                      <p className="mt-2 line-clamp-2 max-w-[82%] text-[13px] font-semibold leading-snug text-[color:var(--muted)]">
                        {focusedStoreProduct.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="relative h-full w-full">
                    {focusedStoreProduct.image ? (
                      <OptimizedImage
                        key={`focused-store-image-${focusedStoreProduct.id}`}
                        src={focusedStoreProduct.image}
                        alt={focusedStoreProduct.name}
                        sizes={IMAGE_SIZES.menuFullscreen}
                        priority
                        quality={86}
                        className="animate-[fadeIn_.24s_ease-out] object-contain px-1 pb-1 pt-24"
                      />
                    ) : (
                      <div className="grid h-full place-items-center pt-24 text-8xl">
                        {focusedStoreProduct.emoji || '🛒'}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setFocusedStoreProductId(null)}
                    className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center text-[22px] leading-none text-[color:var(--muted)]"
                    aria-label="закрыть"
                  >
                    ×
                  </button>
                </div>
              </div>
              <div className="pointer-events-none absolute inset-x-0 bottom-[calc(var(--ufo-bottomnav-h)+8px)] z-30">
                <div className="pointer-events-auto mx-auto w-full max-w-[760px] px-3">
                  {focusedStoreGroups.length > 0 && (
                    <div
                      className={cn(
                        'mb-2 space-y-2.5 px-1',
                        !focusedStoreOrderable && focusedStoreQty === 0 && 'pointer-events-none opacity-45',
                      )}
                    >
                      {focusedStoreGroups.map((group) => (
                        <div key={`store-focused-group-${group.id}`}>
                          <div className="mb-1.5 px-1 text-[11px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">{group.name}</div>
                          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {group.values.map((value) => {
                              const checked = focusedStoreSelections[group.id] === value.id
                              return (
                                <button
                                  key={`store-focused-value-${value.id}`}
                                  type="button"
                                  onClick={() => setFocusedStoreSelections((prev) => ({ ...prev, [group.id]: value.id }))}
                                  className={cn(
                                    'shrink-0 rounded-full border px-4 py-2.5 text-[14px] font-extrabold shadow-[var(--shadow-soft)] backdrop-blur-md transition active:scale-95',
                                    checked
                                      ? 'border-[color:var(--accent)] bg-[color:var(--accent)] text-white shadow-[var(--shadow-card)]'
                                      : 'border-[color:var(--stroke)] bg-[color:var(--surface-strong)] text-[color:var(--text)]'
                                  )}
                                >
                                  {value.name}
                                  {Number(value.priceAdjust || 0) > 0 ? ` +${Number(value.priceAdjust || 0)} ฿` : ''}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className={cn('ufo-drift-in text-[color:var(--text)] transition-transform duration-200', focusedStoreAddedPulse && 'scale-[1.015]')}>
                    <div className="rounded-[28px] border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] p-3 text-[color:var(--text)] shadow-[var(--shadow-card)] backdrop-blur-xl [html.dark_&]:border-white/[0.1] [html.dark_&]:bg-white/[0.08] [html.dark_&]:shadow-[0_16px_48px_rgba(0,0,0,0.4)] [html.dark_&]:backdrop-blur-2xl">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          {focusedStoreOrderable || focusedStoreUnitPrice > 0 ? (
                            <>
                              <div className="pl-1 text-[31px] font-extrabold leading-none tabular-nums text-[color:var(--text)]">
                                {focusedStoreTotalPrice} ฿
                              </div>
                              <div className="pl-1 text-[11px] font-semibold text-[color:var(--muted)]">
                                {focusedStoreCheckoutQty > 1 ? `${focusedStoreUnitPrice} ฿ × ${focusedStoreCheckoutQty}` : 'за порцию'}
                              </div>
                            </>
                          ) : (
                            <div className="pl-1 text-[20px] font-extrabold leading-tight text-[color:var(--muted)]">
                              цена по запросу
                            </div>
                          )}
                        </div>
                        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                          {focusedStoreQty > 0 ? (
                            <InlineCounter
                              value={focusedStoreQty}
                              onInc={() => {
                                if (!focusedStoreOrderable) return
                                updateQuantity(focusedStoreLine, focusedStoreQty + 1, 'store')
                              }}
                              onDec={() => {
                                if (focusedStoreQty <= 1) removeItem(focusedStoreLine, 'store')
                                else updateQuantity(focusedStoreLine, focusedStoreQty - 1, 'store')
                              }}
                              max={focusedStoreVariant?.qty ?? 999}
                            />
                          ) : focusedStoreOrderable ? (
                            <>
                              <div className="flex items-center rounded-full bg-[color:var(--surface)] p-1">
                                <button
                                  type="button"
                                  onClick={() => setFocusedStoreDraftQty((q) => Math.max(1, q - 1))}
                                  className="grid h-8 w-8 place-items-center rounded-full text-[18px] font-bold text-[color:var(--text)]"
                                  aria-label="уменьшить количество"
                                >
                                  −
                                </button>
                                <span className="min-w-6 text-center text-[15px] font-extrabold tabular-nums">{focusedStoreDraftQty}</span>
                                <button
                                  type="button"
                                  onClick={() => setFocusedStoreDraftQty((q) => Math.min(focusedStoreVariant?.qty ?? 999, q + 1))}
                                  className="grid h-8 w-8 place-items-center rounded-full text-[18px] font-bold text-[color:var(--text)]"
                                  aria-label="увеличить количество"
                                >
                                  +
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!focusedStoreVariant?.id) return
                                  addItem(
                                    {
                                      storeVariantId: String(focusedStoreVariant.id),
                                      productId: focusedStoreProduct.id,
                                      name: focusedStoreProduct.name,
                                      variantName: normalizeStoreVariantName(focusedStoreVariant.name) || undefined,
                                      description: focusedStoreProduct.description ?? undefined,
                                      price: focusedStoreUnitPrice,
                                      quantity: focusedStoreDraftQty,
                                      imageUrl: focusedStoreProduct.image ?? undefined,
                                      modifierIds: focusedStoreModifierIds,
                                      modifierLabels: focusedStoreModifierLabels,
                                    },
                                    restaurantId
                                  )
                                  sendMenuActivity('ADD_TO_CART', {
                                    kind: 'store',
                                    productId: focusedStoreProduct.id,
                                    storeVariantId: String(focusedStoreVariant.id),
                                    productName: focusedStoreProduct.name,
                                    price: focusedStoreUnitPrice,
                                    quantity: focusedStoreDraftQty,
                                    optionIds: focusedStoreModifierIds,
                                    optionLabels: focusedStoreModifierLabels,
                                  })
                                  setFocusedStoreAddedPulse(true)
                                  setTimeout(() => setFocusedStoreAddedPulse(false), 700)
                                }}
                                className={cn(
                                  'rounded-full bg-[color:var(--accent)] px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_8px_16px_rgba(0,0,0,0.2)] transition active:scale-95',
                                  focusedStoreAddedPulse && 'bg-emerald-600'
                                )}
                              >
                                {focusedStoreAddedPulse ? 'добавлено' : 'в корзину'}
                              </button>
                            </>
                          ) : (
                            <p className="max-w-[14rem] text-right text-[12px] font-semibold leading-snug text-[color:var(--muted)]">
                              {storeMenuOrderHint(focusedStoreProduct as StoreProduct) || 'сейчас нельзя добавить в заказ'}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="relative z-20 mt-3">
            {storeLayoutSlices.map((slice, sliceIdx) => {
              const sectionKey = slice.sectionId ?? `store-slice-${sliceIdx}`
              const productIdxOffset = storeLayoutSlices
                .slice(0, sliceIdx)
                .reduce((acc, s) => acc + s.products.length, 0)
              const grid = (
                <div className="grid grid-cols-2 gap-2 [grid-auto-flow:dense] sm:grid-cols-3">
                  {slice.products.map((p: any, idx: number) => {
                      const v = p.variants?.[0]
                      const variantId = String(v?.id ?? '')
                      const qty = variantId ? qtyByVariantId.get(variantId) ?? 0 : 0
                      const price = Number(v?.price ?? 0)
                      const hasOptions = Array.isArray(p?.optionGroups) && p.optionGroups.some((g: any) => Array.isArray(g?.values) && g.values.length > 0)
                      const storeOrderable = isStoreProductOrderable(p as StoreProduct)
                      const storeHint = storeOrderable ? null : storeMenuOrderHint(p as StoreProduct)
                      const seed = hashString(`${p.id}-${p.name}-${productIdxOffset + idx}`)
                      const slot = seed % 10
                      const sizeVariant =
                        slot === 0 || slot === 3 || slot === 6 || slot === 8 ? 'tall'
                        : slot === 1 || slot === 9 ? 'wide'
                        : slot === 2 || slot === 5 ? 'medium'
                        : 'small'
                      const cardSpanClass = sizeVariant === 'wide' ? 'col-span-2' : ''
                      const mediaHeightClass =
                        sizeVariant === 'tall' ? 'h-64 sm:h-72'
                        : sizeVariant === 'wide' ? 'h-44 sm:h-52'
                        : sizeVariant === 'medium' ? 'h-56 sm:h-60'
                        : 'h-48 sm:h-52'
                      const storeCat = storeCategories.find((sc: any) => String(sc.id) === String(p.categoryId))
                      const productIcon = (p as any).emoji || storeCat?.emoji || getCategoryEmoji(storeCat?.slug ?? '', false)
                      const isFocused = focusedStoreProductId === p.id
                      return (
                        <div
                          key={p.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setFocusedStoreProductId(p.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              setFocusedStoreProductId(p.id)
                            }
                          }}
                          className={cn(
                            'group relative block w-full overflow-hidden rounded-[16px] border border-[color:var(--stroke)] bg-[color:var(--surface)] text-left shadow-[var(--shadow-soft)] transition',
                            cardSpanClass,
                            focusedStoreProductId && !isFocused && 'pointer-events-none opacity-40 blur-[1px]',
                            !storeOrderable && 'opacity-[0.78]',
                          )}
                        >
                          <div className={cn('relative overflow-hidden bg-[color:var(--surface-strong)]', mediaHeightClass)}>
                            {p.image ? (
                              <OptimizedImage
                                src={p.image}
                                alt={p.name}
                                sizes={IMAGE_SIZES.menuGrid}
                                priority={productIdxOffset + idx < 6}
                                quality={76}
                                className="object-contain bg-[color:var(--surface)] p-1 transition duration-300 group-hover:scale-[1.01]"
                              />
                            ) : (
                              <div className="grid h-full place-items-center">
                                <div className="text-5xl">{productIcon}</div>
                              </div>
                            )}
                            <div
                              className={cn(
                                'absolute left-2 top-2 rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface-strong)]/95 px-2 py-0.5 text-[11px] font-semibold shadow-[var(--shadow-soft)] backdrop-blur-md',
                                storeOrderable ? 'text-[color:var(--text)]' : 'text-[color:var(--muted)]',
                              )}
                            >
                              {storeOrderable || price > 0 ? `${price} ฿` : '—'}
                            </div>
                            <button
                              type="button"
                              aria-label={storeFavorites.has(p.id) ? 'убрать из избранного' : 'добавить в избранное'}
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                handleToggleStoreFavorite(p.id)
                              }}
                              className={cn(
                                'absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface-strong)]/95 text-[color:var(--muted)] shadow-[var(--shadow-soft)] backdrop-blur-md transition active:scale-95',
                                storeFavorites.has(p.id) && 'border-rose-400/30 text-rose-400'
                              )}
                            >
                              <IconHeart className={cn('h-4 w-4', storeFavorites.has(p.id) && 'fill-current')} />
                            </button>
                          </div>
                          <div className="flex items-end justify-between gap-2 p-2.5">
                            <div className="min-w-0">
                              <div className="line-clamp-2 text-[14px] font-medium leading-tight text-[color:var(--text)]">{p.name}</div>
                              {storeHint ? (
                                <div className="mt-0.5 text-[10px] font-semibold leading-tight text-[color:var(--muted)]">{storeHint}</div>
                              ) : null}
                            </div>
                            {qty > 0 && !hasOptions ? (
                              <div className="flex shrink-0 items-center rounded-full bg-[color:var(--surface)] p-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (qty <= 1) removeItem(variantId, 'store')
                                    else updateQuantity(variantId, qty - 1, 'store')
                                    sendMenuActivity('REMOVE_FROM_CART', {
                                      kind: 'store',
                                      productId: p.id,
                                      storeVariantId: variantId,
                                      productName: p.name,
                                    })
                                  }}
                                  className="grid h-8 w-8 place-items-center rounded-full text-[17px] font-extrabold text-[color:var(--text)]"
                                >
                                  −
                                </button>
                                <span className="min-w-5 text-center text-[13px] font-extrabold tabular-nums text-[color:var(--text)]">{qty}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!storeOrderable) return
                                    updateQuantity(variantId, Math.min(qty + 1, v?.qty ?? 999), 'store')
                                  }}
                                  className="grid h-8 w-8 place-items-center rounded-full text-[17px] font-extrabold text-[color:var(--text)]"
                                >
                                  +
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled={!storeOrderable && !hasOptions}
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  if (hasOptions) {
                                    setFocusedStoreProductId(p.id)
                                    return
                                  }
                                  if (!storeOrderable) return
                                  addItem(
                                    {
                                      storeVariantId: variantId,
                                      productId: p.id,
                                      name: p.name,
                                      variantName: normalizeStoreVariantName(v?.name) || undefined,
                                      description: p.description ?? undefined,
                                      price,
                                      quantity: 1,
                                      imageUrl: p.image ?? undefined,
                                    },
                                    restaurantId
                                  )
                                  sendMenuActivity('ADD_TO_CART', {
                                    kind: 'store',
                                    productId: p.id,
                                    storeVariantId: variantId,
                                    productName: p.name,
                                    price,
                                    quantity: 1,
                                  })
                                }}
                                className={cn(
                                  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] text-[18px] font-extrabold leading-none text-[color:var(--text)] shadow-[var(--shadow-soft)] transition active:scale-95',
                                  !storeOrderable && !hasOptions && 'cursor-not-allowed opacity-35',
                                )}
                              >
                                {hasOptions ? '›' : '+'}
                              </button>
                            )}
                          </div>
                        </div>
                      )
                  })}
                </div>
              )
              const storeHeading =
                slice.heading ? (
                  <h3 className="mb-2.5 px-0.5 text-[13px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">
                    {slice.heading}
                  </h3>
                ) : null
              return slice.sectionId ? (
                <section key={sectionKey} id={`cat-store-${slice.sectionId}`} className="mb-6 scroll-mt-[6.25rem]">
                  {storeHeading}
                  {grid}
                </section>
              ) : (
                <div key={sectionKey} className="mb-2">
                  {storeHeading}
                  {grid}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </main>
  )
}

export default function MenuPage() {
  return (
    <Suspense fallback={<main className="ui-container ui-screen" />}>
      <MenuPageInner />
    </Suspense>
  )
}
