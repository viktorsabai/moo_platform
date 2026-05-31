'use client'

import { useEffect, useMemo, useState } from 'react'
import { useCartStore } from '@/store/cart-store'
import { useVenue } from '@/lib/venue-context'
import type { Dish } from '@/types'
import { formatPrice } from '@/lib/utils'
import { IconPlus } from '@/components/ui/icons'
import { cn } from '@/lib/utils'
import { IMAGE_SIZES, OptimizedImage } from '@/components/ui/OptimizedImage'
import { isDishOrderableForCart, isStoreVariantOrderableForCart } from '@/lib/consumer-menu-orderable'

interface CartRecommendationsProps {
  title?: string
  kinds?: Array<'dish' | 'store'>
}

type Category = { id: string; name: string }
type StoreVariant = { id: string; name?: string; price: number; qty?: number; isActive?: boolean }
type StoreProduct = {
  id: string
  name: string
  description?: string | null
  image?: string | null
  tags?: string[] | null
  variants?: StoreVariant[]
}
const ACCESSORY_KEYWORDS = ['напит', 'гарнир', 'соус', 'салат', 'десерт', 'рис', 'картоф']
const MAIN_KEYWORDS = ['бург', 'горяч', 'основ', 'паста', 'лапш', 'суп', 'гриль']

function normalizeStoreVariantName(value: unknown): string {
  const label = String(value ?? '').trim()
  const normalized = label.toLowerCase()
  if (!label || normalized === 'по умолчанию' || normalized === 'default') return ''
  return label
}

