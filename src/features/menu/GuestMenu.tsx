'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useCartStore } from '@/store/cart-store'
import { useVenue } from '@/lib/venue-context'
import { telegramInitHeaderRecord } from '@/lib/tg-webapp-client'
import { IMAGE_SIZES, OptimizedImage } from '@/components/ui/OptimizedImage'
import { Badge, Btn, Chip, Empty, Sheet, Stepper, fmtThb } from '@/components/kit'
import { cn } from '@/lib/utils'
import { useDeliveryHint } from '@/store/delivery-hint-store'
import { DishRail, PromoRail, type PromoCard, type RailDish } from './home-rails'

/* ---------- единая модель позиции: блюдо или товар ---------- */

type OptionValue = { id: string; name: string; priceAdjust: number }
type OptionGroup = { id: string; name: string; values: OptionValue[] }
type Variant = { id: string; name: string; price: number; qty: number; isActive: boolean }

type Item = {
  key: string
  kind: 'dish' | 'store'
  id: string
  name: string
  description?: string
  price: number
  image?: string
  categoryKey: string
  available: boolean
  tags: string[]
  weightLabel?: string
  optionGroups: OptionGroup[]
  /** старые модификаторы блюда: один на выбор */
  modifiers: OptionValue[]
  /** варианты товара */
  variants: Variant[]
  maxQty?: number
}

type Cat = { key: string; name: string }
type ActiveOrder = { id: string; status: string; etaLabel?: string }

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'ждёт подтверждения',
  CONFIRMED: 'принят',
  PREPARING: 'готовим',
  READY: 'готов',
  OUT_FOR_DELIVERY: 'курьер в пути',
}

function hasChoices(it: Item) {
  return it.optionGroups.some((g) => g.values.length > 0) || it.modifiers.length > 0 || it.variants.length > 1
}

function lineId(it: Item, modifierIds: string[], variantId?: string) {
  const base = it.kind === 'dish' ? it.id : String(variantId ?? it.variants[0]?.id ?? it.id)
  return modifierIds.length ? `${base}_${[...modifierIds].sort().join(',')}` : base
}

