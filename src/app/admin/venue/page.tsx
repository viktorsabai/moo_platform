'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { useVenue } from '@/lib/venue-context'
import { PhuketDistrictSvgPicker } from '@/components/admin/PhuketDistrictSvgPicker'
import { AdminPaymentMethods } from '@/components/admin/AdminPaymentMethods'
import { PHUKET_DISTRICTS_GEOJSON } from '@/lib/phuket-districts'

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
type DeliveryZone = {
  id: string
  name: string
  polygonJson?: string | null
  keywords?: string[] | null
  zipCodes?: string[] | null
  deliveryFee: number
  minOrderAmount: number
  deliveryWindowMin: number
  isActive: boolean
  sortOrder: number
}

const DISTRICTS = PHUKET_DISTRICTS_GEOJSON.features.map((f) => ({
  id: String(f.id),
  name: String(f.properties.name),
}))

const DISTRICT_GEOMETRY_BY_ID: Record<
  string,
  { type: 'Polygon'; coordinates: readonly (readonly (readonly [number, number])[])[] }
> =
  Object.fromEntries(
    PHUKET_DISTRICTS_GEOJSON.features.map((f) => [
      String(f.id),
      f.geometry as { type: 'Polygon'; coordinates: readonly (readonly (readonly [number, number])[])[] },
    ])
  )

