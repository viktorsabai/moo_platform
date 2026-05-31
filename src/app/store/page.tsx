'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { InlineCounter } from '@/components/ui/InlineCounter'
import { useCartStore } from '@/store/cart-store'
import { useVenue } from '@/lib/venue-context'
import { formatPrice } from '@/lib/utils'
import { EmptyStatePlaceholder } from '@/components/ui/EmptyStatePlaceholder'
import { FilterBar } from '@/components/ui/FilterBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { Chip } from '@/components/ui/Chip'
import { cn } from '@/lib/utils'
import { IMAGE_SIZES, OptimizedImage } from '@/components/ui/OptimizedImage'

type StoreCategory = { id: string; name: string; slug: string; description?: string; order?: number }
type StoreVariant = { id: string; name: string; sku?: string | null; price: number; qty: number }
type StoreOptionGroup = { id: string; name: string; values: Array<{ id: string; name: string }> }
type StoreProduct = {
  id: string
  name: string
  slug: string
  description?: string | null
  image?: string | null
  categoryId: string
  variants: StoreVariant[]
  optionGroups?: StoreOptionGroup[]
}

export default function StorePage() {
  const { settings, restaurantId } = useVenue()
  const storeEnabled = settings.storeEnabled
  const [categories, setCategories] = useState<StoreCategory[]>([])
  const [products, setProducts] = useState<StoreProduct[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [focusedProductId, setFocusedProductId] = useState<string | null>(null)
  const [selectedOptionByProduct, setSelectedOptionByProduct] = useState<Record<string, Record<string, string>>>({})
  const [focusedDraftQty, setFocusedDraftQty] = useState(1)
  const [focusedAddedPulse, setFocusedAddedPulse] = useState(false)
  const categoryChipRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const swipeStartXRef = useRef<number | null>(null)

  const addItem = useCartStore((s) => s.addItem)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const removeItem = useCartStore((s) => s.removeItem)
  const cartItems = useCartStore((s) => s.items)

  useEffect(() => {
    let cancelled = false
    async function load() {
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
        if (cRes.ok && cData?.ok && Array.isArray(cData.categories)) setCategories(cData.categories)
        if (pRes.ok && pData?.ok && Array.isArray(pData.products)) setProducts(pData.products)
      } catch {
        // ignore
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    // pick first category when loaded
    if (!selectedCategoryId && categories.length) setSelectedCategoryId(categories[0].id)
  }, [categories, selectedCategoryId])

  useEffect(() => {
    if (!focusedProductId) return
    const prevHtmlOverflow = document.documentElement.style.overflow
    const prevBodyOverflow = document.body.style.overflow
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow
      document.body.style.overflow = prevBodyOverflow
    }
  }, [focusedProductId])

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

  function getSelectedValueIds(product: StoreProduct): string[] {
    const selected = selectedOptionByProduct[product.id] || {}
    return (product.optionGroups || [])
      .map((group) => String(selected[group.id] || '').trim())
      .filter(Boolean)
  }

  function getSelectedValueLabels(product: StoreProduct): string[] {
    const selected = selectedOptionByProduct[product.id] || {}
    return (product.optionGroups || [])
      .map((group) => {
        const selectedId = String(selected[group.id] || '').trim()
        if (!selectedId) return ''
        const value = group.values.find((v) => v.id === selectedId)
        return value ? value.name : ''
      })
      .filter(Boolean)
  }

  function storeLineId(variantId: string, modifierIds: string[]): string {
    const key = modifierIds.length ? `_${[...modifierIds].sort().join(',')}` : ''
    return `${variantId}${key}`
  }

  function ensureDefaultOptionSelection(product: StoreProduct) {
    if (!(product.optionGroups || []).length) return
    setSelectedOptionByProduct((prev) => {
      const current = prev[product.id] || {}
      const next = { ...current }
      for (const group of product.optionGroups || []) {
        if (next[group.id]) continue
        const first = group.values?.[0]?.id
        if (first) next[group.id] = first
      }
      return { ...prev, [product.id]: next }
    })
  }

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return products.filter((p) => {
      const matchesCategory = !selectedCategoryId || p.categoryId === selectedCategoryId
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        String(p.description ?? '').toLowerCase().includes(q) ||
        p.variants.some((v) => v.name.toLowerCase().includes(q))
      return matchesCategory && matchesSearch
    })
  }, [products, searchQuery, selectedCategoryId])

  const focusProductByOffset = useCallback((delta: number) => {
    const list = filtered
    if (!list.length || !focusedProductId) return
    const idx = list.findIndex((p) => p.id === focusedProductId)
    if (idx < 0) return
    const nextIdx = Math.max(0, Math.min(list.length - 1, idx + delta))
    const next = list[nextIdx]
    if (next?.id && next.id !== focusedProductId) setFocusedProductId(next.id)
  }, [filtered, focusedProductId])

  const focusedProduct = useMemo(
    () => filtered.find((p) => p.id === focusedProductId) ?? null,
    [filtered, focusedProductId]
  )
  const focusedVariant = focusedProduct?.variants?.[0] ?? null
  const focusedSelectedIds = focusedProduct ? getSelectedValueIds(focusedProduct) : []
  const focusedSelectedLabels = focusedProduct ? getSelectedValueLabels(focusedProduct) : []
  const focusedLineId = focusedVariant ? storeLineId(String(focusedVariant.id), focusedSelectedIds) : ''
  const focusedQty = focusedLineId ? qtyByStoreLineId.get(focusedLineId) ?? 0 : 0
  const focusedCheckoutQty = focusedQty > 0 ? focusedQty : focusedDraftQty
  const focusedUnitPrice = Number(focusedVariant?.price ?? 0)
  const focusedTotalPrice = focusedUnitPrice * Math.max(1, focusedCheckoutQty)

  function hashString(input: string): number {
    let h = 0
    for (let i = 0; i < input.length; i += 1) h = (h * 31 + input.charCodeAt(i)) >>> 0
    return h
  }

  function getCategoryEmoji(slug: string): string {
    const map: Record<string, string> = {
      frozen: '🥟',
      drinks: '🥤',
      sauces: '🫙',
      snacks: '🛍️',
    }
    return map[String(slug || '').toLowerCase()] || '🛍️'
  }

  if (!storeEnabled) {
    return (
      <main className="ui-container ui-screen">
        <EmptyStatePlaceholder variant="store" message="Магазин временно недоступен. Настройте в ЛК." />
      </main>
    )
  }

  return (
    <main className="ui-container ui-screen menu-page flex min-h-dvh flex-col">
      <FilterBar
        className="sticky top-0 z-30 mb-2 bg-[color:var(--surface)]/95 backdrop-blur supports-[backdrop-filter]:bg-[color:var(--surface)]/85"
        topLeft={<div className="text-[16px] font-extrabold tracking-tight text-[color:var(--text)]">магазин</div>}
        search={<SearchInput value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="поиск" />}
        chips={
          <>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                ref={(el: HTMLButtonElement | null) => {
                  const key = String(c.id)
                  if (!el) categoryChipRefs.current.delete(key)
                  else categoryChipRefs.current.set(key, el)
                }}
                onClick={() => setSelectedCategoryId(c.id)}
                className="transition active:scale-[0.98]"
              >
                <Chip accent={selectedCategoryId === c.id}>{c.name}</Chip>
              </button>
            ))}
          </>
        }
      />
      {filtered.length === 0 ? (
        <EmptyStatePlaceholder variant="store" />
      ) : (
        <div className="relative z-20 mt-4">
          <div className="grid grid-cols-2 gap-2 [grid-auto-flow:dense] sm:grid-cols-3">
            {filtered.map((p, idx) => {
              const v = p.variants?.[0]
              const variantId = String(v?.id ?? '')
              const hasOptions = (p.optionGroups || []).some((g) => (g.values || []).length > 0)
              const selectedIds = hasOptions ? getSelectedValueIds(p) : []
              const lineId = variantId ? storeLineId(variantId, selectedIds) : ''
              const qty = lineId ? qtyByStoreLineId.get(lineId) ?? 0 : 0
              const seed = hashString(`${p.id}-${p.name}-${idx}`)
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
              const storeCat = categories.find((x) => String(x.id) === String(p.categoryId))
              const icon = getCategoryEmoji(String(storeCat?.slug || ''))
              return (
                <div
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    ensureDefaultOptionSelection(p)
                    setFocusedProductId(p.id)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      ensureDefaultOptionSelection(p)
                      setFocusedProductId(p.id)
                    }
                  }}
                  className={cn(
                    'group relative block w-full overflow-hidden rounded-[16px] border border-[color:var(--stroke)] bg-[color:var(--surface)] text-left shadow-[var(--shadow-soft)] transition',
                    cardSpanClass,
                    focusedProductId === p.id && 'pointer-events-none opacity-0',
                    focusedProductId && focusedProductId !== p.id && 'pointer-events-none opacity-40 blur-[1px]'
                  )}
                >
                  <div className={cn('relative overflow-hidden bg-[color:var(--surface-strong)]', mediaHeightClass)}>
                    {p.image ? (
                      <OptimizedImage
                        src={p.image}
                        alt={p.name}
                        sizes={IMAGE_SIZES.menuGrid}
                        priority={idx < 8}
                        quality={76}
                        className="object-contain bg-[color:var(--surface)] p-1 transition duration-300 group-hover:scale-[1.01]"
                      />
                    ) : (
                      <div className="grid h-full place-items-center text-5xl">{icon}</div>
                    )}
                    {qty > 0 && (
                      <div className="absolute right-2 top-2 rounded-full bg-[color:var(--accent)] px-2 py-0.5 text-[11px] font-semibold text-white">
                        {qty}
                      </div>
                    )}
                  </div>
                  <div className="flex items-end justify-between gap-2 p-2.5">
                    <div className="min-w-0">
                      <div className="line-clamp-2 text-[14px] font-medium leading-tight text-[color:var(--text)]">{p.name}</div>
                      <div className="mt-0.5 text-[15px] font-bold tabular-nums text-[color:var(--text)]">
                        {hasOptions ? `от ${Number(v?.price ?? 0)} ฿` : `${Number(v?.price ?? 0)} ฿`}
                      </div>
                    </div>
                    {!hasOptions && v && qty > 0 ? (
                      <div
                        className="flex shrink-0 items-center rounded-full bg-[color:var(--surface)] p-1"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => (qty <= 1 ? removeItem(lineId, 'store') : updateQuantity(lineId, qty - 1, 'store'))}
                          className="grid h-8 w-8 place-items-center rounded-full text-[17px] font-extrabold text-[color:var(--text)]"
                        >
                          −
                        </button>
                        <span className="min-w-5 text-center text-[13px] font-extrabold tabular-nums text-[color:var(--text)]">{qty}</span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(lineId, Math.min(qty + 1, Number(v.qty || 999)), 'store')}
                          className="grid h-8 w-8 place-items-center rounded-full text-[17px] font-extrabold text-[color:var(--text)]"
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          ensureDefaultOptionSelection(p)
                          setFocusedProductId(p.id)
                        }}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] text-[18px] font-extrabold leading-none text-[color:var(--text)]"
                      >
                        {hasOptions ? '›' : '+'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      {focusedProductId ? (
        <>
          <button
            type="button"
            aria-label="закрыть превью товара"
            onClick={() => setFocusedProductId(null)}
            className="fixed inset-0 z-[210] bg-[color:var(--bg)]/90 backdrop-blur-2xl [-webkit-backdrop-filter:blur(22px)] saturate-150 [html.dark_&]:bg-slate-950/30 [html.dark_&]:backdrop-blur-[40px] [html.dark_&]:[-webkit-backdrop-filter:blur(40px)_saturate(1.45)]"
          />
          <div className="fixed inset-0 z-[220] isolate animate-[fadeIn_.18s_ease-out]">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0 bg-[color:var(--bg)]/40 backdrop-blur-xl [-webkit-backdrop-filter:blur(18px)] [html.dark_&]:bg-slate-950/15 [html.dark_&]:backdrop-blur-2xl [html.dark_&]:[-webkit-backdrop-filter:blur(22px)_saturate(1.3)]"
          />
          {focusedProduct && focusedVariant ? (
            <div
              className="absolute inset-0 z-10 flex items-center justify-center px-3 pb-[calc(var(--ufo-bottomnav-h)+250px)] pt-12 sm:px-6"
              onTouchStart={(e) => {
                swipeStartXRef.current = e.touches[0]?.clientX ?? null
              }}
              onTouchEnd={(e) => {
                const start = swipeStartXRef.current
                const end = e.changedTouches[0]?.clientX ?? null
                swipeStartXRef.current = null
                if (start == null || end == null) return
                const dx = end - start
                if (Math.abs(dx) < 42) return
                if (dx < 0) focusProductByOffset(1)
                else focusProductByOffset(-1)
              }}
            >
              <div className="relative h-full w-full max-w-[760px]">
                <div className="absolute left-3 right-16 top-1 z-10">
                  <h2 className="max-w-[88%] text-[27px] font-extrabold leading-[0.96] tracking-[-0.04em] text-[color:var(--text)] sm:text-[38px]">
                    {focusedProduct.name}
                  </h2>
                  {focusedProduct.description ? (
                    <p className="mt-2 line-clamp-2 max-w-[82%] text-[13px] font-semibold leading-snug text-[color:var(--muted)]">
                      {focusedProduct.description}
                    </p>
                  ) : null}
                </div>
                <div className="relative h-full w-full">
                  {focusedProduct.image ? (
                    <OptimizedImage
                      src={focusedProduct.image}
                      alt={focusedProduct.name}
                      sizes={IMAGE_SIZES.menuFullscreen}
                      quality={86}
                      className="animate-[fadeIn_.24s_ease-out] object-contain px-1 pb-1 pt-24"
                    />
                  ) : (
                    <div className="grid h-full place-items-center pt-24 text-8xl">
                      {getCategoryEmoji(String(categories.find((c) => c.id === focusedProduct.categoryId)?.slug || ''))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setFocusedProductId(null)}
                  className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center text-[22px] leading-none text-[color:var(--muted)]"
                  aria-label="закрыть"
                >
                  ×
                </button>
              </div>
            </div>
          ) : null}
          {focusedProduct && focusedVariant ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-[calc(var(--ufo-bottomnav-h)+8px)] z-30">
              <div className="pointer-events-auto mx-auto w-full max-w-[760px] px-3">
                {(focusedProduct.optionGroups || []).length > 0 ? (
                  <div className="mb-2 space-y-2.5 px-1">
                    {(focusedProduct.optionGroups || []).map((group) => (
                      <div key={`focused-store-group-${group.id}`}>
                        <div className="mb-1.5 px-1 text-[11px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">{group.name}</div>
                        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                          {group.values.map((value) => {
                            const checked = selectedOptionByProduct[focusedProduct.id]?.[group.id] === value.id
                            return (
                              <button
                                key={value.id}
                                type="button"
                                onClick={() =>
                                  setSelectedOptionByProduct((prev) => ({
                                    ...prev,
                                    [focusedProduct.id]: { ...(prev[focusedProduct.id] || {}), [group.id]: value.id },
                                  }))
                                }
                                className={cn(
                                  'shrink-0 rounded-full border px-4 py-2.5 text-[14px] font-extrabold transition',
                                  checked
                                    ? 'border-[color:var(--accent)] bg-[color:var(--accent)] text-white'
                                    : 'border-[color:var(--stroke)] bg-[color:var(--surface-strong)] text-[color:var(--text)]'
                                )}
                              >
                                {value.name}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className={cn('ufo-drift-in text-[color:var(--text)] transition-transform duration-200', focusedAddedPulse && 'scale-[1.015]')}>
                  <div className="rounded-[28px] border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] p-3 text-[color:var(--text)] shadow-[0_16px_38px_rgba(0,0,0,0.16)] backdrop-blur-xl [html.dark_&]:border-white/[0.1] [html.dark_&]:bg-white/[0.08] [html.dark_&]:shadow-[0_16px_48px_rgba(0,0,0,0.4)] [html.dark_&]:backdrop-blur-2xl">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="pl-1 text-[31px] font-extrabold leading-none tabular-nums text-[color:var(--text)]">
                          {focusedTotalPrice} ฿
                        </div>
                        <div className="pl-1 text-[11px] font-semibold text-[color:var(--muted)]">
                          {focusedCheckoutQty > 1 ? `${focusedUnitPrice} ฿ × ${focusedCheckoutQty}` : 'за позицию'}
                          {focusedSelectedLabels.length ? ` · ${focusedSelectedLabels.join(' · ')}` : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {focusedQty > 0 ? (
                          <InlineCounter
                            value={focusedQty}
                            onInc={() => updateQuantity(focusedLineId, Math.min(focusedQty + 1, Number(focusedVariant.qty || 999)), 'store')}
                            onDec={() => {
                              if (focusedQty <= 1) removeItem(focusedLineId, 'store')
                              else updateQuantity(focusedLineId, focusedQty - 1, 'store')
                            }}
                            max={Number(focusedVariant.qty || 999)}
                          />
                        ) : (
                          <>
                            <div className="flex items-center rounded-full bg-[color:var(--surface)] p-1">
                              <button
                                type="button"
                                onClick={() => setFocusedDraftQty((q) => Math.max(1, q - 1))}
                                className="grid h-8 w-8 place-items-center rounded-full text-[18px] font-bold text-[color:var(--text)]"
                              >
                                −
                              </button>
                              <span className="min-w-6 text-center text-[15px] font-extrabold tabular-nums">{focusedDraftQty}</span>
                              <button
                                type="button"
                                onClick={() => setFocusedDraftQty((q) => Math.min(Number(focusedVariant.qty || 999), q + 1))}
                                className="grid h-8 w-8 place-items-center rounded-full text-[18px] font-bold text-[color:var(--text)]"
                              >
                                +
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                addItem(
                                  {
                                    storeVariantId: String(focusedVariant.id),
                                    productId: focusedProduct.id,
                                    name: focusedProduct.name,
                                    variantName: focusedVariant.name,
                                    price: focusedUnitPrice,
                                    quantity: focusedDraftQty,
                                    imageUrl: focusedProduct.image ?? undefined,
                                    description: focusedProduct.description ?? undefined,
                                    modifierIds: focusedSelectedIds,
                                    modifierLabels: focusedSelectedLabels,
                                  },
                                  restaurantId
                                )
                                setFocusedAddedPulse(true)
                                setTimeout(() => setFocusedAddedPulse(false), 700)
                              }}
                              className={cn(
                                'rounded-full bg-[color:var(--accent)] px-4 py-2.5 text-[13px] font-semibold text-white transition active:scale-95',
                                focusedAddedPulse && 'bg-emerald-600'
                              )}
                            >
                              {focusedAddedPulse ? 'добавлено' : 'в корзину'}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          </div>
        </>
      ) : null}
    </main>
  )
}