export function GuestMenu() {
  const { restaurantId, name: venueName, settings, isLoading: venueLoading } = useVenue()
  const addItem = useCartStore((s) => s.addItem)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const removeItem = useCartStore((s) => s.removeItem)
  const cartItems = useCartStore((s) => s.items)

  const [items, setItems] = useState<Item[]>([])
  const [cats, setCats] = useState<Cat[]>([])
  const [promos, setPromos] = useState<PromoCard[]>([])
  const [freeFrom, setFreeFrom] = useState<number | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const setDeliveryHint = useDeliveryHint((s) => s.set)
  const tabsRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState<{ isOpen: boolean; until: string } | null>(null)
  const [deliveryFrom, setDeliveryFrom] = useState<number | null>(null)
  const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [cat, setCat] = useState<string>('all')
  const [q, setQ] = useState('')
  const [focused, setFocused] = useState<Item | null>(null)
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map())

  const headers = useMemo<Record<string, string>>(
    () => ({
      ...telegramInitHeaderRecord(),
      ...(restaurantId && restaurantId !== 'default' ? { 'x-ufo-restaurant': restaurantId } : {}),
    }),
    [restaurantId]
  )

  const load = useCallback(async () => {
    if (venueLoading) return
    const get = (url: string) => fetch(url, { cache: 'no-store', credentials: 'include', headers }).then((r) => r.json()).catch(() => null)
    const [c, d, sc, sp, b, s, o] = await Promise.all([
      get('/api/categories'),
      get('/api/dishes'),
      settings.storeEnabled ? get('/api/store/categories') : null,
      settings.storeEnabled ? get('/api/store/products') : null,
      get('/api/banners?placement=home'),
      get('/api/settings'),
      get('/api/orders'),
    ])

    const nextCats: Cat[] = []
    for (const x of Array.isArray(c) ? c : c?.categories ?? []) nextCats.push({ key: `d:${x.id}`, name: x.name })
    for (const x of Array.isArray(sc) ? sc : sc?.categories ?? []) nextCats.push({ key: `s:${x.id}`, name: x.name })

    const next: Item[] = []
    for (const x of Array.isArray(d) ? d : d?.dishes ?? []) {
      next.push({
        key: `d:${x.id}`,
        kind: 'dish',
        id: x.id,
        name: x.name,
        description: x.description ?? undefined,
        price: Number(x.price ?? 0),
        image: x.image ?? undefined,
        categoryKey: `d:${x.categoryId}`,
        available: x.isAvailable !== false,
        tags: Array.isArray(x.tags) ? x.tags : [],
        weightLabel: x.weightLabel ?? undefined,
        optionGroups: (x.optionGroups ?? []).map((g: any) => ({
          id: g.id,
          name: g.name,
          values: (g.values ?? []).map((v: any) => ({ id: v.id, name: v.name, priceAdjust: Number(v.priceAdjust ?? 0) })),
        })),
        modifiers: (x.modifiers ?? []).map((m: any) => ({ id: m.id, name: m.name, priceAdjust: Number(m.priceAdjust ?? 0) })),
        variants: [],
        maxQty: x.maxOrderQuantity ?? x.category?.maxOrderQuantity ?? undefined,
      })
    }
    for (const p of sp?.products ?? []) {
      const variants: Variant[] = (p.variants ?? []).map((v: any) => ({
        id: String(v.id),
        name: String(v.name ?? ''),
        price: Number(v.price ?? 0),
        qty: Number(v.qty ?? 0),
        isActive: v.isActive !== false,
      }))
      const live = variants.filter((v) => v.isActive && v.qty > 0)
      next.push({
        key: `s:${p.id}`,
        kind: 'store',
        id: p.id,
        name: p.name,
        description: p.description ?? undefined,
        price: live[0]?.price ?? variants[0]?.price ?? 0,
        image: p.image ?? undefined,
        categoryKey: `s:${p.categoryId ?? p.category?.id}`,
        available: live.length > 0,
        tags: [],
        optionGroups: (p.optionGroups ?? []).map((g: any) => ({
          id: g.id,
          name: g.name,
          values: (g.values ?? []).map((v: any) => ({ id: v.id, name: v.name, priceAdjust: 0 })),
        })),
        modifiers: [],
        variants: live.length ? live : variants,
      })
    }

    setCats(nextCats.filter((x) => next.some((it) => it.categoryKey === x.key)))
    setItems(next)
    const promoCards: PromoCard[] = (b?.banners ?? []).filter((x: PromoCard) => x?.id && x?.title)
    if (settings.subscriptionEnabled && !promoCards.some((x) => x.href?.startsWith('/subscriptions'))) {
      promoCards.unshift({ id: 'subscription', title: 'Рацион на неделю', description: 'дешевле, чем заказывать из меню', href: '/subscriptions', cta: 'собрать рацион', type: 'chip' })
    }
    setPromos(promoCards.slice(0, 8))

    const st = s?.settings ?? {}
    const openTime = String(st.openTime ?? '10:00')
    const closeTime = String(st.closeTime ?? '22:00')
    const isOpen = (() => {
      if (typeof st.isOpenOverride === 'boolean') return st.isOpenOverride
      const [oh, om] = openTime.split(':').map(Number)
      const [ch, cm] = closeTime.split(':').map(Number)
      const now = new Date()
      const m = now.getHours() * 60 + now.getMinutes()
      const a = oh * 60 + om
      const z = ch * 60 + cm
      return a <= z ? m >= a && m < z : m >= a || m < z
    })()
    setOpen({ isOpen, until: closeTime })
    const fee = Number.isFinite(Number(st.deliveryFee)) ? Number(st.deliveryFee) : null
    const free = Number(st.freeDeliveryFrom) > 0 ? Number(st.freeDeliveryFrom) : null
    setDeliveryFrom(fee)
    setFreeFrom(free)
    setDeliveryHint(fee, free)

    const orders: any[] = o?.orders ?? []
    const live = orders.find((x) => ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'].includes(x.status))
    setActiveOrder(live ? { id: live.id, status: live.status } : null)
    setLoading(false)
  }, [headers, settings.storeEnabled, settings.subscriptionEnabled, venueLoading, setDeliveryHint])

  useEffect(() => {
    void load()
  }, [load])

  const qtyByLine = useMemo(() => {
    const m = new Map<string, number>()
    for (const it of cartItems) m.set(String(it.id), Number(it.quantity ?? 0))
    return m
  }, [cartItems])

  /** сколько единиц позиции в корзине (все её варианты и опции) */
  const qtyOfItem = useCallback(
    (it: Item) => {
      let n = 0
      for (const line of cartItems) {
        const id = String(line.id)
        if (it.kind === 'dish' && (line as any).dishId === it.id) n += Number(line.quantity ?? 0)
        if (it.kind === 'store' && it.variants.some((v) => id === v.id || id.startsWith(`${v.id}_`))) n += Number(line.quantity ?? 0)
      }
      return n
    },
    [cartItems]
  )

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return needle ? items.filter((it) => it.name.toLowerCase().includes(needle)) : items
  }, [items, q])

  const grouped = useMemo(() => {
    const map = new Map<string, Item[]>()
    for (const it of visible) {
      const arr = map.get(it.categoryKey) ?? []
      arr.push(it)
      map.set(it.categoryKey, arr)
    }
    return cats.filter((c) => map.has(c.key)).map((c) => ({ cat: c, items: map.get(c.key)! }))
  }, [visible, cats])

  const quickAdd = (it: Item) => {
    if (hasChoices(it)) {
      setFocused(it)
      return
    }
    if (it.kind === 'dish') {
      addItem({ dishId: it.id, name: it.name, description: it.description, price: it.price, quantity: 1, imageUrl: it.image }, restaurantId)
    } else {
      const v = it.variants[0]
      if (!v) return
      addItem({ storeVariantId: v.id, productId: it.id, name: it.name, variantName: v.name || undefined, price: v.price, quantity: 1, imageUrl: it.image }, restaurantId)
    }
  }

  const quickChange = (it: Item, delta: number) => {
    // без опций — одна строка в корзине; с опциями — открываем шторку
    if (hasChoices(it)) {
      setFocused(it)
      return
    }
    const id = lineId(it, [])
    const cur = qtyByLine.get(id) ?? 0
    const nextQty = cur + delta
    if (nextQty <= 0) removeItem(id, it.kind)
    else if (cur === 0) quickAdd(it)
    else updateQuantity(id, nextQty, it.kind)
  }

  const scrollToCat = (key: string) => {
    setCat(key)
    sectionRefs.current.get(key)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  /* активная вкладка категории следует за прокруткой */
  useEffect(() => {
    if (q.trim() || grouped.length < 2) return
    const io = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        const key = (top?.target as HTMLElement | undefined)?.dataset.cat
        if (key) setCat(key)
      },
      { rootMargin: '-64px 0px -65% 0px' }
    )
    sectionRefs.current.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [grouped, q])

  /* активную вкладку держим в зоне видимости строки категорий */
  useEffect(() => {
    const row = tabsRef.current
    const chip = row?.querySelector<HTMLElement>(`[data-tab="${CSS.escape(cat)}"]`)
    if (!row || !chip) return
    const left = chip.offsetLeft - row.clientWidth / 2 + chip.clientWidth / 2
    row.scrollTo({ left: Math.max(0, left), behavior: 'smooth' })
  }, [cat])

  const searching = Boolean(q.trim())
  const toRail = useCallback(
    (list: Item[]): RailDish[] =>
      list.slice(0, 12).map((it) => ({ key: it.key, name: it.name, price: it.price, image: it.image, weightLabel: it.weightLabel, off: !it.available || Boolean(open && !open.isOpen), qty: qtyOfItem(it) })),
    [open, qtyOfItem]
  )
  const hits = useMemo(() => toRail(items.filter((it) => it.available && it.tags.some((t) => t === 'hit' || t === 'popular' || t === 'chef-choice'))), [items, toRail])
  const fresh = useMemo(() => toRail(items.filter((it) => it.available && it.tags.includes('new'))), [items, toRail])
  const byKey = useMemo(() => new Map(items.map((it) => [it.key, it])), [items])
  const openKey = (key: string) => { const it = byKey.get(key); if (it) setFocused(it) }
  const addKey = (key: string) => { const it = byKey.get(key); if (it) quickAdd(it) }

  const closed = open && !open.isOpen

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-36 pt-3">
      <header className="mb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-[26px] font-extrabold leading-tight tracking-tight text-[color:var(--text)]">{venueName || '—'}</h1>
            <div className={cn('mt-0.5 text-[13px] font-semibold', closed ? 'text-[color:var(--danger)]' : 'text-[color:var(--ok)]')}>
              {open ? (open.isOpen ? `открыто до ${open.until}` : 'сейчас закрыто') : ' '}
            </div>
          </div>
          <button
            type="button"
            onClick={() => { setSearchOpen((v) => !v); if (searchOpen) setQ('') }}
            aria-label={searchOpen ? 'закрыть поиск' : 'поиск по меню'}
            aria-expanded={searchOpen}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[color:var(--surface-strong)] text-[color:var(--text)] shadow-[var(--shadow-card)]"
          >
            {searchOpen ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5" aria-hidden><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></svg>
            )}
          </button>
        </div>
        {deliveryFrom !== null && !closed ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[color:var(--surface-strong)] px-3 text-[13px] font-medium text-[color:var(--text)]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-[color:var(--muted)]" aria-hidden><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" /><circle cx="7" cy="17.5" r="1.5" /><circle cx="17" cy="17.5" r="1.5" /></svg>
              доставка {deliveryFrom > 0 ? fmtThb(deliveryFrom) : 'бесплатно'}
            </span>
            {freeFrom && deliveryFrom > 0 ? (
              <span className="inline-flex h-8 items-center rounded-full bg-[color:var(--ok-bg)] px-3 text-[13px] font-semibold text-[color:var(--ok)]">
                бесплатно от {fmtThb(freeFrom)}
              </span>
            ) : null}
          </div>
        ) : null}
        {searchOpen ? (
          <label className="mt-3 block">
            <span className="sr-only">поиск по меню</span>
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="блюдо или продукт"
              className="h-12 w-full rounded-[16px] border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] px-4 text-[15px] text-[color:var(--text)] placeholder:text-[color:var(--muted)] focus:outline-none"
            />
          </label>
        ) : null}
      </header>

      {activeOrder ? (
        <Link
          href="/orders"
          prefetch={false}
          className="mb-4 flex items-center gap-3 rounded-[16px] border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] px-3 py-2.5"
        >
          <span className="h-2 w-2 shrink-0 rounded-full bg-[color:var(--warn)]" aria-hidden />
          <span className="flex-1 text-[13px] text-[color:var(--text)]">
            <b className="font-semibold">заказ #{activeOrder.id.slice(-4)}</b> · {STATUS_LABEL[activeOrder.status] ?? activeOrder.status}
          </span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 text-[color:var(--muted)]" aria-hidden><path d="M9 6l6 6-6 6" /></svg>
        </Link>
      ) : null}

      {!searching && !loading ? (
        <>
          <PromoRail cards={promos} />
          <DishRail title="Хиты" items={hits} onOpen={openKey} onAdd={addKey} />
          <DishRail title="Новинки" items={fresh} onOpen={openKey} onAdd={addKey} />
        </>
      ) : null}

      {cats.length > 1 && !searching ? (
        <div ref={tabsRef} className="sticky top-0 z-10 -mx-4 mb-3 flex gap-2 overflow-x-auto bg-[color:var(--bg)] px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {cats.map((c) => (
            <span key={c.key} data-tab={c.key} className="shrink-0">
              <Chip active={cat === c.key} onClick={() => scrollToCat(c.key)}>{c.name}</Chip>
            </span>
          ))}
        </div>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-2 gap-2.5" aria-busy>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[214px] animate-pulse rounded-[18px] bg-[color:var(--surface)]" />
          ))}
        </div>
      ) : !items.length ? (
        <Empty title="меню пока пустое" hint="владелец ещё добавляет блюда" />
      ) : !visible.length ? (
        <Empty title="ничего не нашли" action={<Btn variant="secondary" onClick={() => setQ('')}>показать всё</Btn>} />
      ) : (
        grouped.map(({ cat: c, items: list }) => (
          <section key={c.key} data-cat={c.key} ref={(el) => { if (el) sectionRefs.current.set(c.key, el); else sectionRefs.current.delete(c.key) }} className="mb-5 scroll-mt-16">
            {grouped.length > 1 ? <h2 className="mb-2 text-[19px] font-bold tracking-tight text-[color:var(--text)]">{c.name}</h2> : null}
            <div className="grid grid-cols-2 gap-2.5">
              {list.map((it) => {
                const n = qtyOfItem(it)
                const off = !it.available || Boolean(closed)
                return (
                  <article key={it.key} className={cn('flex flex-col gap-1.5 overflow-hidden rounded-[18px] bg-[color:var(--surface-strong)] pb-3', off && 'opacity-60')}>
                    <button type="button" onClick={() => setFocused(it)} className="relative block aspect-[4/3] w-full overflow-hidden bg-[color:var(--surface)] text-left" aria-label={it.name}>
                      {it.image ? (
                        <OptimizedImage src={it.image} alt="" sizes={IMAGE_SIZES.menuGrid} className="object-cover" />
                      ) : null}
                      <TagBadges tags={it.tags} className="absolute bottom-2 left-2 right-2" />
                    </button>
                    <button type="button" onClick={() => setFocused(it)} className="px-3 text-left">
                      <div className="line-clamp-2 text-[14px] font-semibold leading-tight text-[color:var(--text)]">{it.name}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[13px] text-[color:var(--muted)]">
                        <span className="text-[color:var(--text)]">{fmtThb(it.price)}</span>
                        {it.weightLabel ? <span>· {it.weightLabel}</span> : null}
                      </div>
                    </button>
                    <div className="px-2.5">
                      {off ? (
                        <div className="flex h-11 items-center justify-center rounded-[14px] bg-[color:var(--surface)] text-[13px] font-semibold text-[color:var(--muted)]">
                          {closed ? 'закрыто' : 'на сегодня нет'}
                        </div>
                      ) : n > 0 && !hasChoices(it) ? (
                        <Stepper value={n} onChange={(v) => quickChange(it, v - n)} max={it.maxQty ?? 99} />
                      ) : (
                        <Btn full onClick={() => quickAdd(it)}>
                          {n > 0 ? `в корзине · ${n}` : hasChoices(it) ? 'выбрать' : 'в корзину'}
                        </Btn>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        ))
      )}

      <ItemSheet item={focused} onClose={() => setFocused(null)} restaurantId={restaurantId} closed={Boolean(closed)} />
    </main>
  )
}

/* ---------- теги позиции: одни и те же бейджи в сетке и в шторке ---------- */

function itemTagBadges(tags: string[], long = false) {
  const out: JSX.Element[] = []
  if (!long) {
    if (tags.includes('hit') || tags.includes('popular')) out.push(<Badge key="hit" tone="danger">хит</Badge>)
    else if (tags.includes('new')) out.push(<Badge key="new" tone="solid">новинка</Badge>)
  }
  if (tags.includes('vegan')) out.push(<Badge key="vegan" tone="ok">веган</Badge>)
  else if (tags.includes('vegetarian')) out.push(<Badge key="veg" tone="ok">{long ? 'вегетарианское' : 'вег'}</Badge>)
  if (tags.includes('spicy')) out.push(<Badge key="spicy" tone="warn">остро</Badge>)
  return out
}

function TagBadges({ tags, className }: { tags: string[]; className?: string }) {
  const badges = itemTagBadges(tags)
  if (!badges.length) return null
  return <div className={cn('pointer-events-none flex flex-wrap gap-1', className)}>{badges}</div>
}

/* ---------- шторка позиции: описание, опции, количество ---------- */

function ItemSheet({ item, onClose, restaurantId, closed }: { item: Item | null; onClose: () => void; restaurantId: string; closed: boolean }) {
  const addItem = useCartStore((s) => s.addItem)
  const [sel, setSel] = useState<Record<string, string>>({})
  const [mod, setMod] = useState<string | null>(null)
  const [variantId, setVariantId] = useState<string | null>(null)
  const [qty, setQty] = useState(1)

  useEffect(() => {
    if (!item) return
    const s: Record<string, string> = {}
    for (const g of item.optionGroups) if (g.values[0]) s[g.id] = g.values[0].id
    setSel(s)
    setMod(item.optionGroups.length ? null : item.modifiers[0]?.id ?? null)
    setVariantId(item.variants[0]?.id ?? null)
    setQty(1)
  }, [item])

  if (!item) return null

  const chosenValues = item.optionGroups.flatMap((g) => g.values.filter((v) => v.id === sel[g.id]))
  const chosenMod = item.modifiers.find((m) => m.id === mod) ?? null
  const variant = item.variants.find((v) => v.id === variantId) ?? item.variants[0] ?? null
  const unit = (item.kind === 'store' ? variant?.price ?? item.price : item.price) + chosenValues.reduce((n, v) => n + v.priceAdjust, 0) + (chosenMod?.priceAdjust ?? 0)
  const off = !item.available || closed

  const submit = () => {
    const modifierIds = [...chosenValues.map((v) => v.id), ...(chosenMod ? [chosenMod.id] : [])]
    const modifierLabels = [...chosenValues.map((v) => v.name), ...(chosenMod ? [chosenMod.name] : [])]
    if (item.kind === 'dish') {
      addItem({ dishId: item.id, name: item.name, description: item.description, price: unit, quantity: qty, imageUrl: item.image, modifierIds, modifierLabels }, restaurantId)
    } else if (variant) {
      addItem({ storeVariantId: variant.id, productId: item.id, name: item.name, variantName: variant.name || undefined, price: unit, quantity: qty, imageUrl: item.image, modifierIds, modifierLabels }, restaurantId)
    }
    onClose()
  }

  return (
    <Sheet
      open
      onClose={onClose}
      footer={
        off ? (
          <Btn size="lg" full disabled>{closed ? 'сейчас закрыто' : 'на сегодня нет'}</Btn>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-[128px]"><Stepper value={qty} onChange={setQty} min={1} max={item.maxQty ?? 99} /></div>
            <Btn size="lg" full onClick={submit}>в корзину · {fmtThb(unit * qty)}</Btn>
          </div>
        )
      }
    >
      {item.image ? (
        <div className="relative mb-3 aspect-[4/3] w-full overflow-hidden rounded-[16px] bg-[color:var(--surface)]">
          <OptimizedImage src={item.image} alt="" sizes={IMAGE_SIZES.menuGrid} className="object-cover" />
        </div>
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[20px] font-bold leading-tight text-[color:var(--text)]">{item.name}</h2>
        <div className="shrink-0 text-[18px] font-bold text-[color:var(--text)]">{fmtThb(unit)}</div>
      </div>
      {item.weightLabel || item.tags.length ? (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {item.weightLabel ? <Badge tone="muted">{item.weightLabel}</Badge> : null}
          {itemTagBadges(item.tags, true)}
        </div>
      ) : null}
      {item.description ? <p className="mt-2 text-[14px] leading-relaxed text-[color:var(--muted)]">{item.description}</p> : null}

      {item.variants.length > 1 ? (
        <OptionRow title="вариант">
          {item.variants.map((v) => (
            <Chip key={v.id} active={v.id === variant?.id} onClick={() => setVariantId(v.id)}>
              {v.name || 'стандарт'} · {fmtThb(v.price)}
            </Chip>
          ))}
        </OptionRow>
      ) : null}
      {item.optionGroups.filter((g) => g.values.length).map((g) => (
        <OptionRow key={g.id} title={g.name}>
          {g.values.map((v) => (
            <Chip key={v.id} active={sel[g.id] === v.id} onClick={() => setSel((s) => ({ ...s, [g.id]: v.id }))}>
              {v.name}{v.priceAdjust ? ` +${fmtThb(v.priceAdjust)}` : ''}
            </Chip>
          ))}
        </OptionRow>
      ))}
      {item.modifiers.length ? (
        <OptionRow title="на выбор">
          {item.modifiers.map((m) => (
            <Chip key={m.id} active={mod === m.id} onClick={() => setMod(mod === m.id ? null : m.id)}>
              {m.name}{m.priceAdjust ? ` +${fmtThb(m.priceAdjust)}` : ''}
            </Chip>
          ))}
        </OptionRow>
      ) : null}
    </Sheet>
  )
}

function OptionRow({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <div className="mb-2 text-[12.5px] font-semibold text-[color:var(--muted)]">{title}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}