export default function AdminVenuePage() {
  const searchParams = useSearchParams()
  const { refetch: refetchVenue } = useVenue()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [restaurant, setRestaurant] = useState<RestaurantInfo | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [zones, setZones] = useState<DeliveryZone[]>([])
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>(DISTRICTS[0].id)
  const [selectedDistrictIds, setSelectedDistrictIds] = useState<string[]>([])
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false)
  const [isZoneSheetOpen, setIsZoneSheetOpen] = useState(false)
  const [zoneSavingId, setZoneSavingId] = useState<string | null>(null)
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
      const [rRes, sRes, zRes] = await Promise.all([
        fetch('/api/restaurant', { cache: 'no-store', credentials: 'include' }),
        fetch('/api/admin/settings', { cache: 'no-store', credentials: 'include' }),
        fetch('/api/admin/delivery-zones', { cache: 'no-store', credentials: 'include' }),
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
      const zData = await zRes.json().catch(() => null)
      if (zRes.ok && zData?.ok && Array.isArray(zData.zones)) {
        setZones(zData.zones)
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

  async function saveZone(zone: DeliveryZone) {
    setZoneSavingId(zone.id)
    try {
      const fallbackKeywords = (zone.keywords && zone.keywords.length > 0)
        ? zone.keywords
        : String(zone.name || '')
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean)
      const res = await fetch('/api/admin/delivery-zones', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...zone,
          keywords: fallbackKeywords,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast.error(data?.error || 'Не удалось сохранить зону')
        return
      }
      toast.success('Зона сохранена')
    } finally {
      setZoneSavingId(null)
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

  function getZoneDistrictId(zone: DeliveryZone): string | null {
    if (Array.isArray(zone.keywords)) {
      const districtKeyword = zone.keywords.find((k) => String(k).startsWith('district:'))
      if (districtKeyword) return String(districtKeyword).replace('district:', '')
    }
    const byName = DISTRICTS.find((d) => String(d.name).toLowerCase() === String(zone.name || '').toLowerCase())
    return byName?.id || null
  }

  const selectedDistrict = useMemo(
    () => DISTRICTS.find((d) => d.id === selectedDistrictId) ?? DISTRICTS[0],
    [selectedDistrictId]
  )
  const zoneByDistrictId = useMemo(() => {
    const map = new Map<string, DeliveryZone>()
    zones.forEach((zone) => {
      const districtId = getZoneDistrictId(zone)
      if (districtId) map.set(districtId, zone)
    })
    return map
  }, [zones])
  const configuredDistrictIds = useMemo(
    () => Array.from(zoneByDistrictId.keys()),
    [zoneByDistrictId]
  )
  const inactiveDistrictIds = useMemo(
    () => Array.from(zoneByDistrictId.entries()).filter(([, zone]) => !zone.isActive).map(([districtId]) => districtId),
    [zoneByDistrictId]
  )
  const districtPriceById = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    for (const district of DISTRICTS) {
      const zone = zoneByDistrictId.get(district.id)
      map[district.id] = Number(zone?.deliveryFee ?? settingsForm.deliveryFee ?? 0)
    }
    return map
  }, [zoneByDistrictId, settingsForm.deliveryFee])

  function buildDistrictDraftZone(districtId: string): DeliveryZone {
    const district = DISTRICTS.find((d) => d.id === districtId) ?? DISTRICTS[0]
    return {
      id: `draft_${district.id}`,
      name: district.name,
      polygonJson: JSON.stringify(DISTRICT_GEOMETRY_BY_ID[district.id] ?? null),
      keywords: [district.name, district.id, `district:${district.id}`],
      zipCodes: [],
      deliveryFee: settingsForm.deliveryFee,
      minOrderAmount: settingsForm.freeDeliveryFrom,
      deliveryWindowMin: 60,
      isActive: true,
      sortOrder: zones.length,
    }
  }

  function ensureZoneDraftForDistrict(districtId: string): DeliveryZone {
    const existing = zoneByDistrictId.get(districtId)
    if (existing) return existing
    const draft = buildDistrictDraftZone(districtId)
    setZones((prev) => {
      if (prev.some((z) => getZoneDistrictId(z) === districtId)) return prev
      return [...prev, draft]
    })
    return draft
  }

  useEffect(() => {
    ensureZoneDraftForDistrict(selectedDistrict.id)
    // keep selected district editable immediately
  }, [selectedDistrict.id, settingsForm.deliveryFee, settingsForm.freeDeliveryFrom])
  const selectedZone = useMemo(() => {
    const byDistrict = zoneByDistrictId.get(selectedDistrict.id)
    if (byDistrict) return byDistrict
    return {
      id: `virtual_${selectedDistrict.id}`,
      name: selectedDistrict.name,
      polygonJson: JSON.stringify(DISTRICT_GEOMETRY_BY_ID[selectedDistrict.id] ?? null),
      keywords: [selectedDistrict.name, selectedDistrict.id, `district:${selectedDistrict.id}`],
      zipCodes: [],
      deliveryFee: settingsForm.deliveryFee,
      minOrderAmount: settingsForm.freeDeliveryFrom,
      deliveryWindowMin: 60,
      isActive: true,
      sortOrder: 0,
    } as DeliveryZone
  }, [zoneByDistrictId, selectedDistrict, settingsForm.deliveryFee, settingsForm.freeDeliveryFrom])

  function openDistrictSheet(districtId: string) {
    setSelectedDistrictId(districtId)
    ensureZoneDraftForDistrict(districtId)
    setIsZoneSheetOpen(true)
  }

  function onDistrictTap(districtId: string) {
    if (isMultiSelectMode) {
      ensureZoneDraftForDistrict(districtId)
      setSelectedDistrictIds((prev) =>
        prev.includes(districtId) ? prev.filter((id) => id !== districtId) : [...prev, districtId]
      )
      return
    }
    setSelectedDistrictIds([])
    openDistrictSheet(districtId)
  }

  function updateZoneDraftByDistrictId(
    districtId: string,
    patch: Partial<Pick<DeliveryZone, 'deliveryFee' | 'minOrderAmount' | 'isActive'>>
  ) {
    setZones((prev) => {
      const targetId = prev.find((z) => getZoneDistrictId(z) === districtId)?.id
      if (targetId) {
        return prev.map((z) => (z.id === targetId ? { ...z, ...patch } : z))
      }
      const draft = { ...buildDistrictDraftZone(districtId), ...patch }
      return [...prev, draft]
    })
  }
  const savedDistrictZone = useMemo(
    () => {
      const zone = zoneByDistrictId.get(selectedDistrict.id)
      if (!zone) return null
      return String(zone.id).startsWith('draft_') ? null : zone
    },
    [zoneByDistrictId, selectedDistrict.id]
  )

  async function saveSelectedDistrictRules() {
    const existing = zoneByDistrictId.get(selectedDistrict.id) || null
    if (existing && !String(existing.id).startsWith('draft_')) {
      await saveZone({
        ...selectedZone,
        id: existing.id,
        name: selectedDistrict.name,
        polygonJson: JSON.stringify(DISTRICT_GEOMETRY_BY_ID[selectedDistrict.id] ?? null),
      })
      return
    }
    setZoneSavingId('new')
    try {
      const res = await fetch('/api/admin/delivery-zones', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: selectedDistrict.name,
          polygonJson: JSON.stringify(DISTRICT_GEOMETRY_BY_ID[selectedDistrict.id] ?? null),
          keywords: [selectedDistrict.name, selectedDistrict.id, `district:${selectedDistrict.id}`],
          deliveryFee: selectedZone.deliveryFee,
          minOrderAmount: selectedZone.minOrderAmount,
          deliveryWindowMin: selectedZone.deliveryWindowMin,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast.error(data?.error || 'Не удалось сохранить район')
        return
      }
      await load()
      setIsZoneSheetOpen(false)
      toast.success('Район сохранен')
    } finally {
      setZoneSavingId(null)
    }
  }

  async function saveMultipleDistrictRules() {
    if (!selectedDistrictIds.length) {
      toast.error('Выберите хотя бы один район')
      return
    }
    setZoneSavingId('bulk')
    try {
      for (const districtId of selectedDistrictIds) {
        const district = DISTRICTS.find((d) => d.id === districtId)
        if (!district) continue
        const zone = zoneByDistrictId.get(districtId) || ensureZoneDraftForDistrict(districtId)
        const existing = zoneByDistrictId.get(districtId) || null
        if (existing && !String(existing.id).startsWith('draft_')) {
          await saveZone({
            ...zone,
            id: existing.id,
            name: district.name,
            polygonJson: JSON.stringify(DISTRICT_GEOMETRY_BY_ID[district.id] ?? null),
          })
          continue
        }
        const res = await fetch('/api/admin/delivery-zones', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: district.name,
            polygonJson: JSON.stringify(DISTRICT_GEOMETRY_BY_ID[district.id] ?? null),
            keywords: [district.name, district.id, `district:${district.id}`],
            deliveryFee: zone.deliveryFee,
            minOrderAmount: zone.minOrderAmount,
            deliveryWindowMin: zone.deliveryWindowMin,
          }),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.ok) {
          toast.error(data?.error || `Не удалось сохранить район ${district.name}`)
          return
        }
      }
      await load()
      setIsZoneSheetOpen(false)
      toast.success(`Применено к ${selectedDistrictIds.length} районам`)
    } finally {
      setZoneSavingId(null)
    }
  }

  const cardClass = 'ui-surface-card'
  const cardRadius = { borderRadius: 'var(--radius-large)' } as const
  const section = String(searchParams?.get('section') || '').toLowerCase()
  const showDelivery = section !== 'payments'
  const showPayments = section !== 'delivery'
  const activeSheetDistrictId = isMultiSelectMode
    ? (selectedDistrictIds[0] || selectedDistrictId)
    : selectedDistrictId
  const activeSheetDistrict = DISTRICTS.find((d) => d.id === activeSheetDistrictId) ?? selectedDistrict
  const activeSheetZone = zoneByDistrictId.get(activeSheetDistrict.id) ?? buildDistrictDraftZone(activeSheetDistrict.id)

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
      <div id="delivery" className={`${cardClass}`} style={cardRadius}>
        <h2 className="ui-h2 mb-1 text-[14px]">зоны доставки</h2>
        <p className="ui-muted mb-3 text-[12px]">тап по району → редактирование внизу → готово</p>
        <div className="space-y-3 rounded-xl border border-[color:var(--stroke)] bg-[color:var(--surface)] p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[12px] font-semibold text-[color:var(--muted)]">карта районов</div>
            <button
              type="button"
              onClick={() => {
                setIsMultiSelectMode((v) => {
                  if (v) setSelectedDistrictIds([])
                  return !v
                })
              }}
              className={isMultiSelectMode
                ? 'btn btn-primary rounded-full px-3 py-1.5 text-[11px] font-semibold'
                : 'btn btn-soft rounded-full px-3 py-1.5 text-[11px] font-semibold'}
            >
              {isMultiSelectMode ? 'множественный выбор: вкл' : 'выбрать несколько'}
            </button>
          </div>
          <PhuketDistrictSvgPicker
            districts={DISTRICTS as any}
            selectedDistrictId={selectedDistrictId}
            selectedDistrictIds={selectedDistrictIds}
            onSelectDistrict={onDistrictTap}
            configuredDistrictIds={configuredDistrictIds}
            inactiveDistrictIds={inactiveDistrictIds}
            priceByDistrictId={districtPriceById}
            homeDistrictId={homeDistrictId}
          />
          <div className="rounded-xl border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] px-3 py-2">
            <div className="text-[12px] font-semibold text-[color:var(--text)]">
              {isMultiSelectMode
                ? selectedDistrictIds.length > 0
                  ? `выбрано районов: ${selectedDistrictIds.length}`
                  : 'выберите районы на карте'
                : `выбран район: ${selectedDistrict.name}`}
            </div>
            <div className="mt-0.5 text-[11px] text-[color:var(--muted)]">
              {isMultiSelectMode
                ? 'для пакетного редактирования отметьте несколько районов и нажмите кнопку ниже'
                : savedDistrictZone
                  ? selectedZone.isActive
                    ? 'активен · нажмите район чтобы открыть настройки'
                    : 'выключен · включите район, если нужна доставка'
                  : 'новый район · нажмите район чтобы задать правила'}
            </div>
            {homeDistrictId === selectedDistrict.id ? (
              <div className="mt-1 text-[11px] font-semibold text-[color:var(--accent-strong)]">домашний район ресторана</div>
            ) : null}
          </div>
          {isMultiSelectMode ? (
            <button
              type="button"
              disabled={selectedDistrictIds.length === 0}
              onClick={() => setIsZoneSheetOpen(true)}
              className="btn btn-primary w-full rounded-full px-4 py-2 text-[13px] font-semibold disabled:opacity-50"
            >
              редактировать выбранные районы
            </button>
          ) : null}
        </div>
      </div>
      ) : null}

      {isZoneSheetOpen ? (
        <div className="fixed inset-0 z-[220] bg-black/35">
          <button
            type="button"
            className="h-full w-full"
            onClick={() => setIsZoneSheetOpen(false)}
            aria-label="close zone sheet"
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[78dvh] overflow-y-auto rounded-t-2xl bg-[color:var(--surface-strong)] p-4 pb-[calc(env(safe-area-inset-bottom)+14px)]">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-[color:var(--stroke-strong)]" />
            <div className="text-[18px] font-semibold text-[color:var(--text)]">
              {isMultiSelectMode ? `настройка районов (${selectedDistrictIds.length})` : `редактирование ${activeSheetDistrict.name}`}
            </div>
            <div className="mt-3 space-y-2">
              <div>
                <div className="mb-1 text-[11px] font-semibold text-[color:var(--muted)]">цена доставки</div>
                <input
                  className="input input--pill"
                  value={String(activeSheetZone.deliveryFee)}
                  inputMode="numeric"
                  onChange={(e) => {
                    const n = Math.max(0, Number(e.target.value || 0))
                    const targets = isMultiSelectMode ? selectedDistrictIds : [activeSheetDistrict.id]
                    targets.forEach((districtId) => updateZoneDraftByDistrictId(districtId, { deliveryFee: n }))
                  }}
                  placeholder="например 100"
                />
              </div>
              <div>
                <div className="mb-1 text-[11px] font-semibold text-[color:var(--muted)]">бесплатно от</div>
                <input
                  className="input input--pill"
                  value={String(activeSheetZone.minOrderAmount)}
                  inputMode="numeric"
                  onChange={(e) => {
                    const n = Math.max(0, Number(e.target.value || 0))
                    const targets = isMultiSelectMode ? selectedDistrictIds : [activeSheetDistrict.id]
                    targets.forEach((districtId) => updateZoneDraftByDistrictId(districtId, { minOrderAmount: n }))
                  }}
                  placeholder="например 500"
                />
              </div>
              <label className="inline-flex items-center gap-2 text-[12px] font-semibold text-[color:var(--text)]">
                <input
                  type="checkbox"
                  checked={activeSheetZone.isActive}
                  onChange={(e) => {
                    const targets = isMultiSelectMode ? selectedDistrictIds : [activeSheetDistrict.id]
                    targets.forEach((districtId) => updateZoneDraftByDistrictId(districtId, { isActive: e.target.checked }))
                  }}
                />
                район активен
              </label>
            </div>
            <button
              type="button"
              onClick={isMultiSelectMode ? saveMultipleDistrictRules : saveSelectedDistrictRules}
              disabled={zoneSavingId !== null || (isMultiSelectMode && selectedDistrictIds.length === 0)}
              className="btn btn-primary mt-4 w-full rounded-full px-4 py-2 text-[13px] font-semibold disabled:opacity-50"
            >
              {zoneSavingId ? 'сохраняем…' : 'готово'}
            </button>
          </div>
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
