'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { useVenue } from '@/lib/venue-context'
import { AdminDeliveryConfig } from '@/components/admin/AdminDeliveryConfig'
import { AdminPaymentMethods } from '@/components/admin/AdminPaymentMethods'
import { DISTRICTS } from '@/lib/delivery-zone-helpers'

type Settings = {
  menuEnabled: boolean
  storeEnabled: boolean
  subscriptionEnabled: boolean
  deliveryFee: number
  freeDeliveryFrom: number
  openTime: string
  closeTime: string
  isOpenOverride: boolean | null
}

type RestaurantInfo = {
  id: string
  name: string
  address?: string | null
}
export default function AdminVenuePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { refetch: refetchVenue } = useVenue()

  useEffect(() => {
    if (String(searchParams?.get('section') || '').toLowerCase() === 'bot') {
      router.replace('/admin/qr')
    }
  }, [searchParams, router])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [restaurant, setRestaurant] = useState<RestaurantInfo | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [nameForm, setNameForm] = useState('')
  const [addressForm, setAddressForm] = useState('')
  const [settingsForm, setSettingsForm] = useState<Settings>({
    menuEnabled: false,
    storeEnabled: true,
    subscriptionEnabled: false,
    deliveryFee: 100,
    freeDeliveryFrom: 500,
    openTime: '10:00',
    closeTime: '22:00',
    isOpenOverride: null,
  })
  const [homeDistrictId, setHomeDistrictId] = useState<string | null>(null)

  function detectDistrictByAddressText(address: string): { id: string; name: string } | null {
    const normalized = String(address || '').toLowerCase()
    if (!normalized) return null
    const aliases: Record<string, string[]> = {
      bang_tao: ['bang tao', 'laguna'],
      phuket_town: ['phuket town', 'old town', 'город'],
      thep_krasattri: ['thep krasattri', 'thalang'],
      sri_sunthon: ['sri sunthon'],
      koh_kaew: ['koh kaew'],
      kata_noi: ['kata noi'],
      nai_harn: ['nai harn'],
      nai_yang: ['nai yang'],
    }
    for (const d of DISTRICTS) {
      const key = d.id
      const name = d.name.toLowerCase()
      if (normalized.includes(name)) return { id: d.id, name: d.name }
      const words = aliases[key] || []
      if (words.some((w) => normalized.includes(w))) return { id: d.id, name: d.name }
    }
    return null
  }

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [rRes, sRes] = await Promise.all([
        fetch('/api/restaurant', { cache: 'no-store', credentials: 'include' }),
        fetch('/api/admin/settings', { cache: 'no-store', credentials: 'include' }),
      ])
      const r = await rRes.json().catch(() => null)
      const s = await sRes.json().catch(() => null)

      if (rRes.ok && r?.ok) {
        const r2 = r.restaurant || null
        setRestaurant(r2)
        if (r2?.name) setNameForm(r2.name)
        setAddressForm(r2?.address ?? '')
        const byAddress = detectDistrictByAddressText(r2?.address ?? '')
        if (byAddress) setHomeDistrictId(byAddress.id)
      } else if (!rRes.ok && r?.error) {
        setError(r.error)
      }
      if (sRes.ok && s?.ok) {
        const raw = s.settings
        setSettings(raw || null)
        setSettingsForm({
          menuEnabled: Boolean(raw?.menuEnabled),
          storeEnabled: Boolean(raw?.storeEnabled),
          subscriptionEnabled: Boolean(raw?.subscriptionEnabled),
          deliveryFee: Number(raw?.deliveryFee ?? 100),
          freeDeliveryFrom: Number(raw?.freeDeliveryFrom ?? 500),
          openTime: String(raw?.openTime ?? '10:00'),
          closeTime: String(raw?.closeTime ?? '22:00'),
          isOpenOverride:
            raw?.isOpenOverride === null || typeof raw?.isOpenOverride === 'boolean'
              ? raw.isOpenOverride
              : null,
        })
      } else if (!sRes.ok && s?.error) {
        setError(s.error)
      }
    } catch {
      setError('не удалось загрузить')
    } finally {
      setLoading(false)
    }
  }

  async function saveAll() {
    setLoading(true)
    setError(null)
    try {
      if (restaurant?.id && (nameForm.trim() !== restaurant.name || (addressForm.trim() || '') !== (restaurant.address ?? ''))) {
        const payload: { name?: string; address?: string | null } = {}
        if (nameForm.trim()) payload.name = nameForm.trim()
        payload.address = addressForm.trim() || null
        const rRes = await fetch(`/api/restaurant/${encodeURIComponent(restaurant.id)}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const rData = await rRes.json().catch(() => null)
        if (rRes.ok && rData?.ok) {
          setRestaurant((prev) => (prev ? { ...prev, name: payload.name ?? prev.name, address: payload.address ?? prev.address } : null))
          void refetchVenue()
        } else if (!rRes.ok) {
          setError(rData?.error || 'не удалось сохранить')
          toast.error(rData?.error || 'не удалось сохранить')
          return
        }
      }
      await save()
    } finally {
      setLoading(false)
    }
  }

  async function save() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/settings', {
        credentials: 'include',
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(settingsForm),
      })
      const data = await res.json().catch(() => null)
      // #region agent log
      try {
        const line = JSON.stringify({ location: 'admin/venue:save:response', data: { ok: res.ok, status: res.status, error: data?.error }, timestamp: Date.now(), hypothesisId: 'G' }) + '\n'
        await fetch('/api/debug-log', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: line })
      } catch {}
      // #endregion
      if (!res.ok || !data?.ok) {
        const errMsg = data?.error || 'не удалось сохранить'
        setError(errMsg)
        toast.error(errMsg)
        return
      }
      setSavedAt(Date.now())
      setSettings(settingsForm)
      void refetchVenue()
      toast.success('Настройки сохранены')
    } catch {
      const errMsg = 'не удалось сохранить'
      setError(errMsg)
      toast.error(errMsg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (homeDistrictId) return
    const byAddress = detectDistrictByAddressText(addressForm)
    if (byAddress) setHomeDistrictId(byAddress.id)
  }, [addressForm, homeDistrictId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const scrollToHash = () => {
      const raw = String(window.location.hash || '').replace(/^#/, '').trim()
      if (!raw) return
      const el = document.getElementById(raw)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    const t = window.setTimeout(scrollToHash, 120)
    window.addEventListener('hashchange', scrollToHash)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('hashchange', scrollToHash)
    }
  }, [])

  const cardClass = 'ui-surface-card'
  const cardRadius = { borderRadius: 'var(--radius-large)' } as const
  const section = String(searchParams?.get('section') || '').toLowerCase()
  const showDelivery = section !== 'payments'
  const showPayments = section !== 'delivery'

  if (loading && !settings) {
    return (
      <main className="ui-container ui-screen">
        <div className={cardClass} style={cardRadius}>
          <div className="ui-muted text-[13px]">загрузка…</div>
        </div>
      </main>
    )
  }

  return (
    <main className="ui-container ui-screen min-w-0 max-w-full overflow-x-hidden">
      <div className={`${cardClass} mb-3`} style={cardRadius}>
        <div className="flex gap-2">
          <Link
            href="/admin/venue?section=delivery"
            prefetch={false}
            className={
              showDelivery && !showPayments
                ? 'btn btn-primary rounded-full px-4 py-2 text-[12px] font-semibold'
                : 'btn btn-soft rounded-full px-4 py-2 text-[12px] font-semibold'
            }
            style={{ borderRadius: 'var(--radius-pill)' }}
          >
            доставка
          </Link>
          <Link
            href="/admin/venue?section=payments"
            prefetch={false}
            className={
              showPayments && !showDelivery
                ? 'btn btn-primary rounded-full px-4 py-2 text-[12px] font-semibold'
                : 'btn btn-soft rounded-full px-4 py-2 text-[12px] font-semibold'
            }
            style={{ borderRadius: 'var(--radius-pill)' }}
          >
            оплата
          </Link>
        </div>
      </div>

      {showDelivery ? (
        <div className={cardClass} style={cardRadius}>
          <AdminDeliveryConfig
            defaultDeliveryFee={settingsForm.deliveryFee}
            freeDeliveryFrom={settingsForm.freeDeliveryFrom}
            homeDistrictId={homeDistrictId}
            onDefaultsChange={(deliveryFee, freeDeliveryFrom) =>
              setSettingsForm((prev) => ({ ...prev, deliveryFee, freeDeliveryFrom }))
            }
          />
        </div>
      ) : null}

      {showPayments ? (
        <div id="payments">
          <AdminPaymentMethods />
        </div>
      ) : null}

      <div className={`mt-4 ${cardClass}`} style={cardRadius}>
        <p className="ui-muted text-[12px] leading-relaxed">
          Название, адрес, часы, каталоги и общие параметры доставки — в разделе{' '}
          <Link href="/admin/settings" prefetch={false} className="font-semibold text-[color:var(--text)] underline underline-offset-2">
            настройки
          </Link>
          .
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => saveAll()}
            disabled={loading}
            className="btn btn-primary rounded-full px-4 py-2.5 text-[13px] font-semibold transition active:opacity-90 disabled:opacity-50"
            style={{ borderRadius: 'var(--radius-pill)' }}
          >
            сохранить заведение
          </button>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="btn btn-soft rounded-full px-4 py-2.5 text-[13px] font-semibold transition active:opacity-80 disabled:opacity-50"
            style={{ borderRadius: 'var(--radius-pill)' }}
          >
            обновить данные
          </button>
        </div>
        {savedAt ? <p className="ui-muted mt-2 text-[12px]">настройки сохранены</p> : null}
        {error ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50/80 p-3 dark:border-red-900/40 dark:bg-red-950/30">
            <p className="text-[13px] font-semibold text-red-700 dark:text-red-300">{error}</p>
            <p className="mt-1 text-[11px] text-red-600/80 dark:text-red-400/90">
              {error.includes('доступ') ? 'Убедитесь, что вы владелец или админ этого заведения.' : null}
              {error.includes('Войдите') ? 'Войдите через Telegram.' : null}
              {error.includes('базы данных') ? 'Проверьте DATABASE_URL в .env.' : null}
            </p>
          </div>
        ) : null}
      </div>
    </main>
  )
}
