 'use client'

 import Link from 'next/link'
 import { usePathname } from 'next/navigation'
 import { useEffect, useMemo, useState } from 'react'
 import { useShallow } from 'zustand/react/shallow'
 import { formatPrice } from '@/lib/utils'
 import { useCartStore } from '@/store/cart-store'
 import { cn } from '@/lib/utils'
import { IconCart, IconChevronUp } from '@/components/ui/icons'

function normalizeStoreVariantName(value: unknown): string {
  const label = String(value ?? '').trim()
  const normalized = label.toLowerCase()
  if (!label || normalized === 'по умолчанию' || normalized === 'default') return ''
  return label
}

 export function StickyCartBar() {
   const pathname = usePathname() || ''
   const count = useCartStore((s) => s.getItemCount())
   const total = useCartStore((s) => s.getTotal())
  const getHydratedItems = useCartStore((s) => s.getHydratedItems)
  const cartRevision = useCartStore(
    useShallow((s) => ({
      items: s.items,
      dishMetaById: s.dishMetaById,
      storeVariantMetaById: s.storeVariantMetaById,
    }))
  )
  const items = useMemo(() => getHydratedItems(), [getHydratedItems, cartRevision])
   const [mounted, setMounted] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [modifierLabelById, setModifierLabelById] = useState<Record<string, string>>({})

   useEffect(() => setMounted(true), [])

  const isOwnerContext =
    pathname.startsWith('/admin') || pathname === '/profile/owner'
  const shouldHide =
    pathname === '/cart' ||
    pathname === '/checkout' ||
    pathname === '/subscriptions/new' ||
    pathname.startsWith('/requests') ||
    isOwnerContext

  const visible = !shouldHide && mounted && count > 0
  const countLabel = useMemo(() => {
     const n = Math.max(0, Number.isFinite(count) ? count : 0)
     const word = n === 1 ? 'товар' : n >= 2 && n <= 4 ? 'товара' : 'товаров'
    return `${n} ${word}`
  }, [count])

  useEffect(() => {
    const list = Array.isArray(items) ? items : []
    const needsFallback = list.some(
      (it: any) =>
        (!Array.isArray(it?.modifierLabels) || it.modifierLabels.length === 0) &&
        Array.isArray(it?.modifierIds) &&
        it.modifierIds.length > 0
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
  }, [items])

  const previewLines = useMemo(() => {
    const list = Array.isArray(items) ? items : []
    return list.map((it: any) => {
      const name = String(it?.name ?? it?.productName ?? 'позиция')
      const variant = it?.kind === 'store' && normalizeStoreVariantName(it?.variantName) ? ` · ${normalizeStoreVariantName(it?.variantName)}` : ''
      const directLabels = Array.isArray(it?.modifierLabels)
        ? it.modifierLabels.map((v: unknown) => String(v || '').trim()).filter(Boolean)
        : []
      const fallbackLabels = directLabels.length
        ? directLabels
        : (Array.isArray(it?.modifierIds)
            ? it.modifierIds
                .map((id: unknown) => modifierLabelById[String(id || '').trim()])
                .filter(Boolean)
            : [])
      const qty = Math.max(0, Number(it?.quantity ?? 0))
      const price = Math.max(0, Number(it?.price ?? 0))
      const lineTotal = price * qty
      return {
        key: String(it?.id ?? name),
        kind: String(it?.kind || (it?.storeVariantId ? 'store' : 'dish')),
        text: `${name}${variant}`,
        optionText: fallbackLabels.join(' · '),
        qty,
        lineTotal,
      }
    })
  }, [items, modifierLabelById])
  const previewLinesStore = useMemo(() => previewLines.filter((line) => String((line as any)?.kind ?? '') === 'store'), [previewLines])
  const previewLinesDish = useMemo(() => previewLines.filter((line) => String((line as any)?.kind ?? '') !== 'store'), [previewLines])

  useEffect(() => {
    if (!visible) setExpanded(false)
  }, [visible])

  // this component lives in layout, so explicitly close on navigation
  useEffect(() => {
    setExpanded(false)
  }, [pathname])

  /* Не оставляем разметку в DOM при скрытии: дочерний `pointer-events-auto` иначе перекрывал
   * нижний CTA на /cart (родитель с `none`, потомок с `auto` всё ещё ловит тапы). */
  if (!visible) {
    return null
  }

   return (
     <>
      {/* scrim/backdrop for zoning when expanded */}
      {expanded ? (
        <button
          type="button"
          aria-label="закрыть корзину"
          onClick={() => setExpanded(false)}
          className="fixed inset-0 z-[80] bg-[color:var(--sticky-bg)]/70 backdrop-blur-[4px]"
        />
      ) : null}

       <div
         className={cn(
          'pointer-events-none fixed bottom-[calc(var(--ufo-bottomnav-h,72px)+env(safe-area-inset-bottom)+10px)] left-1/2 z-[110] w-[min(520px,92vw)] max-w-full -translate-x-1/2 transition-all duration-200 ease-out',
           'translate-y-0 opacity-100',
         )}
       >
        <div className="pointer-events-auto">
          {/* expanded mini sheet (separate layer) */}
          {expanded ? (
            <div
              className="mb-2 border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] shadow-[var(--shadow-soft)] backdrop-blur-xl"
              style={{ borderRadius: 'var(--radius-large)' }}
            >
              <div className="px-4 pt-3">
                <div className="ui-muted text-[12px]">в корзине</div>
                <div className="ui-h2 mt-1">{countLabel}</div>
              </div>

              <div className="px-4 pb-3 pt-3">
                <div
                  className="overflow-y-auto border border-[color:var(--stroke)] bg-[color:var(--surface)] px-3 py-2"
                  style={{ maxHeight: 280, borderRadius: 'var(--radius-medium)' }}
                >
                  {previewLines.length === 0 ? (
                    <div className="py-2 ui-muted text-[12px]">пусто</div>
                  ) : (
                    <>
                      {previewLinesStore.length > 0 ? <div className="pb-1 text-[11px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">магазин</div> : null}
                      {previewLinesStore.map((ln) => (
                        <div key={ln.key} className="flex items-center justify-between gap-3 border-b border-[color:var(--stroke)] py-2 last:border-0">
                          <div className="min-w-0">
                            <div className="min-w-0 ui-body truncate text-[13px]">{ln.text}</div>
                            {ln.optionText ? (
                              <div className="ui-muted mt-0.5 truncate text-[11px]">{ln.optionText}</div>
                            ) : null}
                          </div>
                          <div className="shrink-0 ui-muted text-[12px] tabular-nums">× {ln.qty}</div>
                        </div>
                      ))}
                      {previewLinesDish.length > 0 ? <div className="pb-1 pt-2 text-[11px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">ресторан</div> : null}
                      {previewLinesDish.map((ln) => (
                        <div key={ln.key} className="flex items-center justify-between gap-3 border-b border-[color:var(--stroke)] py-2 last:border-0">
                          <div className="min-w-0">
                            <div className="min-w-0 ui-body truncate text-[13px]">{ln.text}</div>
                            {ln.optionText ? (
                              <div className="ui-muted mt-0.5 truncate text-[11px]">{ln.optionText}</div>
                            ) : null}
                          </div>
                          <div className="shrink-0 ui-muted text-[12px] tabular-nums">× {ln.qty}</div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 px-4 pb-4 pt-1">
                <Link
                  href="/cart"
                  prefetch={false}
                  className="btn btn-soft inline-flex h-10 flex-1 items-center justify-center rounded-full text-[13px] transition active:opacity-80"
                >
                  корзина
                </Link>
                <Link
                  href="/checkout"
                  prefetch={false}
                  className="btn btn-primary inline-flex h-11 flex-[1.2] items-center justify-center rounded-full px-5 text-[14px] font-semibold transition active:opacity-90"
                >
                  оформить
                </Link>
              </div>
            </div>
          ) : null}

          {/* pill (always visible) - unified style */}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex w-full items-center justify-between gap-3 border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] px-4 py-3 text-left shadow-[var(--shadow-soft)] backdrop-blur-xl transition active:scale-[0.99]"
            style={{ borderRadius: 'var(--radius-large)' }}
            aria-label={expanded ? 'свернуть корзину' : 'открыть корзину'}
            aria-expanded={expanded}
          >
            <span
              className={cn(
                'inline-flex h-9 w-9 items-center justify-center rounded-full',
                'bg-[color:var(--primary)] text-white'
              )}
              aria-hidden
            >
              <IconCart className="h-5 w-5" />
            </span>

            <span className="min-w-0 flex-1">
              <div className="ui-h2 tabular-nums">{formatPrice(total)}</div>
              <div className="ui-muted mt-0.5 text-[12px]">{countLabel}</div>
            </span>

            <span
              className={cn(
                'inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface)] text-[color:var(--muted)] transition',
                expanded ? 'rotate-180' : ''
              )}
              aria-hidden
            >
              <IconChevronUp className="h-5 w-5" />
            </span>
          </button>
        </div>
       </div>
     </>
   )
 }

