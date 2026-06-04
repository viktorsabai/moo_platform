'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { computeGuestDeliveryFee } from '@/lib/delivery-quote'
import { DELIVERY_SETTINGS_CHANGED_EVENT } from '@/lib/delivery-settings-events'
import { DELIVERY_PROFILE_CHANGED_EVENT, loadDeliveryProfile } from '@/lib/delivery-profile'
import { telegramInitHeaderRecord } from '@/lib/tg-webapp-client'

export type GuestDeliveryZoneSummary = {
  id: string
  name: string
  deliveryFee: number
  freeFrom: number
  deliveryWindowMin: number
}

export type GuestDeliveryQuote = {
  matched: boolean
  reason?: string
  message?: string
  zone?: {
    id: string
    name: string
    districtId?: string | null
    districtName?: string | null
    deliveryFee: number
    minOrderAmount: number
    deliveryWindowMin: number
    minOrderSatisfied: boolean
    missingForMinOrder: number
  }
}

export type GuestDeliveryAddressInput = {
  address: string
  city?: string
  zipCode?: string
  lat?: string
  lng?: string
}

type PaymentOptionRow = { slug: string; title: string; instruction?: string | null; qrImageUrl?: string | null; rubPerThb?: number | null }

type UseGuestDeliveryOptions = {
  subtotal: number
  address?: GuestDeliveryAddressInput | null
  restaurantHeaders?: HeadersInit
  /** Перезагрузить квоту при смене адреса (checkout). В корзине — профиль по умолчанию. */
  fetchQuote?: boolean
}

