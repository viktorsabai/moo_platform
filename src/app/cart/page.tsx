'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { formatPrice } from '@/lib/utils'
import { useCartStore } from '@/store/cart-store'
import { CartRecommendations } from '@/features/cart/components/CartRecommendations'
import { InlineCounter } from '@/components/ui/InlineCounter'
import { PageHeader } from '@/components/ui/PageHeader'
import { IMAGE_SIZES, OptimizedImage } from '@/components/ui/OptimizedImage'
import { GuestDeliveryPreview } from '@/components/delivery/GuestDeliveryPreview'
import { useGuestDelivery } from '@/hooks/useGuestDelivery'
import { useVenue } from '@/lib/venue-context'

export type CartItemModel = {
  id: string
  kind: 'dish' | 'store'
  refId: string
  name: string
  emoji?: string
  price: number
  quantity: number
  description?: string
  imageUrl?: string
  categoryId?: string
  variantName?: string
  modifierIds?: string[]
  modifierLabels?: string[]
}

/** Main-dish categories (burgers, mains). Additions = гарниры, напитки, салаты. */
const MAIN_CATEGORIES = new Set(['2', '5']) // бургеры, русская кухня
const ADDITION_CATEGORIES = new Set(['3', '4', '6']) // салаты, гарниры, напитки

function coerceNumber(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return 0
}

function normalizeStoreVariantName(value: unknown): string {
  const label = String(value ?? '').trim()
  const normalized = label.toLowerCase()
  if (!label || normalized === 'по умолчанию' || normalized === 'default') return ''
  return label
}

function toCartItemModel(raw: any, index: number): CartItemModel {
  const baseId = String(raw?.id ?? raw?.lineId ?? raw?.line_id ?? raw?.productId ?? raw?.sku ?? raw?.dishId ?? raw?.dish_id ?? index)

  const dishId = String(
    raw?.dishId ??
      raw?.dish_id ??
      raw?.dish?.id ??
      raw?.menuItemId ??
      raw?.menu_item_id ??
      raw?.menuItem?.id ??
      raw?.itemId ??
      raw?.item_id ??
      raw?.item?.id ??
      raw?.productId ??
      raw?.product_id ??
      raw?.product?.id ??
      baseId
  )

  const kind: 'dish' | 'store' = String(raw?.kind ?? '').toLowerCase() === 'store' || raw?.storeVariantId ? 'store' : 'dish'
  const refId = kind === 'store' ? String(raw?.storeVariantId ?? raw?.sku ?? baseId) : dishId

  // stable id (no randomUUID) to avoid react key collisions / remount glitches
  const id = `${kind}:${refId}::${baseId}::${index}`

  const name = String(raw?.name ?? raw?.title ?? raw?.product?.name ?? raw?.product?.title ?? 'товар')

  const price = coerceNumber(
    raw?.price ??
      raw?.dish?.price ??
      raw?.menuItem?.price ??
      raw?.item?.price ??
      raw?.product?.price ??
      raw?.variant?.price
  )

  const quantity = Math.max(1, coerceNumber(raw?.quantity ?? raw?.qty ?? 1))
  const description = (raw?.description ?? raw?.product?.description)
    ? String(raw?.description ?? raw?.product?.description)
    : undefined

  const imageUrlCandidate =
    raw?.imageUrl ??
    raw?.image_url ??
    raw?.image ??
    raw?.photoUrl ??
    raw?.dish?.imageUrl ??
    raw?.dish?.image_url ??
    raw?.dish?.image ??
    raw?.menuItem?.imageUrl ??
    raw?.menuItem?.image_url ??
    raw?.menuItem?.image ??
    raw?.item?.imageUrl ??
    raw?.item?.image_url ??
    raw?.item?.image ??
    raw?.product?.imageUrl ??
    raw?.product?.image_url ??
    raw?.product?.image

  const imageUrl = imageUrlCandidate ? String(imageUrlCandidate) : undefined

  const emoji = String(raw?.dish?.emoji ?? raw?.emoji ?? '').trim() || undefined
  const modifierLabels = Array.isArray(raw?.modifierLabels)
    ? raw.modifierLabels.map((v: unknown) => String(v || '').trim()).filter(Boolean)
    : []
  const modifierIds = Array.isArray(raw?.modifierIds)
    ? raw.modifierIds.map((v: unknown) => String(v || '').trim()).filter(Boolean)
    : []
  const variantName = kind === 'store' ? normalizeStoreVariantName(raw?.variantName) || undefined : undefined
  return { id, kind, refId, name, emoji, price, quantity, description, imageUrl, variantName, modifierIds, modifierLabels }
}

