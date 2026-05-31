'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useCartStore } from '@/store/cart-store'
import { useOrderStore } from '@/store/order-store'
import { useVenue } from '@/lib/venue-context'
import { formatPrice } from '@/lib/utils'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { PageHeader } from '@/components/ui/PageHeader'
import { IMAGE_SIZES, OptimizedImage } from '@/components/ui/OptimizedImage'
import { loadDeliveryProfile, saveDeliveryProfile } from '@/lib/delivery-profile'
import { telegramInitHeaderRecord } from '@/lib/tg-webapp-client'
import { computeRubTotal, isQrSlug } from '@/lib/payment-methods'

type PaymentOptionRow = {
  slug: string
  title: string
  instruction?: string | null
  qrImageUrl?: string | null
  rubPerThb?: number | null
}

export default function CheckoutPage() {
  const router = useRouter()
  /** Нельзя подписываться на `getHydratedItems()` в селекторе — каждый вызов новый [], Zustand → бесконечные ререндеры. */
  const getHydratedItems = useCartStore((s) => s.getHydratedItems)
  const cartRevision = useCartStore(
    useShallow((s) => ({
      items: s.items,
      dishMetaById: s.dishMetaById,
      storeVariantMetaById: s.storeVariantMetaById,
    }))
  )
  const items = useMemo(() => getHydratedItems() as any[], [getHydratedItems, cartRevision])
  const cartRestaurantId = useCartStore((state) => state.restaurantId)
  const getTotal = useCartStore((state) => state.getTotal)
  const clearCart = useCartStore((state) => state.clearCart)
  const setOrders = useOrderStore((state) => state.setOrders)
  const cartCount = useCartStore((state) => state.getItemCount())
  const { restaurantId: venueRestaurantId } = useVenue()
  const effectiveRestaurantId = useMemo(() => {
    const rid = String(cartRestaurantId || venueRestaurantId || '').trim()
    return rid || null
  }, [cartRestaurantId, venueRestaurantId])
  const restaurantContextHeaders = useMemo((): HeadersInit => {
    if (effectiveRestaurantId && effectiveRestaurantId !== 'default') {
      return { 'x-ufo-restaurant': effectiveRestaurantId }
    }
    return {}
  }, [effectiveRestaurantId])
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    apartment: '',
    city: 'Пхукет',
    zipCode: '',
    deliveryTime: '',
    notes: '',
    lat: '',
    lng: '',
  })
  const [paymentOptionSlug, setPaymentOptionSlug] = useState<string>('CASH')
  const [modifierLabelById, setModifierLabelById] = useState<Record<string, string>>({})
  const [deliveryMethod, setDeliveryMethod] = useState<'DELIVERY' | 'PICKUP'>('DELIVERY')
  const [restaurantInfo, setRestaurantInfo] = useState<{ name: string; address: string }>({ name: '', address: '' })
  const [isAddressSheetOpen, setIsAddressSheetOpen] = useState(false)
  /** В шите: тап «доставка» при 0 зон — отдельный экран с объяснением, без перегруза карточки самовывоза. */
  const [addressSheetNoDeliveryExplainer, setAddressSheetNoDeliveryExplainer] = useState(false)
  const [isPaymentSheetOpen, setIsPaymentSheetOpen] = useState(false)
  const [isPromoSheetOpen, setIsPromoSheetOpen] = useState(false)
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const submitRequestIdRef = useRef<string | null>(null)
  const [promoCode, setPromoCode] = useState('')
  /** Акция без кода (AUTO / старые кампании) — валидация по id, как в /api/campaigns/validate */
  const [promoCampaignId, setPromoCampaignId] = useState('')
  const [availablePromos, setAvailablePromos] = useState<
    Array<{
      id: string
      name: string
      code?: string | null
      rewardType?: string | null
      rewardValue?: number | null
      giftTitle?: string | null
      validTo?: string | null
    }>
  >([])
  const [promoLoading, setPromoLoading] = useState(false)
  const [promoState, setPromoState] = useState<{
    validating: boolean
    ok: boolean
    reason?: string
    discountAmount: number
    totalAfter?: number
    giftTitle?: string
    giftDishId?: string
  }>({ validating: false, ok: false, discountAmount: 0 })

  const [appSettings, setAppSettings] = useState<{
    deliveryFee: number
    freeDeliveryFrom: number
    paymentOptions: PaymentOptionRow[]
    stripeConfigured: boolean
    activeDeliveryZonesCount: number | null
  }>({
    deliveryFee: 100,
    freeDeliveryFrom: 500,
    paymentOptions: [{ slug: 'CASH', title: 'Наличные курьеру' }],
    stripeConfigured: false,
    activeDeliveryZonesCount: null,
  })
  const [deliveryQuote, setDeliveryQuote] = useState<{
    matched: boolean
    reason?: string
    message?: string
    zone?: {
      id: string
      name: string
      deliveryFee: number
      minOrderAmount: number
      deliveryWindowMin: number
      minOrderSatisfied: boolean
      missingForMinOrder: number
    }
  } | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/settings', {
          cache: 'no-store',
          credentials: 'include',
          headers: { ...restaurantContextHeaders },
        })
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.ok || cancelled) return
        const opts = Array.isArray(data.settings?.paymentOptions) ? data.settings.paymentOptions : []
        const zc = data.settings?.activeDeliveryZonesCount
        let activeDeliveryZonesCount: number | null = null
        if (zc !== undefined && zc !== null) {
          const n = Math.trunc(Number(zc))
          activeDeliveryZonesCount = Number.isFinite(n) ? Math.max(0, n) : null
        }
        setAppSettings({
          deliveryFee: Number(data.settings?.deliveryFee ?? 100),
          freeDeliveryFrom: Number(data.settings?.freeDeliveryFrom ?? 500),
          paymentOptions: opts.length ? opts : [{ slug: 'CASH', title: 'Наличные курьеру' }],
          stripeConfigured: Boolean(data.settings?.stripeConfigured),
          activeDeliveryZonesCount,
        })
      } catch {
        // ignore
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [restaurantContextHeaders])

  useEffect(() => {
    const slugs = appSettings.paymentOptions.map((p) => p.slug)
    setPaymentOptionSlug((cur) => (slugs.includes(cur) ? cur : slugs[0] || 'CASH'))
  }, [appSettings.paymentOptions])

  useEffect(() => {
    const saved = loadDeliveryProfile()
    if (!saved) return
    // only prefill if empty (avoid overwriting user typing)
    setFormData((p) => ({
      ...p,
      name: p.name || saved.name || '',
      phone: p.phone || saved.phone || '',
      address: p.address || saved.address || '',
      apartment: p.apartment || saved.apartment || '',
      city: p.city || saved.city || 'Пхукет',
      zipCode: p.zipCode || saved.zipCode || '',
      lat: p.lat || saved.lat || '',
      lng: p.lng || saved.lng || '',
    }))
  }, [])
  useEffect(() => {
    try {
      const cached = String(window.localStorage.getItem('ufo:checkout:paymentOptionSlug') || '').toUpperCase()
      if (cached) setPaymentOptionSlug(cached)
      const methodCached = String(window.localStorage.getItem('ufo:checkout:deliveryMethod') || '').toUpperCase()
      if (methodCached === 'DELIVERY' || methodCached === 'PICKUP') {
        setDeliveryMethod(methodCached as 'DELIVERY' | 'PICKUP')
      }
    } catch {
      // ignore storage access
    }
  }, [])
  useEffect(() => {
    try {
      window.localStorage.setItem('ufo:checkout:paymentOptionSlug', paymentOptionSlug)
      window.localStorage.setItem('ufo:checkout:deliveryMethod', deliveryMethod)
    } catch {
      // ignore storage access
    }
  }, [paymentOptionSlug, deliveryMethod])
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null
    if (!vv) return
    let raf = 0
    const onResize = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const keyboardLikelyOpen = (window.innerHeight - vv.height) > 120
        setIsKeyboardOpen((prev) => (prev === keyboardLikelyOpen ? prev : keyboardLikelyOpen))
      })
    }
    onResize()
    vv.addEventListener('resize', onResize)
    vv.addEventListener('scroll', onResize)
    return () => {
      if (raf) cancelAnimationFrame(raf)
      vv.removeEventListener('resize', onResize)
      vv.removeEventListener('scroll', onResize)
    }
  }, [])
  useEffect(() => {
    const shouldLock = isAddressSheetOpen || isPaymentSheetOpen || isPromoSheetOpen
    const prev = document.body.style.overflow
    if (shouldLock) document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [isAddressSheetOpen, isPaymentSheetOpen, isPromoSheetOpen])

  useEffect(() => {
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setIsAddressSheetOpen(false)
      setIsPaymentSheetOpen(false)
      setIsPromoSheetOpen(false)
    }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [])
  useEffect(() => {
    const onPopState = () => {
      // Не оставляем модальные слои открытыми при back-жесте в Telegram WebView.
      setIsAddressSheetOpen(false)
      setIsPaymentSheetOpen(false)
      setIsPromoSheetOpen(false)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])
  useEffect(() => {
    let cancelled = false
    async function loadRestaurantInfo() {
      try {
        const res = await fetch('/api/restaurant', {
          cache: 'no-store',
          credentials: 'include',
          headers: { ...restaurantContextHeaders },
        })
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.ok || cancelled) return
        setRestaurantInfo({
          name: String(data?.restaurant?.name || ''),
          address: String(data?.restaurant?.address || ''),
        })
      } catch {
        // ignore transient errors
      }
    }
    loadRestaurantInfo()
    return () => {
      cancelled = true
    }
  }, [restaurantContextHeaders])

  useEffect(() => {
    if (appSettings.activeDeliveryZonesCount !== 0) return
    setDeliveryMethod((m) => (m === 'DELIVERY' ? 'PICKUP' : m))
  }, [appSettings.activeDeliveryZonesCount])

  useEffect(() => {
    if (isAddressSheetOpen) setAddressSheetNoDeliveryExplainer(false)
  }, [isAddressSheetOpen])

  const subtotal = getTotal()
  const outOfZone =
    deliveryMethod === 'DELIVERY' && Boolean(formData.address.trim()) && deliveryQuote?.matched === false
  const zoneFee = deliveryQuote?.zone?.deliveryFee
  const zoneFreeFrom = deliveryQuote?.zone?.minOrderAmount
  const zoneFreeReached =
    typeof zoneFreeFrom === 'number' && Number.isFinite(zoneFreeFrom)
      ? subtotal >= zoneFreeFrom
      : false
  const deliveryQuoteRejected =
    deliveryMethod === 'DELIVERY' && deliveryQuote != null && deliveryQuote.matched === false
  const deliveryFee = deliveryMethod === 'PICKUP'
    ? 0
    : deliveryQuoteRejected
      ? 0
      : typeof zoneFee === 'number'
        ? (zoneFreeReached ? 0 : zoneFee)
        : subtotal >= appSettings.freeDeliveryFrom
          ? 0
          : appSettings.deliveryFee
  const totalBeforePromo = subtotal + deliveryFee
  const total = promoState.ok && typeof promoState.totalAfter === 'number' ? promoState.totalAfter : totalBeforePromo
  const deliveryEtaMin = deliveryQuote?.matched && deliveryQuote?.zone?.deliveryWindowMin
    ? Number(deliveryQuote.zone.deliveryWindowMin)
    : null

  const mapHref = useMemo(() => {
    const lat = String(formData.lat || '').trim()
    const lng = String(formData.lng || '').trim()
    if (lat && lng) return `https://maps.google.com/?q=${encodeURIComponent(`${lat},${lng}`)}`
    const q = String(formData.address || '').trim()
    if (!q) return ''
    return `https://maps.google.com/?q=${encodeURIComponent(`${q}, ${formData.city || ''}`.trim())}`
  }, [formData.address, formData.city, formData.lat, formData.lng])

  const mapPreviewCoords = useMemo(() => {
    const lat = Number(String(formData.lat || '').trim())
    const lng = Number(String(formData.lng || '').trim())
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
    return { lat, lng }
  }, [formData.lat, formData.lng])

  /** OSM embed (same-origin not required) — staticmap.openstreetmap.de часто падает в WebView Telegram. */
  const osmEmbedSrc = useMemo(() => {
    if (!mapPreviewCoords) return null
    const { lat, lng } = mapPreviewCoords
    const pad = 0.012
    const bbox = `${lng - pad},${lat - pad},${lng + pad},${lat + pad}`
    return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${lat}%2C${lng}`
  }, [mapPreviewCoords])

  const restaurantMapHref = useMemo(() => {
    const a = String(restaurantInfo.address || '').trim()
    if (!a) return ''
    const label = [restaurantInfo.name, a].filter(Boolean).join(', ')
    return `https://maps.google.com/?q=${encodeURIComponent(label)}`
  }, [restaurantInfo.address, restaurantInfo.name])

  const openMapExternal = (url: string) => {
    if (!url) return
    try {
      const tg = (typeof window !== 'undefined' ? (window as unknown as { Telegram?: { WebApp?: { openLink?: (u: string) => void } } }) : null)
        ?.Telegram?.WebApp
      if (typeof tg?.openLink === 'function') {
        tg.openLink(url)
        return
      }
    } catch {
      // ignore
    }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const getModifierLabels = (item: any): string[] => {
    const direct = Array.isArray(item?.modifierLabels)
      ? item.modifierLabels.map((v: unknown) => String(v || '').trim()).filter(Boolean)
      : []
    if (direct.length > 0) return direct
    const ids = Array.isArray(item?.modifierIds)
      ? item.modifierIds.map((v: unknown) => String(v || '').trim()).filter(Boolean)
      : []
    if (!ids.length) return []
    return ids.map((id: string) => modifierLabelById[id]).filter(Boolean)
  }
  useEffect(() => {
    const needsFallback = items.some(
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

  useEffect(() => {
    const addr = formData.address.trim()
    if (deliveryMethod !== 'DELIVERY' || !addr) {
      setDeliveryQuote(null)
      return
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const q = new URLSearchParams({
          address: formData.address,
          city: formData.city,
          zipCode: formData.zipCode,
          subtotal: String(subtotal),
          lat: formData.lat,
          lng: formData.lng,
        })
        const res = await fetch(`/api/delivery/quote?${q.toString()}`, {
          cache: 'no-store',
          credentials: 'include',
          headers: { ...telegramInitHeaderRecord(), ...restaurantContextHeaders } as HeadersInit,
        })
        const data = await res.json().catch(() => null)
        if (!cancelled && data?.ok) setDeliveryQuote(data)
      } catch {
        if (!cancelled) setDeliveryQuote(null)
      }
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [
    deliveryMethod,
    formData.address,
    formData.city,
    formData.zipCode,
    formData.lat,
    formData.lng,
    subtotal,
    restaurantContextHeaders,
  ])

  useEffect(() => {
    let cancelled = false
    async function loadPromos() {
      setPromoLoading(true)
      try {
        const res = await fetch('/api/campaigns/available', {
          cache: 'no-store',
          credentials: 'include',
          headers: {
            ...telegramInitHeaderRecord(),
            ...restaurantContextHeaders,
          } as HeadersInit,
        })
        const data = await res.json().catch(() => null)
        if (cancelled) return
        if (!res.ok || !data?.ok || !Array.isArray(data?.campaigns)) {
          setAvailablePromos([])
          return
        }
        setAvailablePromos(
          data.campaigns.map((x: any) => ({
            id: String(x?.id || ''),
            name: String(x?.name || 'акция'),
            code: typeof x?.code === 'string' ? x.code : null,
            rewardType: typeof x?.rewardType === 'string' ? x.rewardType : null,
            rewardValue: Number(x?.rewardValue ?? 0),
            giftTitle: typeof x?.giftTitle === 'string' ? x.giftTitle : null,
            validTo: typeof x?.validTo === 'string' ? x.validTo : null,
          }))
            .filter((x: any) => x.id)
        )
      } catch {
        if (!cancelled) setAvailablePromos([])
      } finally {
        if (!cancelled) setPromoLoading(false)
      }
    }
    loadPromos()
    return () => {
      cancelled = true
    }
  }, [restaurantContextHeaders])

  useEffect(() => {
    try {
      const fromUrl = new URLSearchParams(window.location.search).get('promo')
      const fromStorage = String(window.localStorage.getItem('ufo:checkout:promo') || '')
      const initial = String(fromUrl || fromStorage || '').trim().toUpperCase()
      if (initial) setPromoCode(initial)
      if (fromStorage) window.localStorage.removeItem('ufo:checkout:promo')
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    const code = String(promoCode || '').trim().toUpperCase()
    const cid = String(promoCampaignId || '').trim()
    if (!code && !cid) {
      setPromoState({ validating: false, ok: false, discountAmount: 0 })
      return
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      setPromoState((p) => ({ ...p, validating: true }))
      try {
        const res = await fetch('/api/campaigns/validate', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'content-type': 'application/json',
            ...telegramInitHeaderRecord(),
            ...restaurantContextHeaders,
          } as HeadersInit,
          body: JSON.stringify({
            ...(code ? { code } : {}),
            ...(cid ? { campaignId: cid } : {}),
            subtotal,
            deliveryFee,
            items: items.map((it: any) => ({
              quantity: Number(it?.quantity ?? 1),
              unitPrice: Number(it?.dish?.price ?? it?.price ?? 0),
              dishId: String(it?.dishId || it?.dish?.id || '').trim() || null,
              storeVariantId: String(it?.storeVariantId || '').trim() || null,
              categoryId: String(it?.dish?.categoryId || '').trim() || null,
              kind: String(it?.kind || (it?.storeVariantId ? 'store' : 'dish')),
            })),
          }),
        })
        const data = await res.json().catch(() => null)
        if (cancelled) return
        if (!res.ok || !data?.ok) {
          setPromoState({
            validating: false,
            ok: false,
            reason: String(data?.reason || data?.error || 'promo_invalid'),
            discountAmount: 0,
          })
          return
        }
        const disc = Number(data?.discountAmount ?? 0)
        const giftTitle = typeof data?.gift?.title === 'string' ? data.gift.title : undefined
        const giftDishId = typeof data?.giftDishId === 'string' ? data.giftDishId : undefined
        const applied = Boolean(data?.campaign) && (disc > 0 || Boolean(giftTitle || giftDishId))
        setPromoState({
          validating: false,
          ok: applied,
          discountAmount: disc,
          totalAfter: Number(data?.totalAfter ?? subtotal + deliveryFee),
          giftTitle,
          giftDishId,
          reason: applied ? undefined : String(data?.reason || 'not_applicable'),
        })
      } catch {
        if (!cancelled) setPromoState({ validating: false, ok: false, reason: 'promo_check_failed', discountAmount: 0 })
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [promoCode, promoCampaignId, subtotal, deliveryFee, items, restaurantContextHeaders])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (deliveryMethod === 'DELIVERY' && deliveryQuote && !deliveryQuote.matched) {
      toast.error(deliveryQuote.message || 'Адрес вне зоны доставки')
      setIsSubmitting(false)
      return
    }
    setIsSubmitting(true)

    const cartRid = String(cartRestaurantId || '').trim()
    const venueRid = String(venueRestaurantId || '').trim()
    if (
      items.length > 0 &&
      cartRid &&
      venueRid &&
      cartRid !== 'default' &&
      venueRid !== 'default' &&
      cartRid !== venueRid
    ) {
      toast.error('Корзина от другого заведения. Очистите корзину и добавьте товары заново.')
      setIsSubmitting(false)
      return
    }

    // Валидация (делаем сами, без HTML required — в Telegram/iOS иногда не показывает подсказку и выглядит как “не нажимается”)
    if (!formData.name || !formData.phone || (deliveryMethod === 'DELIVERY' && !formData.address)) {
      toast.error('Заполните все обязательные поля')
      setIsSubmitting(false)
      return
    }

    // Создаем заказ
    const safeNumber = (v: unknown): number => {
      const n = typeof v === 'number' ? v : Number(v)
      return Number.isFinite(n) ? n : 0
    }

    const lineItems = items
      .map((it: any) => {
        const dishId = String(it?.dishId || it?.dish?.id || '').trim()
        const quantity = Math.max(1, safeNumber(it?.quantity ?? 1))
        const price = safeNumber(it?.dish?.price ?? it?.price ?? 0)
        const name = String(it?.dish?.name ?? it?.name ?? 'товар')
        const description = typeof it?.description === 'string' ? it.description : undefined
        const image = typeof it?.imageUrl === 'string' ? it.imageUrl : typeof it?.image === 'string' ? it.image : undefined
        const storeVariantId = String(it?.storeVariantId || '').trim()
        const kind = String(it?.kind || (storeVariantId ? 'store' : 'dish'))
        const modifierIds = Array.isArray(it?.modifierIds) ? it.modifierIds : []
        const modifierLabels = getModifierLabels(it)
        return { kind, dishId, storeVariantId, quantity, price, name, description, image, modifierIds, modifierLabels }
      })
      .filter((it) => (it.kind === 'store' ? it.storeVariantId : it.dishId) && it.quantity > 0 && it.price >= 0)

    if (!lineItems.length) {
      toast.error('корзина пуста')
      setIsSubmitting(false)
      return
    }

    let serverOrderId: string | undefined
    let paymentIntentId: string | null = null

    if (paymentOptionSlug === 'STRIPE') {
      try {
        const intentRes = await fetch('/api/payment/intent', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'content-type': 'application/json',
            ...telegramInitHeaderRecord(),
            ...restaurantContextHeaders,
          } as HeadersInit,
          body: JSON.stringify({
            items: lineItems.map((i) => ({
              kind: i.kind,
              dishId: i.dishId,
              storeVariantId: i.storeVariantId,
              quantity: i.quantity,
              modifierIds: i.modifierIds,
            })),
            deliveryFee,
          }),
        })
        const intentData = await intentRes.json().catch(() => null)
        if (!intentRes.ok || !intentData?.ok || !intentData?.paymentIntentId) {
          toast.error(intentData?.error || 'Не удалось инициализировать онлайн-оплату')
          setIsSubmitting(false)
          return
        }
        paymentIntentId = String(intentData.paymentIntentId)
      } catch {
        toast.error('Ошибка инициализации онлайн-оплаты')
        setIsSubmitting(false)
        return
      }
    }

    // server-side create + telegram notification (MVP)
    try {
      const clientRequestId =
        submitRequestIdRef.current ??
        (submitRequestIdRef.current =
          (globalThis as any)?.crypto?.randomUUID?.() ? (globalThis as any).crypto.randomUUID() : String(Date.now()))
      const res = await fetch('/api/orders', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'content-type': 'application/json',
          ...telegramInitHeaderRecord(),
          ...restaurantContextHeaders,
        } as HeadersInit,
        body: JSON.stringify({
          clientRequestId,
          totalAmount: total,
          deliveryFee,
          promoCode: promoState.ok && String(promoCode || '').trim() ? String(promoCode || '').trim().toUpperCase() : undefined,
          campaignId: promoState.ok && promoCampaignId ? promoCampaignId : undefined,
          paymentOptionSlug,
          paymentIntentId: paymentIntentId || undefined,
          fulfillment: deliveryMethod,
          deliveryTime: formData.deliveryTime ? new Date(Date.now() + parseInt(formData.deliveryTime) * 60 * 1000).toISOString() : undefined,
          address: {
            street: deliveryMethod === 'PICKUP'
              ? String(restaurantInfo.address || formData.address || 'самовывоз')
              : formData.address,
            city: formData.city,
            zipCode: formData.zipCode || '',
            country: 'Thailand',
          },
          notes: [deliveryMethod === 'PICKUP' ? 'Самовывоз' : '', formData.notes || ''].filter(Boolean).join(' · ') || undefined,
          items: lineItems.map((i) => ({
            kind: i.kind,
            dishId: i.dishId,
            storeVariantId: i.storeVariantId,
            name: i.name,
            quantity: i.quantity,
            price: i.price,
            modifierIds: Array.isArray(i.modifierIds) ? i.modifierIds : [],
            modifierLabels: Array.isArray(i.modifierLabels) ? i.modifierLabels : [],
          })),
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        toast.error(data?.error || 'не удалось создать заказ')
        setIsSubmitting(false)
        return
      }
      serverOrderId = typeof data?.orderId === 'string' ? data.orderId : undefined
    } catch {
      toast.error('не удалось отправить заказ на сервер')
      setIsSubmitting(false)
      return
    }

    try {
      const res = await fetch('/api/orders', {
        cache: 'no-store',
        credentials: 'include',
        headers: { ...telegramInitHeaderRecord(), ...restaurantContextHeaders } as HeadersInit,
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.ok && Array.isArray(data.orders)) {
        const normalized = data.orders.map((o: any) => ({
          ...o,
          createdAt: o?.createdAt ? new Date(o.createdAt) : new Date(),
          deliveryTime: o?.deliveryTime ? new Date(o.deliveryTime) : undefined,
          totalAmount: Number(o?.totalAmount ?? 0),
          items: Array.isArray(o?.items) ? o.items : [],
        }))
        setOrders(normalized as any)
      }
    } catch {
      // ignore, fallback to server load on orders screen
    }

    toast.success(
      paymentOptionSlug === 'STRIPE'
        ? 'Заказ создан, ожидаем подтверждение оплаты'
        : isQrSlug(paymentOptionSlug)
          ? 'Заказ создан — загрузите чек оплаты'
          : 'Заказ успешно оформлен!'
    )
    const priorProfile = loadDeliveryProfile()
    if (deliveryMethod === 'PICKUP' && priorProfile?.address?.trim()) {
      saveDeliveryProfile({
        name: formData.name.trim() || priorProfile.name,
        phone: formData.phone.trim() || priorProfile.phone,
        address: priorProfile.address,
        apartment: priorProfile.apartment,
        city: priorProfile.city || 'Пхукет',
        zipCode: priorProfile.zipCode,
        lat: priorProfile.lat,
        lng: priorProfile.lng,
      })
    } else {
      saveDeliveryProfile({
        name: formData.name,
        phone: formData.phone,
        address: formData.address,
        apartment: formData.apartment,
        city: formData.city,
        zipCode: formData.zipCode,
        lat: formData.lat,
        lng: formData.lng,
      })
    }
    clearCart()
    if (serverOrderId && isQrSlug(paymentOptionSlug)) {
      router.push(`/orders/${serverOrderId}/pay`)
    } else {
      router.push('/orders')
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  if (items.length === 0) {
    return (
      <main className="ui-container ui-screen">
        <PageHeader backHref="/cart" title="оформление" subtitle="сначала добавьте блюда" />

        <div className="ui-surface-card p-6 text-center">
          <div className="ui-h2">корзина пуста</div>
          <div className="ui-muted mt-1">добавьте блюда из меню — и возвращайтесь сюда</div>
          <Link
            href="/menu"
            prefetch={false}
            className="btn btn-primary mt-4 inline-flex h-11 w-full text-[14px]"
            style={{ borderRadius: 'var(--radius-pill)' }}
          >
            в меню
          </Link>
        </div>
      </main>
    )
  }

  const baseFieldsFilled = Boolean(
    formData.name.trim() &&
    formData.phone.trim() &&
    (deliveryMethod === 'PICKUP' || formData.address.trim())
  )
  const canSubmit = baseFieldsFilled && !outOfZone && !isSubmitting
  const selectedPay = appSettings.paymentOptions.find((p) => p.slug === paymentOptionSlug)
  const paymentLabel = selectedPay?.title || paymentOptionSlug
  const rubPreview =
    paymentOptionSlug === 'QR_RUB' && selectedPay?.rubPerThb && Number.isFinite(Number(selectedPay.rubPerThb))
      ? computeRubTotal(total, Number(selectedPay.rubPerThb))
      : null
  const deliveryLabel =
    deliveryMethod === 'PICKUP'
      ? `${restaurantInfo.name ? `самовывоз · ${restaurantInfo.name}` : 'самовывоз'}${restaurantInfo.address ? `\n${restaurantInfo.address}` : ''}`.trim()
      : formData.address
        ? `${formData.address}${formData.city ? `, ${formData.city}` : ''}`
        : 'выбрать адрес'
  const submitCta =
    outOfZone
      ? 'выбрать самовывоз'
      : rubPreview != null
        ? `оформить · ${formatPrice(total)} (~${rubPreview.toFixed(0)} ₽)`
        : `оформить · ${formatPrice(total)}`
  const selectedPromo = availablePromos.find(
    (x) =>
      (Boolean(promoCampaignId) && x.id === promoCampaignId) ||
      (Boolean(String(promoCode || '').trim()) &&
        String(x.code || '').toUpperCase() === String(promoCode || '').trim().toUpperCase())
  )

  const checkoutSheetPanel =
    'absolute inset-x-0 bottom-0 flex h-[48dvh] min-h-[280px] max-h-[540px] flex-col rounded-t-[var(--radius-large)] border border-[color:var(--stroke)] border-b-0 bg-[color:var(--surface-strong)] shadow-[0_-12px_40px_rgba(15,23,42,0.1)]'
  /** Компактный шит доставки: без принудительной высоты и без скролла по умолчанию. */
  const addressSheetPanelClass =
    'absolute inset-x-0 bottom-0 flex max-h-[min(88dvh,680px)] flex-col rounded-t-[var(--radius-large)] border border-[color:var(--stroke)] border-b-0 bg-[color:var(--surface-strong)] shadow-[0_-12px_40px_rgba(15,23,42,0.1)]'

  return (
    <main className="ui-container ui-screen pb-[var(--ufo-scroll-pad-floating,calc(5.75rem+12px))]">
      <PageHeader backHref="/cart" title="оформление" subtitle="проверьте данные заказа" />
      <form id="checkout-form" onSubmit={handleSubmit} noValidate className="border-t border-[color:var(--stroke)]">
        <section className="border-b border-[color:var(--stroke)] py-3">
          <h3 className="mb-2 text-[12px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">контакт</h3>
          <div className="flex items-center justify-between border-b border-[color:var(--stroke)] py-2.5">
            <span className="ui-muted shrink-0">имя</span>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="как к вам обращаться"
              className="ui-body ml-3 w-[65%] border-none bg-transparent p-0 text-right outline-none placeholder:text-[color:var(--muted)]"
            />
          </div>
          <div className="flex items-center justify-between py-2.5">
            <span className="ui-muted shrink-0">телефон</span>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="+66 …"
              className="ui-body ml-3 w-[65%] border-none bg-transparent p-0 text-right outline-none placeholder:text-[color:var(--muted)]"
            />
          </div>
        </section>

        <section className="border-b border-[color:var(--stroke)] py-3">
          <h3 className="mb-2 text-[12px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">доставка</h3>
          <button
            type="button"
            onClick={() => setIsAddressSheetOpen(true)}
            className="flex w-full items-start justify-between gap-3 border-b border-[color:var(--stroke)] py-2.5 text-left active:opacity-80"
          >
            <span className="ui-muted shrink-0 pt-0.5">адрес</span>
            <span className="ui-body min-w-0 flex-1 whitespace-pre-line text-right text-[14px] leading-snug">{deliveryLabel}</span>
          </button>
          {deliveryEtaMin && deliveryMethod === 'DELIVERY' ? (
            <div className="ui-muted pt-2">доставка ~ {deliveryEtaMin} мин</div>
          ) : null}
          {deliveryMethod === 'DELIVERY' ? (
            <div className="mt-2 rounded-xl border border-[color:var(--stroke)] bg-[color:var(--surface)] p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wide text-[color:var(--muted)]">стоимость доставки</span>
                <span
                  className={`text-[14px] font-extrabold ${
                    outOfZone ? 'text-[color:var(--muted)]' : deliveryFee > 0 ? 'text-[color:var(--text)]' : 'text-emerald-700'
                  }`}
                >
                  {outOfZone ? 'недоступна' : deliveryFee > 0 ? formatPrice(deliveryFee) : 'бесплатно'}
                </span>
              </div>
              {typeof zoneFreeFrom === 'number' && Number.isFinite(zoneFreeFrom) && zoneFreeFrom > 0 ? (
                <div className="mt-1 text-[12px] text-[color:var(--muted)]">
                  {zoneFreeReached
                    ? `порог ${formatPrice(zoneFreeFrom)} достигнут`
                    : `бесплатно от ${formatPrice(zoneFreeFrom)}`}
                </div>
              ) : null}
            </div>
          ) : null}
          {outOfZone ? (
            <div className="ui-muted pt-2 text-[12px] font-semibold text-[#C62828]">
              {deliveryQuote?.message ||
                'адрес вне зоны доставки — выберите самовывоз или измените адрес'}
            </div>
          ) : null}
          {deliveryMethod === 'DELIVERY' && osmEmbedSrc && mapHref ? (
            <button
              type="button"
              onClick={() => openMapExternal(mapHref)}
              className="relative mt-2 w-full overflow-hidden rounded-xl border border-[color:var(--stroke)] bg-[color:var(--surface)] text-left shadow-[var(--shadow-soft)] active:opacity-90"
            >
              <div className="flex h-[5rem] items-center justify-between px-3">
                <div>
                  <div className="text-[12px] font-extrabold text-[color:var(--text)]">проверить маршрут</div>
                  <div className="text-[11px] text-[color:var(--muted)]">открыть адрес в картах</div>
                </div>
                <span className="rounded-full bg-[color:var(--surface-strong)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--text)]">карты</span>
              </div>
            </button>
          ) : null}
        </section>

        <section className="border-b border-[color:var(--stroke)] py-3">
          <h3 className="mb-2 text-[12px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">заказ</h3>
          <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {items.map((item: any, idx: number) => {
              const title = String(item?.dish?.name ?? item?.name ?? 'товар')
              const qty = Math.max(1, Number(item?.quantity ?? 1))
              const img =
                typeof item?.imageUrl === 'string'
                  ? item.imageUrl
                  : typeof item?.image === 'string'
                    ? item.image
                    : typeof item?.dish?.image === 'string'
                      ? item.dish.image
                      : ''
              const key = String(item?.id ?? `${title}-${idx}`)
              return (
                <div
                  key={key}
                  className="relative aspect-square w-[92px] shrink-0 overflow-hidden rounded-[var(--radius-medium)] border border-[color:var(--stroke)] bg-[color:var(--surface)] shadow-[var(--shadow-soft)]"
                >
                  {img ? (
                    <OptimizedImage src={img} alt="" sizes={IMAGE_SIZES.cartRow} className="object-cover" quality={72} />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-[color:var(--muted)]">нет фото</div>
                  )}
                  {qty > 1 ? (
                    <span className="absolute bottom-1.5 right-1.5 rounded-full bg-[color:var(--text)] px-1.5 py-0.5 text-[10px] font-bold text-[color:var(--surface-strong)]">
                      ×{qty}
                    </span>
                  ) : null}
                </div>
              )
            })}
          </div>
        </section>

        <section className="border-b border-[color:var(--stroke)] py-3">
          <h3 className="mb-2 text-[12px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">промокод</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPromoSheetOpen(true)}
              className="btn btn-soft h-10 flex-1 text-[13px] font-semibold"
              style={{ borderRadius: 'var(--radius-pill)' }}
            >
              {selectedPromo ? `акция: ${selectedPromo.name}` : 'выбрать из моих промокодов'}
            </button>
            {promoCode.trim() || promoCampaignId ? (
              <button
                type="button"
                onClick={() => {
                  setPromoCode('')
                  setPromoCampaignId('')
                }}
                className="btn btn-soft h-10 px-3 text-[12px] font-semibold"
                style={{ borderRadius: 'var(--radius-pill)' }}
              >
                убрать
              </button>
            ) : null}
          </div>
          {promoCode.trim() || promoCampaignId ? (
            promoState.ok ? (
              <div className="ui-muted mt-2 text-[12px] text-emerald-700">
                {promoState.discountAmount > 0 ? <span>скидка: -{formatPrice(promoState.discountAmount)}</span> : null}
                {promoState.discountAmount > 0 && (promoState.giftTitle || promoState.giftDishId) ? <span> · </span> : null}
                {promoState.giftTitle || promoState.giftDishId ? (
                  <span>
                    подарок к заказу: {promoState.giftTitle || 'позиция из меню'}
                    {promoState.giftDishId ? ' (добавим в заказ при оформлении)' : ''}
                  </span>
                ) : null}
              </div>
            ) : (
              <div className="ui-muted mt-2 text-[12px] text-amber-700">
                {promoState.validating ? 'проверяем акцию...' : 'акция не применена'}
              </div>
            )
          ) : null}
          <div className="mt-2 flex items-center gap-2 text-[12px]">
            {promoState.ok ? (
              <>
                <span className="text-[color:var(--muted)] line-through">{formatPrice(totalBeforePromo)}</span>
                <span className="font-extrabold text-[color:var(--text)]">{formatPrice(total)}</span>
              </>
            ) : (
              <span className="text-[color:var(--muted)]">{formatPrice(totalBeforePromo)}</span>
            )}
          </div>
        </section>

        <section className="border-b border-[color:var(--stroke)] py-3">
          <h3 className="mb-2 text-[12px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">оплата</h3>
          <button
            type="button"
            onClick={() => setIsPaymentSheetOpen(true)}
            className="flex w-full items-center justify-between border-b border-[color:var(--stroke)] py-2.5 text-left active:opacity-80"
          >
            <span className="ui-muted shrink-0">способ</span>
            <span className="ui-body text-right">{paymentLabel}</span>
          </button>
          <div className="flex items-center justify-between py-2.5">
            <span className="ui-muted shrink-0">комментарий</span>
            <input
              type="text"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="необязательно"
              className="ui-body ml-3 w-[65%] border-none bg-transparent p-0 text-right outline-none placeholder:text-[color:var(--muted)]"
            />
          </div>
        </section>
      </form>

      {isAddressSheetOpen ? (
        <div className="fixed inset-0 z-[260] bg-black/35">
          <button type="button" className="h-full w-full" onClick={() => setIsAddressSheetOpen(false)} aria-label="close address sheet" />
          <div className={addressSheetPanelClass}>
            <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-[color:var(--stroke-strong)]" />
            <div className="shrink-0 px-4 pb-1 pt-2">
              <div className="text-[11px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">доставка</div>
              <div className="mt-0.5 text-[17px] font-bold leading-tight tracking-tight text-[color:var(--text)]">как получите заказ</div>
            </div>
            <div className="max-h-[min(52dvh,380px)] overflow-y-auto overscroll-contain px-4 pb-2 pt-0 [scrollbar-gutter:stable]">
              {addressSheetNoDeliveryExplainer && appSettings.activeDeliveryZonesCount === 0 ? (
                <div className="flex flex-col gap-4 py-1">
                  <button
                    type="button"
                    onClick={() => setAddressSheetNoDeliveryExplainer(false)}
                    className="self-start text-[12px] font-semibold text-[color:var(--accent)] active:opacity-80"
                  >
                    ← назад
                  </button>
                  <div className="rounded-[var(--radius-large)] border border-[color:var(--stroke)] bg-[color:var(--surface)] px-4 py-5 shadow-[var(--shadow-soft)]">
                    <p className="text-[18px] font-extrabold leading-tight tracking-tight text-[color:var(--text)]">
                      Доставку в ваш район мы ещё подключаем
                    </p>
                    <p className="mt-3 text-[14px] font-medium leading-relaxed text-[color:var(--muted)]">
                      Сейчас можно оформить только <span className="font-semibold text-[color:var(--text)]">самовывоз</span> — это уже работает.
                    </p>
                    <p className="mt-3 text-[14px] font-medium leading-relaxed text-[color:var(--muted)]">
                      Как только зоны появятся в настройках заведения, доставка включится сама. Напишем вам <span className="font-semibold text-[color:var(--text)]">здесь в боте</span> — чат лучше не удалять, чтобы ничего не пропустить.
                    </p>
                  </div>
                </div>
              ) : (
                <>
              <div className="flex rounded-[11px] bg-[color:var(--surface)] p-0.5 ring-1 ring-[color:var(--stroke)]">
                <button
                  type="button"
                  onClick={() => {
                    if (appSettings.activeDeliveryZonesCount === 0) {
                      try {
                        ;(window as unknown as { Telegram?: { WebApp?: { HapticFeedback?: { impactOccurred?: (s: string) => void } } } })
                          ?.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.('light')
                      } catch {
                        // ignore
                      }
                      setAddressSheetNoDeliveryExplainer(true)
                      return
                    }
                    setDeliveryMethod('DELIVERY')
                  }}
                  className={
                    deliveryMethod === 'DELIVERY'
                      ? 'h-9 flex-1 rounded-[9px] bg-[color:var(--text)] text-[13px] font-semibold text-[color:var(--surface-strong)] shadow-sm'
                      : 'h-9 flex-1 rounded-[9px] text-[13px] font-semibold text-[color:var(--text)] active:opacity-80'
                  }
                >
                  доставка
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddressSheetNoDeliveryExplainer(false)
                    setDeliveryMethod('PICKUP')
                  }}
                  className={
                    deliveryMethod === 'PICKUP'
                      ? 'h-9 flex-1 rounded-[9px] bg-[color:var(--text)] text-[13px] font-semibold text-[color:var(--surface-strong)] shadow-sm'
                      : 'h-9 flex-1 rounded-[9px] text-[13px] font-semibold text-[color:var(--text)]'
                  }
                >
                  самовывоз
                </button>
              </div>
              {deliveryMethod === 'DELIVERY' && osmEmbedSrc && mapHref ? (
                <button
                  type="button"
                  onClick={() => openMapExternal(mapHref)}
                  className="relative mt-2 w-full overflow-hidden rounded-xl border border-[color:var(--stroke)] bg-[color:var(--surface)] text-left shadow-[var(--shadow-soft)] active:opacity-90"
                >
                  <div className="flex h-[4.75rem] items-center justify-between px-3">
                    <div>
                      <div className="text-[12px] font-extrabold text-[color:var(--text)]">проверить точку доставки</div>
                      <div className="text-[11px] text-[color:var(--muted)]">открыть в картах</div>
                    </div>
                    <span className="rounded-full bg-[color:var(--surface-strong)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--text)]">карты</span>
                  </div>
                </button>
              ) : null}
              {deliveryMethod === 'DELIVERY' ? (
                <div className="mt-2 space-y-2">
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">улица, дом</span>
                    <input
                      type="text"
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      placeholder="адрес доставки"
                      className="input mt-1 h-10 w-full text-[14px] leading-tight"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">город</span>
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      placeholder="город"
                      className="input mt-1 h-10 w-full text-[14px] leading-tight"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (!navigator.geolocation) {
                        toast.error('Геопозиция недоступна')
                        return
                      }
                      navigator.geolocation.getCurrentPosition(
                        async (pos) => {
                          const lat = String(pos.coords.latitude)
                          const lng = String(pos.coords.longitude)
                          setFormData((p) => ({ ...p, lat, lng }))
                          try {
                            const q = new URLSearchParams({ lat, lng })
                            const res = await fetch(`/api/geocode/reverse?${q.toString()}`, { cache: 'no-store' })
                            const data = await res.json().catch(() => null)
                            if (res.ok && data?.ok) {
                              setFormData((p) => ({
                                ...p,
                                lat,
                                lng,
                                address: String(data.address || p.address || ''),
                                city: String(data.city || p.city || 'Пхукет'),
                              }))
                            }
                          } catch {
                            // ignore
                          }
                          toast.success('Геопозиция добавлена')
                        },
                        () => toast.error('Не удалось получить геопозицию'),
                        { enableHighAccuracy: true, timeout: 8000 }
                      )
                    }}
                    className="btn btn-soft h-9 w-full text-[13px] font-semibold"
                    style={{ borderRadius: 'var(--radius-pill)' }}
                  >
                    по геолокации
                  </button>
                </div>
              ) : (
                <div className="mt-2 rounded-xl border border-[color:var(--stroke)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-soft)]">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">самовывоз</div>
                  <div className="mt-1 text-[15px] font-bold leading-snug text-[color:var(--text)]">{restaurantInfo.name || 'заведение'}</div>
                  <p className="mt-1 text-[13px] leading-snug text-[color:var(--text)]">
                    {restaurantInfo.address || 'адрес заведения не указан в настройках'}
                  </p>
                  {restaurantMapHref ? (
                    <button
                      type="button"
                      onClick={() => openMapExternal(restaurantMapHref)}
                      className="btn btn-soft mt-2 h-9 w-full text-[13px] font-semibold"
                      style={{ borderRadius: 'var(--radius-pill)' }}
                    >
                      открыть адрес в картах
                    </button>
                  ) : null}
                </div>
              )}
                </>
              )}
            </div>
            <div className="shrink-0 border-t border-[color:var(--stroke)] p-4 pb-[calc(env(safe-area-inset-bottom)+12px)]">
              <button
                type="button"
                onClick={() => {
                  if (addressSheetNoDeliveryExplainer && appSettings.activeDeliveryZonesCount === 0) {
                    setAddressSheetNoDeliveryExplainer(false)
                    setDeliveryMethod('PICKUP')
                    setIsAddressSheetOpen(false)
                    return
                  }
                  setIsAddressSheetOpen(false)
                }}
                className="btn btn-primary h-11 w-full rounded-full text-[15px] font-semibold"
                style={{ borderRadius: 'var(--radius-pill)' }}
              >
                {addressSheetNoDeliveryExplainer && appSettings.activeDeliveryZonesCount === 0
                  ? 'к самовывозу'
                  : 'готово'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isPaymentSheetOpen ? (
        <div className="fixed inset-0 z-[260] bg-black/35">
          <button type="button" className="h-full w-full" onClick={() => setIsPaymentSheetOpen(false)} aria-label="close payment sheet" />
          <div className={checkoutSheetPanel}>
            <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-[color:var(--stroke-strong)]" />
            <div className="shrink-0 px-4 pb-2 pt-1">
              <div className="text-[12px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">оплата</div>
              <div className="ui-h2 mt-2 text-[color:var(--text)]">способ оплаты</div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4">
              <div className="flex flex-col gap-2 pt-1">
                {appSettings.paymentOptions.map((opt) => (
                  <button
                    key={opt.slug}
                    type="button"
                    onClick={() => setPaymentOptionSlug(opt.slug)}
                    className="flex min-h-[3rem] w-full items-center justify-between rounded-[var(--radius-medium)] border border-[color:var(--stroke)] bg-[color:var(--surface)] px-3 py-2 text-left active:opacity-90"
                  >
                    <span className="ui-body leading-snug">{opt.title}</span>
                    {paymentOptionSlug === opt.slug ? <span className="shrink-0 text-[15px] text-[color:var(--text)]">✓</span> : null}
                  </button>
                ))}
              </div>
              {paymentOptionSlug === 'QR_RUB' && selectedPay?.rubPerThb ? (
                <p className="ui-muted mt-2 text-[11px] leading-snug">
                  итог в ₽ — ориентир по курсу {Number(selectedPay.rubPerThb).toFixed(2)} ₽ за 1 ฿
                </p>
              ) : null}
            </div>
            <div className="shrink-0 border-t border-[color:var(--stroke)] p-4 pb-[calc(env(safe-area-inset-bottom)+12px)]">
              <button
                type="button"
                onClick={() => setIsPaymentSheetOpen(false)}
                className="btn btn-primary h-11 w-full rounded-full text-[15px] font-semibold"
                style={{ borderRadius: 'var(--radius-pill)' }}
              >
                готово
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {isPromoSheetOpen ? (
        <div className="fixed inset-0 z-[260] bg-black/35">
          <button type="button" className="h-full w-full" onClick={() => setIsPromoSheetOpen(false)} aria-label="close promo sheet" />
          <div className={checkoutSheetPanel}>
            <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-[color:var(--stroke-strong)]" />
            <div className="shrink-0 px-4 pb-2 pt-1">
              <div className="text-[12px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">промокоды</div>
              <div className="ui-h2 mt-2 text-[color:var(--text)]">доступные акции</div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4">
              {promoLoading ? <div className="ui-muted py-4 text-[13px]">загрузка...</div> : null}
              {!promoLoading && availablePromos.length === 0 ? (
                <div className="ui-muted py-4 text-[13px]">доступных промокодов пока нет</div>
              ) : null}
              <div className="flex flex-col gap-2 pt-1">
                {availablePromos.map((promo) => {
                  const code = String(promo.code || '').trim().toUpperCase()
                  const active =
                    (Boolean(code) && code === String(promoCode || '').trim().toUpperCase()) ||
                    (Boolean(promoCampaignId) && promo.id === promoCampaignId)
                  return (
                    <button
                      key={promo.id}
                      type="button"
                      onClick={() => {
                        if (code) {
                          setPromoCode(code)
                          setPromoCampaignId('')
                        } else {
                          setPromoCampaignId(promo.id)
                          setPromoCode('')
                        }
                        setIsPromoSheetOpen(false)
                      }}
                      className="flex min-h-[3rem] w-full items-center justify-between rounded-[var(--radius-medium)] border border-[color:var(--stroke)] bg-[color:var(--surface)] px-3 py-2 text-left active:opacity-90"
                    >
                      <div className="min-w-0">
                        <div className="ui-body truncate leading-snug">{promo.name}</div>
                        <div className="ui-muted text-[11px]">
                          {code || 'без кода'}
                          {promo.giftTitle ? ` · подарок: ${promo.giftTitle}` : ''}
                        </div>
                      </div>
                      {active ? <span className="shrink-0 text-[15px] text-[color:var(--text)]">✓</span> : null}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="shrink-0 border-t border-[color:var(--stroke)] p-4 pb-[calc(env(safe-area-inset-bottom)+12px)]">
              <button
                type="button"
                onClick={() => setIsPromoSheetOpen(false)}
                className="btn btn-primary h-11 w-full rounded-full text-[15px] font-semibold"
                style={{ borderRadius: 'var(--radius-pill)' }}
              >
                готово
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div
        className={`pointer-events-none fixed bottom-[calc(var(--ufo-bottomnav-h,72px)+env(safe-area-inset-bottom)+8px)] left-1/2 z-[115] w-[min(640px,96%)] max-w-full -translate-x-1/2 transition-opacity ${
          isKeyboardOpen ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <button
          type="button"
          disabled={!canSubmit && !outOfZone}
          onClick={() => {
            if (outOfZone) {
              setDeliveryMethod('PICKUP')
              setIsAddressSheetOpen(true)
              return
            }
            try {
              const el = document.getElementById('checkout-form') as HTMLFormElement | null
              if (!el) return
              if (typeof (el as any).requestSubmit === 'function') {
                ;(el as any).requestSubmit()
                return
              }
              el.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
            } catch {
              // ignore
            }
          }}
          className="pointer-events-auto btn btn-primary h-12 w-full text-[16px]"
          style={{ borderRadius: 'var(--radius-pill)' }}
        >
          {isSubmitting ? '...' : submitCta}
        </button>
      </div>
    </main>
  )
}
