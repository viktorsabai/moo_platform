'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { PageHeader } from '@/components/ui/PageHeader'
import { useVenue } from '@/lib/venue-context'
import { telegramInitHeaderRecord } from '@/lib/tg-webapp-client'

type PromoRow = {
  id: string
  name: string
  code?: string | null
  rewardType?: string
  targetType?: string
  giftTitle?: string | null
  validTo?: string | null
}

export default function ProfilePromocodesPage() {
  const { restaurantId: venueRestaurantId } = useVenue()
  const promoHeaders = useMemo(() => {
    const h: Record<string, string> = { ...telegramInitHeaderRecord() }
    const rid = String(venueRestaurantId || '').trim()
    if (rid && rid !== 'default') h['x-ufo-restaurant'] = rid
    return h
  }, [venueRestaurantId])

  const [rows, setRows] = useState<PromoRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/campaigns/available', {
          cache: 'no-store',
          credentials: 'include',
          headers: promoHeaders,
        })
        const data = await res.json().catch(() => null)
        if (cancelled) return
        if (!res.ok || !data?.ok) {
          toast.error(data?.error || 'не удалось загрузить промокоды')
          setRows([])
          return
        }
        setRows(Array.isArray(data.campaigns) ? data.campaigns : [])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [promoHeaders])

  const applyPromo = (code?: string | null) => {
    const normalized = String(code || '').trim().toUpperCase()
    if (!normalized) {
      toast.error('у этой акции нет кода')
      return
    }
    try {
      window.localStorage.setItem('ufo:checkout:promo', normalized)
    } catch {
      // ignore
    }
    toast.success('промокод применится в чекауте')
  }

  return (
    <main className="ui-container ui-screen">
      <PageHeader backHref="/profile" title="мои промокоды" />
      <div className="space-y-3">
        {loading ? <div className="ui-muted text-sm">загрузка...</div> : null}
        {!loading && rows.length === 0 ? <div className="ui-muted text-sm">доступных промокодов пока нет</div> : null}
        {rows.map((row) => (
          <div key={row.id} className="rounded-[var(--radius-large)] border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] p-4">
            <div className="text-[15px] font-semibold">{row.name}</div>
            <div className="mt-1 text-xs text-[color:var(--muted)]">
              {row.code ? `код: ${row.code} · ` : ''}{row.rewardType} · {row.targetType}
            </div>
            {row.giftTitle ? <div className="mt-1 text-xs text-emerald-700">подарок: {row.giftTitle}</div> : null}
            {row.validTo ? <div className="mt-1 text-xs text-[color:var(--muted)]">до {new Date(row.validTo).toLocaleString('ru-RU')}</div> : null}
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => applyPromo(row.code)} className="rounded-full bg-black px-3 py-1.5 text-xs font-semibold text-white">применить</button>
              <Link href={`/checkout?promo=${encodeURIComponent(String(row.code || ''))}`} className="rounded-full border border-[color:var(--stroke)] px-3 py-1.5 text-xs font-semibold">
                в чекаут
              </Link>
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