export function CartRecommendations({ title = 'ещё к заказу', kinds = ['dish', 'store'] }: CartRecommendationsProps) {
  const items = useCartStore((state) => state.items)
  const addItem = useCartStore((state) => state.addItem)
  const { restaurantId } = useVenue()
  const [menuDishes, setMenuDishes] = useState<Dish[]>([])
  const [storeProducts, setStoreProducts] = useState<StoreProduct[]>([])
  const [categories, setCategories] = useState<Category[]>([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [dRes, cRes] = await Promise.all([
          fetch('/api/dishes', { cache: 'no-store' }),
          fetch('/api/categories', { cache: 'no-store' }),
        ])
        const sRes = await fetch('/api/store/products', { cache: 'no-store' })
        const dData = await dRes.json().catch(() => [])
        const cData = await cRes.json().catch(() => [])
        const sData = await sRes.json().catch(() => null)
        if (cancelled) return
        setMenuDishes(Array.isArray(dData) ? dData : [])
        setCategories(Array.isArray(cData) ? cData : [])
        setStoreProducts(Array.isArray(sData?.products) ? sData.products : [])
      } catch {
        if (!cancelled) {
          setMenuDishes([])
          setStoreProducts([])
          setCategories([])
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const recommendations = useMemo(() => {
    if (!items.length) return []

    const inCartIds = new Set(items.map((i: any) => i.dishId).filter(Boolean))
    const inCartStoreVariantIds = new Set(items.map((i: any) => i.storeVariantId).filter(Boolean))
    const categoryMap = new Map(categories.map((cat) => [cat.id, String(cat.name || '').toLowerCase()]))
    const cartCategoryNames = items
      .map((it: any) => categoryMap.get(String(it?.dish?.categoryId ?? '')) ?? '')
      .filter(Boolean)
    const hasMainInCart = cartCategoryNames.some((name) => MAIN_KEYWORDS.some((k) => name.includes(k)))

    const scoredMenu = menuDishes
      .filter((dish) => Boolean(dish?.isAvailable) && !inCartIds.has(dish.id))
      .map((dish) => {
        const categoryName = categoryMap.get(String(dish.categoryId ?? '')) ?? ''
        const isAccessory = ACCESSORY_KEYWORDS.some((k) => categoryName.includes(k))
        const hasPopularTag = (dish.tags ?? []).some((tag) => tag === 'popular' || tag === 'hit')
        const isAffordable = Number(dish.price) <= 150
        let score = 0
        if (isAccessory) score += 50
        if (hasPopularTag) score += 18
        if (isAffordable) score += 14
        if (hasMainInCart && isAccessory) score += 20
        score -= Number(dish.price) / 50
        return { dish, score }
      })
      .sort((a, b) => b.score - a.score || Number(a.dish.price) - Number(b.dish.price))
      .slice(0, 6)
      .map((row) => row.dish)

    const storeCandidates = storeProducts
      .map((p) => {
        const variant = (p.variants || []).find((v) => Boolean(v?.isActive !== false) && Number(v?.qty ?? 0) > 0)
        if (!variant) return null
        if (!isStoreVariantOrderableForCart(p, variant)) return null
        if (inCartStoreVariantIds.has(String(variant.id))) return null
        return {
          kind: 'store' as const,
          id: String(p.id),
          name: String(p.name || 'товар'),
          description: p.description || undefined,
          image: p.image || undefined,
          variantId: String(variant.id),
          variantName: normalizeStoreVariantName(variant.name) || undefined,
          price: Number(variant.price ?? 0),
        }
      })
      .filter(Boolean) as Array<{
      kind: 'store'
      id: string
      name: string
      description?: string
      image?: string
      variantId: string
      variantName?: string
      price: number
    }>

    if (kinds.length === 1 && kinds[0] === 'dish') return scoredMenu.slice(0, 6).map((d) => ({
      kind: 'dish' as const,
      id: d.id,
      name: d.name,
      description: d.description,
      image: d.image,
      price: Number(d.price ?? 0),
    }))
    if (kinds.length === 1 && kinds[0] === 'store') return storeCandidates.slice(0, 6)

    // deterministic pseudo-random subset from store to keep UI fresh without flicker every render
    const shuffledStore = [...storeCandidates].sort((a, b) => a.id.localeCompare(b.id)).sort(() => 0.5 - Math.random())
    const storePick = shuffledStore.slice(0, 2)
    const menuPick = scoredMenu.slice(0, Math.max(0, 6 - storePick.length)).map((d) => ({
      kind: 'dish' as const,
      id: d.id,
      name: d.name,
      description: d.description,
      image: d.image,
      price: Number(d.price ?? 0),
    }))
    return [...menuPick, ...storePick]
  }, [categories, items, menuDishes, storeProducts, kinds])

  if (!recommendations.length) return null

  const handleAdd = (rec: any) => {
    if (rec.kind === 'store') {
      addItem(
        {
          storeVariantId: rec.variantId,
          productId: rec.id,
          name: rec.name,
          variantName: rec.variantName,
          description: rec.description,
          price: rec.price,
          quantity: 1,
          image: rec.image,
        },
        restaurantId
      )
      return
    }
    addItem(
      {
        dishId: rec.id,
        quantity: 1,
        name: rec.name,
        description: rec.description,
        price: rec.price,
        image: rec.image,
      },
      restaurantId
    )
  }

  return (
    <section
      className="mt-3 overflow-hidden border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] p-3 shadow-[var(--shadow-soft)]"
      style={{ borderRadius: 'var(--radius-large)' }}
    >
      <h2 className="px-0.5 text-[12px] font-extrabold tracking-tight text-[color:var(--muted)]">{title}</h2>
      <div
        className={cn(
          'mt-2.5 flex gap-2 overflow-x-auto pb-0.5 pl-0.5',
          'snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        )}
      >
        {recommendations.map((rec) => {
          const src = String(rec.image || '').trim()
          return (
            <article
              key={`${rec.kind}:${rec.id}${rec.kind === 'store' ? `:${rec.variantId}` : ''}`}
              className="flex w-[128px] shrink-0 snap-start flex-col border border-[color:var(--stroke)] bg-[color:var(--surface)]"
              style={{ borderRadius: 'var(--radius-medium)' }}
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-[color:var(--surface-strong)]">
                {src ? (
                  <OptimizedImage src={src} alt="" sizes={IMAGE_SIZES.cartUpsell} className="object-cover" quality={72} />
                ) : null}
                <button
                  type="button"
                  onClick={() => handleAdd(rec)}
                  className="absolute bottom-1.5 right-1.5 inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--stroke)] bg-[color:var(--bottom-bg)]/95 text-[color:var(--text)] shadow-sm backdrop-blur-sm transition active:scale-95"
                  aria-label={`добавить ${rec.name}`}
                >
                  <IconPlus className="h-4 w-4" />
                </button>
              </div>
              <div className="min-h-[3.5rem] p-2 pt-1.5">
                <p className="line-clamp-2 text-[12px] font-semibold leading-tight text-[color:var(--text)]">
                  {rec.name}
                  {rec.kind === 'store' && normalizeStoreVariantName(rec.variantName) ? (
                    <span className="ml-1 text-[10px] font-medium text-[color:var(--muted)]">{normalizeStoreVariantName(rec.variantName)}</span>
                  ) : null}
                </p>
                <p className="mt-0.5 tabular-nums text-[11px] font-medium text-[color:var(--muted)]">{formatPrice(rec.price)}</p>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