export function useGuestDelivery({
  subtotal,
  address: addressOverride,
  restaurantHeaders = {},
  fetchQuote = true,
}: UseGuestDeliveryOptions) {
  const [refreshTick, setRefreshTick] = useState(0)
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [zonesLoading, setZonesLoading] = useState(true)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [settings, setSettings] = useState({
    deliveryFee: 100,
    freeDeliveryFrom: 500,
    activeDeliveryZonesCount: null as number | null,
    paymentOptions: [{ slug: 'CASH', title: 'Наличные курьеру' }] as PaymentOptionRow[],
    stripeConfigured: false,
  })
  const [zones, setZones] = useState<GuestDeliveryZoneSummary[]>([])
  const [quote, setQuote] = useState<GuestDeliveryQuote | null>(null)

  const profileAddress = useMemo((): GuestDeliveryAddressInput | null => {
    const p = loadDeliveryProfile()
    if (!p?.address?.trim()) return null
    return {
      address: [p.address, p.apartment].filter(Boolean).join(', '),
      city: p.city || 'Пхукет',
      zipCode: p.zipCode || '',
      lat: p.lat,
      lng: p.lng,
    }
  }, [refreshTick])

  const effectiveAddress = addressOverride?.address?.trim()
    ? addressOverride
    : profileAddress

  const refreshMeta = useCallback(async () => {
    setSettingsLoading(true)
    setZonesLoading(true)
    try {
      const headers = { ...telegramInitHeaderRecord(), ...restaurantHeaders } as HeadersInit
      const [sRes, zRes] = await Promise.all([
        fetch('/api/settings', { cache: 'no-store', credentials: 'include', headers }),
        fetch('/api/delivery/zones', { cache: 'no-store', credentials: 'include', headers }),
      ])
      const sData = await sRes.json().catch(() => null)
      const zData = await zRes.json().catch(() => null)
      if (sRes.ok && sData?.ok) {
        const opts = Array.isArray(sData.settings?.paymentOptions) ? sData.settings.paymentOptions : []
        const zc = sData.settings?.activeDeliveryZonesCount
        let activeDeliveryZonesCount: number | null = null
        if (zc !== undefined && zc !== null) {
          const n = Math.trunc(Number(zc))
          activeDeliveryZonesCount = Number.isFinite(n) ? Math.max(0, n) : null
        }
        setSettings({
          deliveryFee: Number(sData.settings?.deliveryFee ?? 100),
          freeDeliveryFrom: Number(sData.settings?.freeDeliveryFrom ?? 500),
          activeDeliveryZonesCount,
          paymentOptions: opts.length ? opts : [{ slug: 'CASH', title: 'Наличные курьеру' }],
          stripeConfigured: Boolean(sData.settings?.stripeConfigured),
        })
      }
      if (zRes.ok && zData?.ok && Array.isArray(zData.zones)) {
        setZones(
          zData.zones.map((z: GuestDeliveryZoneSummary) => ({
            id: String(z.id),
            name: String(z.name),
            deliveryFee: Number(z.deliveryFee ?? 0),
            freeFrom: Number(z.freeFrom ?? 0),
            deliveryWindowMin: Number(z.deliveryWindowMin ?? 60),
          }))
        )
      } else {
        setZones([])
      }
    } finally {
      setSettingsLoading(false)
      setZonesLoading(false)
    }
  }, [restaurantHeaders])

  useEffect(() => {
    void refreshMeta()
  }, [refreshMeta, refreshTick])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const onVis = () => {
      if (document.visibilityState === 'visible') void refreshMeta()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [refreshMeta])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onChanged = () => setRefreshTick((t) => t + 1)
    window.addEventListener(DELIVERY_SETTINGS_CHANGED_EVENT, onChanged)
    window.addEventListener(DELIVERY_PROFILE_CHANGED_EVENT, onChanged)
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'ufo:delivery:rev' || e.key === 'ufo_delivery_profile_v1') onChanged()
    }
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(DELIVERY_SETTINGS_CHANGED_EVENT, onChanged)
      window.removeEventListener(DELIVERY_PROFILE_CHANGED_EVENT, onChanged)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  useEffect(() => {
    if (!fetchQuote) {
      setQuote(null)
      return
    }
    const addr = effectiveAddress?.address?.trim()
    if (!addr) {
      setQuote(null)
      return
    }
    let cancelled = false
    setQuoteLoading(true)
    const timer = setTimeout(async () => {
      try {
        const q = new URLSearchParams({
          address: effectiveAddress!.address,
          city: effectiveAddress!.city || '',
          zipCode: effectiveAddress!.zipCode || '',
          subtotal: String(subtotal),
          lat: effectiveAddress!.lat || '',
          lng: effectiveAddress!.lng || '',
        })
        const res = await fetch(`/api/delivery/quote?${q.toString()}`, {
          cache: 'no-store',
          credentials: 'include',
          headers: { ...telegramInitHeaderRecord(), ...restaurantHeaders } as HeadersInit,
        })
        const data = await res.json().catch(() => null)
        if (!cancelled && data?.ok) {
          setQuote({
            matched: Boolean(data.matched),
            reason: data.reason,
            message: data.message,
            zone: data.zone,
          })
        }
      } catch {
        if (!cancelled) setQuote(null)
      } finally {
        if (!cancelled) setQuoteLoading(false)
      }
    }, 280)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [fetchQuote, effectiveAddress, subtotal, restaurantHeaders, refreshTick])

  const deliveryAvailable = (settings.activeDeliveryZonesCount ?? zones.length) > 0

  const estimatedDeliveryFee = useMemo(() => {
    if (!deliveryAvailable) return 0
    if (quote && !quote.matched) return 0
    return computeGuestDeliveryFee({
      subtotal,
      quote: quote?.matched && quote.zone ? { matched: true, zone: quote.zone } : null,
      fallbackDeliveryFee: settings.deliveryFee,
      fallbackFreeDeliveryFrom: settings.freeDeliveryFrom,
    })
  }, [deliveryAvailable, quote, subtotal, settings.deliveryFee, settings.freeDeliveryFrom])

  const estimatedTotal = subtotal + estimatedDeliveryFee

  const outOfZone = Boolean(fetchQuote && effectiveAddress?.address?.trim() && quote && !quote.matched)

  return {
    settings,
    zones,
    quote,
    profileAddress,
    effectiveAddress,
    deliveryAvailable,
    estimatedDeliveryFee,
    estimatedTotal,
    outOfZone,
    settingsLoading,
    zonesLoading,
    quoteLoading,
    refresh: refreshMeta,
  }
}

export type GuestDeliveryState = ReturnType<typeof useGuestDelivery>
