'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { PageHeader } from '@/components/ui/PageHeader'
import { loadDeliveryProfile, saveDeliveryProfile, type DeliveryProfile } from '@/lib/delivery-profile'

const ReadOnlyLocationMap = dynamic(
  () => import('@/components/maps/ReadOnlyLocationMap').then((m) => m.ReadOnlyLocationMap),
  { ssr: false }
)

function normalizePhone(raw: string) {
  const s = String(raw ?? '').trim()
  const plus = s.startsWith('+') ? '+' : ''
  const digits = s.replace(/[^\d]/g, '')
  return (plus + digits).slice(0, 18)
}

export default function ProfileDeliveryPage() {
  const [profile, setProfile] = useState<DeliveryProfile>({
    name: '',
    phone: '',
    address: '',
    apartment: '',
    city: 'Пхукет',
    zipCode: '',
  })
  const [saved, setSaved] = useState(false)
  const [detectingAddress, setDetectingAddress] = useState(false)
  const [detectedHint, setDetectedHint] = useState<string>('')

  useEffect(() => {
    const v = loadDeliveryProfile()
    if (v) setProfile(v)
  }, [])

  const isEmpty = useMemo(() => {
    return !profile.name.trim() && !profile.phone.trim() && !profile.address.trim()
  }, [profile.name, profile.phone, profile.address])

  return (
    <main className="ui-container ui-screen pb-6">
      <PageHeader backHref="/profile" title="доставка" subtitle="для чекаута и курьера" />

      <div className="mt-1 border-t border-[color:var(--stroke)]">
        <section className="border-b border-[color:var(--stroke)] py-3">
          <h3 className="mb-2 text-[12px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">контакт</h3>
          <div className="flex items-center justify-between border-b border-[color:var(--stroke)] py-2.5">
            <span className="ui-muted shrink-0">имя</span>
            <input
              type="text"
              className="ui-body ml-3 w-[65%] border-none bg-transparent p-0 text-right text-[15px] outline-none placeholder:text-[color:var(--muted)]"
              value={profile.name}
              onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
              placeholder="как к вам обращаться"
              autoComplete="name"
            />
          </div>
          <div className="flex items-center justify-between py-2.5">
            <span className="ui-muted shrink-0">телефон</span>
            <input
              type="tel"
              inputMode="tel"
              className="ui-body ml-3 w-[65%] border-none bg-transparent p-0 text-right text-[15px] outline-none placeholder:text-[color:var(--muted)]"
              value={profile.phone}
              onChange={(e) => setProfile((p) => ({ ...p, phone: normalizePhone(e.target.value) }))}
              placeholder="+66 …"
              autoComplete="tel"
            />
          </div>
        </section>

        <section className="border-b border-[color:var(--stroke)] py-3">
          <h3 className="mb-2 text-[12px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">адрес</h3>
          <button
            type="button"
            className="btn btn-soft mb-3 h-9 w-full text-[13px] font-semibold"
            style={{ borderRadius: 'var(--radius-pill)' }}
            disabled={detectingAddress}
            onClick={() => {
              if (!navigator.geolocation) return
              setDetectingAddress(true)
              navigator.geolocation.getCurrentPosition(
                async (pos) => {
                  try {
                    const q = new URLSearchParams({
                      lat: String(pos.coords.latitude),
                      lng: String(pos.coords.longitude),
                    })
                    const res = await fetch(`/api/geocode/reverse?${q.toString()}`, { cache: 'no-store' })
                    const data = await res.json().catch(() => null)
                    if (!res.ok || !data?.ok) return
                    setProfile((p) => ({
                      ...p,
                      address: String(data.address || p.address || ''),
                      city: String(data.city || p.city || 'Пхукет'),
                      lat: String(data.lat ?? pos.coords.latitude),
                      lng: String(data.lng ?? pos.coords.longitude),
                    }))
                    setDetectedHint(String(data.pretty || data.address || '').trim())
                  } finally {
                    setDetectingAddress(false)
                  }
                },
                () => setDetectingAddress(false),
                { enableHighAccuracy: true, timeout: 9000 }
              )
            }}
          >
            {detectingAddress ? 'определяем…' : 'по геолокации'}
          </button>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">улица, дом</span>
            <input
              className="input mt-1 h-10 w-full text-[14px] leading-tight"
              value={profile.address}
              onChange={(e) => setProfile((p) => ({ ...p, address: e.target.value }))}
              placeholder="адрес доставки"
              autoComplete="street-address"
            />
          </label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="block min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">кв. / офис</span>
              <input
                className="input mt-1 h-10 w-full text-[14px] leading-tight"
                value={profile.apartment}
                onChange={(e) => setProfile((p) => ({ ...p, apartment: e.target.value }))}
                placeholder="необязательно"
                autoComplete="address-line2"
              />
            </label>
            <label className="block min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">город</span>
              <input
                className="input mt-1 h-10 w-full text-[14px] leading-tight"
                value={profile.city}
                onChange={(e) => setProfile((p) => ({ ...p, city: e.target.value }))}
                placeholder="город"
                autoComplete="address-level2"
              />
            </label>
          </div>
          <p className="ui-muted mt-2 text-[11px] leading-snug">индекс для Пхукета не нужен — оставьте поле пустым в чекауте.</p>
          {profile.lat && profile.lng ? (
            <div className="mt-3 space-y-2">
              <ReadOnlyLocationMap lat={Number(profile.lat)} lng={Number(profile.lng)} />
              <div className="text-[11px] leading-snug text-[color:var(--muted)]">
                Точка по геолокации — проверьте, что совпадает с местом доставки.
              </div>
              {detectedHint ? <div className="text-[11px] text-[color:var(--muted)]">Найдено: {detectedHint}</div> : null}
            </div>
          ) : null}
        </section>

        <div className="pt-4">
          <button
            type="button"
            className="btn btn-primary h-12 w-full text-[15px] font-semibold disabled:pointer-events-none"
            style={{ borderRadius: 'var(--radius-pill)' }}
            disabled={isEmpty}
            onClick={() => {
              saveDeliveryProfile(profile)
              setSaved(true)
              setTimeout(() => setSaved(false), 1400)
            }}
          >
            {saved ? 'сохранено' : 'сохранить'}
          </button>
        </div>
      </div>
    </main>
  )
}