export default function CartPage() {
  const { restaurantId } = useVenue()
  const restaurantContextHeaders = useMemo((): HeadersInit => {
    const rid = String(restaurantId || '').trim()
    return rid && rid !== 'default' ? { 'x-ufo-restaurant': rid } : {}
  }, [restaurantId])

  const getHydratedItems = useCartStore((s) => s.getHydratedItems)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const removeItem = useCartStore((s) => s.removeItem)
  const clearCart = useCartStore((s) => s.clearCart)
  const getTotal = useCartStore((s) => s.getTotal)

  const [modifierLabelById, setModifierLabelById] = useState<Record<string, string>>({})

  // keep page resilient to any older persisted shapes
  const rawItems = (useCartStore((state: any) => state.items ?? state.cartItems ?? state.cart ?? state.lines ?? state.positions ?? []) as any[]) ?? []
  const items: CartItemModel[] = Array.isArray(rawItems)
    ? rawItems.map((raw, idx) => toCartItemModel(raw, idx)).filter((it) => (it.quantity ?? 0) > 0)
    : []

  // prefer hydrated store meta for UI, but fall back to the coerced list
  const hydrated = (() => {
    try {
      const v = getHydratedItems?.()
      return Array.isArray(v) ? v : []
    } catch {
      return []
    }
  })()

  const list = hydrated.length
    ? hydrated.map((it: any, idx: number) => ({
        id: String(it?.id ?? it?.dishId ?? it?.storeVariantId ?? idx),
        kind: (String(it?.kind || (it?.storeVariantId ? 'store' : 'dish')) === 'store' ? 'store' : 'dish') as 'dish' | 'store',
        refId: String(it?.id ?? (it?.kind === 'store' ? it?.storeVariantId : it?.dishId) ?? it?.storeVariantId ?? it?.dishId ?? ''),
        name: String(it?.name ?? 'товар'),
        price: coerceNumber(it?.price ?? it?.dish?.price),
        quantity: Math.max(1, coerceNumber(it?.quantity ?? 1)),
        description: typeof it?.description === 'string' ? it.description : undefined,
        imageUrl: typeof it?.imageUrl === 'string' ? it.imageUrl : undefined,
        emoji: typeof it?.dish?.emoji === 'string' ? it.dish.emoji : undefined,
        categoryId: typeof it?.dish?.categoryId === 'string' ? it.dish.categoryId : undefined,
        variantName: (String(it?.kind || (it?.storeVariantId ? 'store' : 'dish')) === 'store')
          ? (normalizeStoreVariantName(it?.variantName) || undefined)
          : undefined,
        modifierIds: Array.isArray(it?.modifierIds)
          ? it.modifierIds.map((v: unknown) => String(v || '').trim()).filter(Boolean)
          : [],
        modifierLabels: Array.isArray(it?.modifierLabels)
          ? it.modifierLabels.map((v: unknown) => String(v || '').trim()).filter(Boolean)
          : [],
      }))
    : items

  useEffect(() => {
    const needsFallback = list.some(
      (it) => (it.modifierLabels?.length ?? 0) === 0 && (it.modifierIds?.length ?? 0) > 0
    )
    if (!needsFallback) return
    let cancelled = false
    async function loadModifierLabels() {
      try {
        const res = await fetch('/api/dishes', { cache: 'no-store' })
        const data = await res.json().catch(() => [])
        if (!Array.isArray(data) || cancelled) return
        const map: Record<string, string> = {}
        for (const dish of data as any[]) {
          for (const m of Array.isArray(dish?.modifiers) ? dish.modifiers : []) {
            const id = String(m?.id || '').trim()
            const name = String(m?.name || '').trim()
            if (id && name) map[id] = name
          }
          for (const g of Array.isArray(dish?.optionGroups) ? dish.optionGroups : []) {
            for (const v of Array.isArray(g?.values) ? g.values : []) {
              const id = String(v?.id || '').trim()
              const name = String(v?.name || '').trim()
              if (id && name) map[id] = name
            }
          }
        }
        if (!cancelled) setModifierLabelById(map)
      } catch {
        // ignore fallback errors
      }
    }
    void loadModifierLabels()
    return () => {
      cancelled = true
    }
  }, [list])

  function lineModifierLabels(it: CartItemModel): string[] {
    if (Array.isArray(it.modifierLabels) && it.modifierLabels.length) return it.modifierLabels
    if (!Array.isArray(it.modifierIds) || !it.modifierIds.length) return []
    return it.modifierIds.map((id) => modifierLabelById[String(id)]).filter(Boolean)
  }

  const dishList = list.filter((it) => it.kind === 'dish')
  const storeList = list.filter((it) => it.kind === 'store')
  const mainItems = dishList.filter((it) => it.categoryId && MAIN_CATEGORIES.has(it.categoryId))
  const additionItems = dishList.filter((it) => it.categoryId && ADDITION_CATEGORIES.has(it.categoryId))
  const otherItems = dishList.filter((it) => !it.categoryId || (!MAIN_CATEGORIES.has(it.categoryId) && !ADDITION_CATEGORIES.has(it.categoryId)))
  const mainList =
    mainItems.length > 0 ? mainItems : (otherItems.length > 0 ? otherItems.slice(0, Math.max(1, Math.ceil(otherItems.length / 2))) : [])
  const additionList =
    additionItems.length > 0
      ? [...additionItems, ...otherItems]
      : (otherItems.length > 0 ? otherItems.slice(mainList.length) : [])

  const subtotal = Math.max(0, coerceNumber(getTotal?.()))
  const totalQty = list.reduce((sum, it) => sum + (it.quantity || 0), 0)
  const guestDelivery = useGuestDelivery({
    subtotal,
    restaurantHeaders: restaurantContextHeaders,
    fetchQuote: true,
  })

  const cardClass = 'ui-surface-card'
  const cardRadius = { borderRadius: 'var(--radius-large)' } as const

  function renderCartRow(it: CartItemModel, compact: boolean) {
    const qty = Math.max(1, coerceNumber(it.quantity))
    const unit = Math.max(0, coerceNumber(it.price))
    const lineTotal = unit * qty
    const img = String(it.imageUrl || '').trim()
    const thumbClass = compact ? 'h-10 w-10 rounded-xl' : 'h-12 w-12 rounded-2xl'
    return (
      <div
        key={`${it.kind}:${it.refId}` || it.id}
        className={`flex items-center justify-between gap-3 ${compact ? 'py-2.5' : 'py-3'} border-b border-[color:var(--stroke)] last:border-b-0`}
      >
        <div className="flex min-w-0 items-center gap-3 flex-1">
          <div
            className={`relative shrink-0 overflow-hidden ${thumbClass} bg-[color:var(--surface-strong)]`}
            style={{ borderRadius: 'var(--radius-medium)' }}
          >
            {img ? (
              <OptimizedImage src={img} alt="" sizes={IMAGE_SIZES.cartRow} className="object-cover" quality={72} />
            ) : (
              <div aria-hidden className="h-full w-full bg-[color:var(--surface-strong)]" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className={compact ? 'ui-body text-[14px] font-semibold truncate' : 'ui-body text-[15px] font-semibold truncate'}>
              {it.name || 'товар'}
              {it.kind === 'store' && normalizeStoreVariantName((it as any)?.variantName)
                ? ` · ${normalizeStoreVariantName((it as any)?.variantName)}`
                : ''}
            </div>
            {!compact && it.description ? <div className="ui-muted mt-0.5 line-clamp-1 text-[12px]">{it.description}</div> : null}
            {lineModifierLabels(it).length > 0 ? (
              <div className="ui-muted mt-0.5 line-clamp-1 text-[11px]">
                {lineModifierLabels(it).join(' · ')}
              </div>
            ) : null}
            <div className="ui-muted mt-0.5 text-[12px]">
              <span className="tabular-nums">{formatPrice(unit)}</span>
              {qty > 1 ? <><span aria-hidden className="opacity-50"> · </span><span className="tabular-nums">{formatPrice(lineTotal)}</span></> : null}
            </div>
          </div>
        </div>
        <div className="shrink-0">
          <InlineCounter
            value={qty}
            max={it.kind === 'dish' ? 20 : undefined}
            onDec={() => (qty <= 1 ? removeItem(it.refId, it.kind) : updateQuantity(it.refId, qty - 1, it.kind))}
            onInc={() => updateQuantity(it.refId, Math.min(qty + 1, it.kind === 'dish' ? 20 : 999), it.kind)}
          />
        </div>
      </div>
    )
  }

  return (
    <main className="ui-container ui-screen pb-[var(--ufo-scroll-pad-floating,calc(5.75rem+12px))]">
      <PageHeader
        title="корзина"
        subtitle={`${totalQty} ${totalQty === 1 ? 'позиция' : 'позиции'} · ${formatPrice(subtotal)}`}
        action={
          list.length ? (
            <button
              type="button"
              onClick={() => clearCart()}
              className="btn btn-soft inline-flex h-10 items-center justify-center rounded-full px-4 text-[13px] font-semibold transition active:opacity-80"
              style={{ borderRadius: 'var(--radius-pill)' }}
            >
              очистить
            </button>
          ) : null
        }
      />

      {list.length === 0 ? (
        <div className={cardClass} style={cardRadius}>
          <div className="p-6 text-center">
            <div className="text-[16px] font-semibold text-[color:var(--text)]">корзина пуста</div>
            <div className="mt-1 text-[13px] font-medium text-[color:var(--muted)]">добавь блюда из меню — и они появятся здесь</div>
            <Link
              href="/menu"
              prefetch={false}
              className="btn btn-primary mt-4 inline-flex h-11 w-full items-center justify-center rounded-full px-6 text-[14px] font-semibold transition active:scale-[0.98]"
              style={{ borderRadius: 'var(--radius-pill)' }}
            >
              в меню
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className={cardClass} style={cardRadius}>
            {storeList.length > 0 && (
              <div className="border-t border-[color:var(--stroke)] pt-4">
                <div className="mb-2 text-[12px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">магазин</div>
                {storeList.map((it) => renderCartRow(it, false))}
              </div>
            )}

            {mainList.length > 0 && (
              <div className="border-t border-[color:var(--stroke)] pt-4">
                <div className="mb-2 text-[12px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">ресторан</div>
                {mainList.map((it) => renderCartRow(it, false))}
              </div>
            )}

            {/* Additions — secondary, compact */}
            {additionList.length > 0 && (
              <div className={mainList.length > 0 ? 'border-t border-[color:var(--stroke)] pt-3 mt-3' : ''}>
                {additionList.map((it) => renderCartRow(it, true))}
              </div>
            )}

          </div>

          <CartRecommendations title="ещё к заказу" kinds={['dish']} />
          <CartRecommendations title="из магазина" kinds={['store']} />

          <div className={`${cardClass} mb-3`} style={cardRadius}>
            <GuestDeliveryPreview delivery={guestDelivery} subtotal={subtotal} />
          </div>

          {/* Above bottom nav (z-100): same bottom offset as StickyCartBar (+10px) so taps hit CTA, not tabs */}
          <div
            className="pointer-events-none fixed bottom-[calc(var(--ufo-bottomnav-h,72px)+env(safe-area-inset-bottom)+10px)] left-1/2 z-[115] w-[min(520px,92%)] max-w-full -translate-x-1/2"
            aria-label="итог заказа"
          >
            <div className="pointer-events-auto ui-sticky-sheet overflow-hidden">
              <div className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <div className="ui-muted text-[12px]">
                    {guestDelivery.deliveryAvailable && guestDelivery.estimatedDeliveryFee > 0
                      ? 'с доставкой'
                      : 'итого'}
                  </div>
                  <div className="ui-h1 mt-0.5 tabular-nums text-[18px]">
                    {formatPrice(
                      guestDelivery.deliveryAvailable && !guestDelivery.outOfZone
                        ? guestDelivery.estimatedTotal
                        : subtotal
                    )}
                  </div>
                  {guestDelivery.deliveryAvailable && guestDelivery.estimatedDeliveryFee > 0 ? (
                    <div className="ui-muted mt-0.5 text-[10px]">
                      товары {formatPrice(subtotal)} + доставка {formatPrice(guestDelivery.estimatedDeliveryFee)}
                    </div>
                  ) : null}
                </div>
                <Link
                  href="/checkout"
                  prefetch={true}
                  className="btn btn-primary inline-flex shrink-0 items-center justify-center rounded-full px-6 py-3 text-[14px] font-semibold no-underline transition active:scale-[0.98]"
                  style={{ borderRadius: 'var(--radius-pill)' }}
                >
                  оформить
                </Link>
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  )
}
