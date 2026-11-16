'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { useCartStore } from '@/store/cart-store'
import { useVenue } from '@/lib/venue-context'
import { loadDeliveryProfile, saveDeliveryProfile } from '@/lib/delivery-profile'
import { telegramInitHeaderRecord } from '@/lib/tg-webapp-client'
import { isQrSlug } from '@/lib/payment-methods'
import { useGuestDelivery } from '@/hooks/useGuestDelivery'
import { Badge, BottomBar, Btn, Card, Empty, Screen, Segmented, Stepper, fmtThb } from '@/components/kit'

type When = 'asap' | 'later'

const LATER_OPTIONS = [60, 90, 120, 180]

export default function CheckoutPage() {
  const router = useRouter()
  const { restaurantId } = useVenue()
  const items = useCartStore((s) => s.items)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const removeItem = useCartStore((s) => s.removeItem)
  const clearCart = useCartStore((s) => s.clearCart)

  const headers = useMemo<Record<string, string>>(
    () => ({ ...telegramInitHeaderRecord(), ...(restaurantId && restaurantId !== 'default' ? { 'x-ufo-restaurant': restaurantId } : {}) }),
    [restaurantId]
  )

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [apartment, setApartment] = useState('')
  const [geo, setGeo] = useState<{ lat: string; lng: string } | null>(null)
  const [editingAddress, setEditingAddress] = useState(false)
  const [when, setWhen] = useState<When>('asap')
  const [laterMin, setLaterMin] = useState(90)
  const [pay, setPay] = useState('CASH')
  const [promo, setPromo] = useState('')
  const [promoOpen, setPromoOpen] = useState(false)
  const [promoState, setPromoState] = useState<{ ok: boolean; discount: number; msg?: string; campaignId?: string }>({ ok: false, discount: 0 })
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const reqId = useRef<string | null>(null)

  useEffect(() => {
    const p = loadDeliveryProfile()
    if (p) {
      setName(p.name || '')
      setAddress(p.address || '')
      setApartment(p.apartment || '')
      if (p.lat && p.lng) setGeo({ lat: p.lat, lng: p.lng })
    }
    if (!p?.address) setEditingAddress(true)
    try {
      const cached = String(window.localStorage.getItem('ufo:checkout:paymentOptionSlug') || '').toUpperCase()
      if (cached) setPay(cached)
    } catch {}
  }, [])

  const subtotal = useMemo(() => items.reduce((n, it) => n + Number(it.price ?? 0) * Number(it.quantity ?? 0), 0), [items])

  const delivery = useGuestDelivery({
    subtotal,
    restaurantHeaders: headers,
    fetchQuote: true,
    address: address.trim() ? { address: [address, apartment].filter(Boolean).join(', '), city: 'Пхукет', zipCode: '', lat: geo?.lat, lng: geo?.lng } : null,
  })
  const payOptions = delivery.settings.paymentOptions
  useEffect(() => {
    const slugs = payOptions.map((p) => p.slug)
    if (slugs.length && !slugs.includes(pay)) setPay(slugs[0])
  }, [payOptions, pay])

  const fee = delivery.estimatedDeliveryFee
  const total = Math.max(0, subtotal + fee - promoState.discount)
  const zone = delivery.quote?.matched ? delivery.quote.zone : null
  const minOrderMissing = zone && !zone.minOrderSatisfied ? zone.missingForMinOrder : 0

  /* промокод: проверка с задержкой */
  useEffect(() => {
    const code = promo.trim().toUpperCase()
    if (!code) {
      setPromoState({ ok: false, discount: 0 })
      return
    }
    let cancelled = false
    const t = setTimeout(async () => {
      try {
        const res = await fetch('/api/campaigns/validate', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json', ...headers },
          body: JSON.stringify({
            code,
            subtotal,
            deliveryFee: fee,
            items: items.map((it: any) => ({
              quantity: Number(it.quantity ?? 1),
              unitPrice: Number(it.price ?? 0),
              dishId: it.dishId || null,
              storeVariantId: it.storeVariantId || null,
              categoryId: null,
              kind: it.kind || (it.storeVariantId ? 'store' : 'dish'),
            })),
          }),
        })
        const d = await res.json().catch(() => null)
        if (cancelled) return
        if (res.ok && d?.ok) setPromoState({ ok: true, discount: Number(d.discountAmount ?? 0), campaignId: d.campaignId, msg: d.giftTitle ? `подарок: ${d.giftTitle}` : undefined })
        else setPromoState({ ok: false, discount: 0, msg: d?.error || 'промокод не подошёл' })
      } catch {
        if (!cancelled) setPromoState({ ok: false, discount: 0, msg: 'не удалось проверить' })
      }
    }, 350)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [promo, subtotal, fee, items, headers])

  const locate = () => {
    if (!navigator.geolocation) return toast.error('геопозиция недоступна')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = String(pos.coords.latitude)
        const lng = String(pos.coords.longitude)
        setGeo({ lat, lng })
        try {
          const res = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`, { cache: 'no-store' })
          const d = await res.json().catch(() => null)
          if (res.ok && d?.ok && d.address) setAddress(String(d.address))
        } catch {}
      },
      () => toast.error('не удалось определить место'),
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  const canSubmit =
    !submitting &&
    items.length > 0 &&
    name.trim().length > 0 &&
    address.trim().length > 0 &&
    !delivery.quoteLoading &&
    !delivery.outOfZone &&
    !minOrderMissing

  const submit = useCallback(async () => {
    if (!canSubmit) return
    setSubmitting(true)
    reqId.current ??= globalThis.crypto?.randomUUID?.() ?? String(Date.now())
    let paymentIntentId: string | undefined
    const lineItems = items.map((it: any) => ({
      kind: it.kind || (it.storeVariantId ? 'store' : 'dish'),
      dishId: it.dishId || '',
      storeVariantId: it.storeVariantId || '',
      name: it.name || 'позиция',
      quantity: Number(it.quantity ?? 1),
      price: Number(it.price ?? 0),
      modifierIds: Array.isArray(it.modifierIds) ? it.modifierIds : [],
      modifierLabels: Array.isArray(it.modifierLabels) ? it.modifierLabels : [],
    }))
    try {
      if (pay === 'STRIPE') {
        const r = await fetch('/api/payment/intent', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json', ...headers },
          body: JSON.stringify({ items: lineItems.map((i) => ({ kind: i.kind, dishId: i.dishId, storeVariantId: i.storeVariantId, quantity: i.quantity, modifierIds: i.modifierIds })), deliveryFee: fee }),
        })
        const d = await r.json().catch(() => null)
        if (!r.ok || !d?.paymentIntentId) throw new Error(d?.error || 'онлайн-оплата недоступна')
        paymentIntentId = String(d.paymentIntentId)
      }
      const res = await fetch('/api/orders', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify({
          clientRequestId: reqId.current,
          totalAmount: total,
          deliveryFee: fee,
          promoCode: promoState.ok && promo.trim() ? promo.trim().toUpperCase() : undefined,
          campaignId: promoState.ok ? promoState.campaignId : undefined,
          paymentOptionSlug: pay,
          paymentIntentId,
          fulfillment: 'DELIVERY',
          deliveryTime: when === 'later' ? new Date(Date.now() + laterMin * 60_000).toISOString() : undefined,
          address: { street: [address, apartment].filter(Boolean).join(', '), city: 'Пхукет', zipCode: '', country: 'Thailand', ...(geo ? { lat: Number(geo.lat), lng: Number(geo.lng) } : {}) },
          notes: [name.trim() ? `Гость: ${name.trim()}` : '', notes.trim()].filter(Boolean).join(' · ') || undefined,
          items: lineItems,
        }),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok) throw new Error(d?.error || 'не удалось создать заказ')
      saveDeliveryProfile({ name, address, apartment, city: 'Пхукет', zipCode: '', lat: geo?.lat, lng: geo?.lng })
      try { window.localStorage.setItem('ufo:checkout:paymentOptionSlug', pay) } catch {}
      clearCart()
      const orderId = typeof d?.orderId === 'string' ? d.orderId : null
      router.push(orderId && isQrSlug(pay) ? `/orders/${orderId}/pay` : '/orders')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'ошибка')
      setSubmitting(false)
    }
  }, [canSubmit, items, pay, headers, fee, total, promoState, promo, when, laterMin, address, apartment, geo, name, notes, clearCart, router])

  if (!items.length) {
    return (
      <Screen title="оформление" back="/">
        <Empty title="корзина пуста" hint="добавьте блюда из меню" action={<Btn onClick={() => router.push('/')}>в меню</Btn>} />
      </Screen>
    )
  }

  const selectedPay = payOptions.find((p) => p.slug === pay)

  return (
    <Screen title="оформление" back="/">
      <div className="flex flex-col gap-2.5">
        {/* позиции */}
        <Card>
          {items.map((it: any, i) => {
            const id = String(it.id)
            const kind = it.kind || (it.storeVariantId ? 'store' : 'dish')
            const q = Number(it.quantity ?? 0)
            return (
              <div key={id} className={i ? 'mt-3 border-t border-[color:var(--stroke)] pt-3' : ''}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-semibold text-[color:var(--text)]">{it.name}{it.variantName ? ` · ${it.variantName}` : ''}</div>
                    {Array.isArray(it.modifierLabels) && it.modifierLabels.length ? <div className="truncate text-[12.5px] text-[color:var(--muted)]">{it.modifierLabels.join(', ')}</div> : null}
                    <div className="text-[13px] text-[color:var(--muted)]">{fmtThb(Number(it.price ?? 0) * q)}</div>
                  </div>
                  <div className="w-[120px]">
                    <Stepper value={q} onChange={(n) => (n <= 0 ? removeItem(id, kind) : updateQuantity(id, n, kind))} />
                  </div>
                </div>
              </div>
            )
          })}
        </Card>

        {/* куда */}
        <Card>
          <div className="mb-2 text-[12.5px] font-semibold text-[color:var(--muted)]">куда привезти</div>
          {!editingAddress && address ? (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-[15px] font-semibold text-[color:var(--text)]">{address}</div>
                <div className="truncate text-[13px] text-[color:var(--muted)]">{[apartment, name].filter(Boolean).join(' · ')}</div>
              </div>
              <Btn variant="secondary" onClick={() => setEditingAddress(true)}>изменить</Btn>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="улица, дом или название виллы" className={inputCls} autoComplete="street-address" />
              <div className="flex gap-2">
                <input value={apartment} onChange={(e) => setApartment(e.target.value)} placeholder="ориентир, квартира" className={inputCls} />
                <Btn variant="secondary" onClick={locate} aria-label="определить по геопозиции">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /><circle cx="12" cy="12" r="8" /></svg>
                </Btn>
              </div>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ваше имя" className={inputCls} autoComplete="name" />
              {address && name ? <Btn variant="text" onClick={() => setEditingAddress(false)}>готово</Btn> : null}
            </div>
          )}
          <div className="mt-2 min-h-[26px]">
            {!address.trim() ? null : delivery.quoteLoading ? (
              <Badge tone="muted">считаем доставку…</Badge>
            ) : delivery.outOfZone ? (
              <Badge tone="danger">{delivery.quote?.message || 'сюда пока не возим'}</Badge>
            ) : zone ? (
              <Badge tone="ok">{zone.name} · доставка {fee > 0 ? fmtThb(fee) : 'бесплатно'} · ~{zone.deliveryWindowMin} мин</Badge>
            ) : (
              <Badge tone="muted">доставка {fee > 0 ? fmtThb(fee) : 'бесплатно'}</Badge>
            )}
            {minOrderMissing ? <div className="mt-1 text-[13px] text-[color:var(--warn)]">до минимального заказа не хватает {fmtThb(minOrderMissing)}</div> : null}
          </div>
        </Card>

        {/* когда */}
        <Card>
          <div className="mb-2 text-[12.5px] font-semibold text-[color:var(--muted)]">когда</div>
          <Segmented value={when} onChange={setWhen} options={[{ value: 'asap', label: 'как можно скорее' }, { value: 'later', label: 'ко времени' }]} />
          {when === 'later' ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {LATER_OPTIONS.map((m) => (
                <button key={m} type="button" onClick={() => setLaterMin(m)} aria-pressed={laterMin === m} className={laterMin === m ? chipOn : chipOff}>
                  через {m < 120 ? `${m} мин` : `${m / 60} ч`}
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-2 text-[13px] text-[color:var(--muted)]">{zone ? `~${zone.deliveryWindowMin} минут` : 'обычно 45–60 минут'}</div>
          )}
        </Card>

        {/* оплата */}
        <Card>
          <div className="mb-2 text-[12.5px] font-semibold text-[color:var(--muted)]">оплата</div>
          <div className="flex flex-wrap gap-2">
            {payOptions.map((p) => (
              <button key={p.slug} type="button" onClick={() => setPay(p.slug)} aria-pressed={pay === p.slug} className={pay === p.slug ? chipOn : chipOff}>
                {p.title}
              </button>
            ))}
          </div>
          {selectedPay?.instruction ? <div className="mt-2 text-[13px] leading-relaxed text-[color:var(--muted)]">{selectedPay.instruction}</div> : null}
          {isQrSlug(pay) ? <div className="mt-1 text-[13px] text-[color:var(--muted)]">после заказа покажем QR и попросим чек — повар начнёт после проверки</div> : null}
        </Card>

        {/* промокод и комментарий */}
        <Card className="p-2 pl-4">
          {promoOpen ? (
            <div className="flex items-center gap-2 py-1">
              <input value={promo} onChange={(e) => setPromo(e.target.value)} placeholder="промокод" className={inputCls} autoCapitalize="characters" />
              {promoState.msg || promoState.ok ? <span className={`shrink-0 text-[12.5px] ${promoState.ok ? 'text-[color:var(--ok)]' : 'text-[color:var(--danger)]'}`}>{promoState.ok ? `−${fmtThb(promoState.discount)}` : promoState.msg}</span> : null}
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-[14px] text-[color:var(--muted)]">промокод</span>
              <Btn variant="text" onClick={() => setPromoOpen(true)}>добавить</Btn>
            </div>
          )}
        </Card>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="комментарий курьеру или кухне" className={inputCls} />

        {/* итого */}
        <Card>
          <Line label={`${items.reduce((n, it) => n + Number(it.quantity ?? 0), 0)} поз.`} value={fmtThb(subtotal)} />
          <Line label="доставка" value={fee > 0 ? fmtThb(fee) : 'бесплатно'} muted />
          {promoState.ok && promoState.discount > 0 ? <Line label="скидка" value={`−${fmtThb(promoState.discount)}`} muted /> : null}
          <div className="mt-2 flex items-center justify-between border-t border-[color:var(--stroke)] pt-2 text-[17px] font-bold text-[color:var(--text)]">
            <span>итого</span>
            <span>{fmtThb(total)}</span>
          </div>
        </Card>
      </div>

      <BottomBar>
        <Btn size="lg" full disabled={!canSubmit} onClick={submit}>
          {submitting ? 'отправляем…' : `заказать · ${fmtThb(total)}`}
        </Btn>
      </BottomBar>
    </Screen>
  )
}

const inputCls =
  'h-11 w-full min-w-0 rounded-[14px] border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] px-3.5 text-[14px] text-[color:var(--text)] placeholder:text-[color:var(--muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--stroke-strong)]'
const chipOn = 'h-9 rounded-full bg-[color:var(--primary)] px-3.5 text-[13px] font-semibold text-[color:var(--on-primary)]'
const chipOff = 'h-9 rounded-full border border-[color:var(--stroke)] px-3.5 text-[13px] text-[color:var(--text)]'

function Line({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`flex items-center justify-between text-[14px] ${muted ? 'mt-1.5 text-[color:var(--muted)]' : 'text-[color:var(--text)]'}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}
