'use client'

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { PhuketDistrictSvgPicker } from '@/components/admin/PhuketDistrictSvgPicker'
import { PillTabToggle } from '@/components/ui/PillTabToggle'
import { dispatchDeliverySettingsChanged } from '@/lib/delivery-settings-events'
import {
  DISTRICTS,
  DISTRICT_GEOMETRY_BY_ID,
  type DeliveryZoneRow,
  districtKeywords,
  getZoneDistrictId,
  getZoneNote,
  isPersistedZoneId,
  mergeZoneNote,
} from '@/lib/delivery-zone-helpers'

type TabId = 'setup' | 'summary' | 'help'

type Props = {
  defaultDeliveryFee: number
  freeDeliveryFrom: number
  homeDistrictId?: string | null
  onDefaultsChange?: (deliveryFee: number, freeDeliveryFrom: number) => void
}

export function AdminDeliveryConfig({
  defaultDeliveryFee,
  freeDeliveryFrom,
  homeDistrictId = null,
  onDefaultsChange,
}: Props) {
  const [baseFee, setBaseFee] = useState(defaultDeliveryFee)
  const [baseFreeFrom, setBaseFreeFrom] = useState(freeDeliveryFrom)
  const [defaultsSaving, setDefaultsSaving] = useState(false)

  useEffect(() => {
    setBaseFee(defaultDeliveryFee)
    setBaseFreeFrom(freeDeliveryFrom)
  }, [defaultDeliveryFee, freeDeliveryFrom])
  const [zones, setZones] = useState<DeliveryZoneRow[]>([])
  const [zonesLoading, setZonesLoading] = useState(true)
  const [tab, setTab] = useState<TabId>('setup')
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>(DISTRICTS[0].id)
  const [selectedDistrictIds, setSelectedDistrictIds] = useState<string[]>([])
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false)
  const [isZoneSheetOpen, setIsZoneSheetOpen] = useState(false)
  const [zoneSavingId, setZoneSavingId] = useState<string | null>(null)
  const [sheetNote, setSheetNote] = useState('')

  async function reloadZones() {
    setZonesLoading(true)
    try {
      const res = await fetch('/api/admin/delivery-zones', { cache: 'no-store', credentials: 'include' })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.ok && Array.isArray(data.zones)) {
        setZones(data.zones)
      }
    } finally {
      setZonesLoading(false)
    }
  }

  useEffect(() => {
    void reloadZones()
  }, [])

  const zoneByDistrictId = useMemo(() => {
    const map = new Map<string, DeliveryZoneRow>()
    zones.forEach((zone) => {
      const districtId = getZoneDistrictId(zone)
      if (districtId) map.set(districtId, zone)
    })
    return map
  }, [zones])

  const configuredDistrictIds = useMemo(() => Array.from(zoneByDistrictId.keys()), [zoneByDistrictId])
  const inactiveDistrictIds = useMemo(
    () =>
      Array.from(zoneByDistrictId.entries())
        .filter(([, zone]) => !zone.isActive)
        .map(([districtId]) => districtId),
    [zoneByDistrictId]
  )
  const activeCount = useMemo(
    () => Array.from(zoneByDistrictId.values()).filter((z) => z.isActive && isPersistedZoneId(z.id)).length,
    [zoneByDistrictId]
  )
  const districtPriceById = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    for (const district of DISTRICTS) {
      const zone = zoneByDistrictId.get(district.id)
      map[district.id] = Number(zone?.deliveryFee ?? defaultDeliveryFee ?? 0)
    }
    return map
  }, [zoneByDistrictId, defaultDeliveryFee])

  const selectedDistrict = useMemo(
    () => DISTRICTS.find((d) => d.id === selectedDistrictId) ?? DISTRICTS[0],
    [selectedDistrictId]
  )

  function buildDistrictDraftZone(districtId: string): DeliveryZoneRow {
    const district = DISTRICTS.find((d) => d.id === districtId) ?? DISTRICTS[0]
    return {
      id: `draft_${district.id}`,
      name: district.name,
      polygonJson: JSON.stringify(DISTRICT_GEOMETRY_BY_ID[district.id] ?? null),
      keywords: districtKeywords(district.id, district.name),
      zipCodes: [],
      deliveryFee: defaultDeliveryFee,
      minOrderAmount: freeDeliveryFrom,
      deliveryWindowMin: 60,
      isActive: true,
      sortOrder: zones.length,
    }
  }

  function ensureZoneDraftForDistrict(districtId: string): DeliveryZoneRow {
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
  }, [selectedDistrict.id, defaultDeliveryFee, freeDeliveryFrom])

  const activeZonesList = useMemo(() => {
    return DISTRICTS.map((d) => {
      const zone = zoneByDistrictId.get(d.id)
      if (!zone || !zone.isActive) return null
      const persisted = isPersistedZoneId(zone.id)
      if (!persisted && String(zone.id).startsWith('draft_')) return null
      return { district: d, zone }
    }).filter(Boolean) as Array<{ district: (typeof DISTRICTS)[0]; zone: DeliveryZoneRow }>
  }, [zoneByDistrictId])

  const summaryRows = useMemo(() => {
    return DISTRICTS.map((d) => {
      const zone = zoneByDistrictId.get(d.id)
      if (!zone) return { district: d, status: 'off' as const }
      if (!zone.isActive) return { district: d, status: 'inactive' as const, zone }
      return { district: d, status: 'active' as const, zone }
    })
  }, [zoneByDistrictId])

  function openDistrictSheet(districtId: string) {
    setSelectedDistrictId(districtId)
    const zone = ensureZoneDraftForDistrict(districtId)
    setSheetNote(getZoneNote(zone.keywords))
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
    patch: Partial<Pick<DeliveryZoneRow, 'deliveryFee' | 'minOrderAmount' | 'deliveryWindowMin' | 'isActive'>>,
    note?: string
  ) {
    setZones((prev) => {
      const targetId = prev.find((z) => getZoneDistrictId(z) === districtId)?.id
      if (targetId) {
        return prev.map((z) => {
          if (z.id !== targetId) return z
          const next = { ...z, ...patch }
          if (note !== undefined) {
            next.keywords = mergeZoneNote(z.keywords, note)
          }
          return next
        })
      }
      const draft = buildDistrictDraftZone(districtId)
      if (note !== undefined) draft.keywords = mergeZoneNote(draft.keywords, note)
      return [...prev, { ...draft, ...patch }]
    })
  }

  async function persistZone(districtId: string, zone: DeliveryZoneRow, note: string) {
    const district = DISTRICTS.find((d) => d.id === districtId)
    if (!district) return false
    const keywords = districtKeywords(district.id, district.name, note)
    const body = {
      name: district.name,
      polygonJson: JSON.stringify(DISTRICT_GEOMETRY_BY_ID[district.id] ?? null),
      keywords,
      deliveryFee: zone.deliveryFee,
      minOrderAmount: zone.minOrderAmount,
      deliveryWindowMin: zone.deliveryWindowMin,
      isActive: zone.isActive,
    }
    if (isPersistedZoneId(zone.id)) {
      const res = await fetch('/api/admin/delivery-zones', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...body, id: zone.id, sortOrder: zone.sortOrder }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast.error(data?.error || `Не удалось сохранить ${district.name}`)
        return false
      }
      return true
    }
    const res = await fetch('/api/admin/delivery-zones', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.ok) {
      toast.error(data?.error || `Не удалось сохранить ${district.name}`)
      return false
    }
    return true
  }

  async function saveSheetRules() {
    const targets = isMultiSelectMode ? selectedDistrictIds : [selectedDistrictId]
    if (!targets.length) {
      toast.error('Выберите хотя бы один район')
      return
    }
    setZoneSavingId('sheet')
    try {
      for (const districtId of targets) {
        const zone = zoneByDistrictId.get(districtId) || buildDistrictDraftZone(districtId)
        const note = isMultiSelectMode && targets.length > 1 ? getZoneNote(zone.keywords) : sheetNote
        const ok = await persistZone(districtId, zone, note)
        if (!ok) return
      }
      await reloadZones()
      dispatchDeliverySettingsChanged()
      setIsZoneSheetOpen(false)
      setSelectedDistrictIds([])
      toast.success(targets.length > 1 ? `Сохранено: ${targets.length} районов` : 'Район сохранён')
    } finally {
      setZoneSavingId(null)
    }
  }

  async function saveAllZones() {
    setZoneSavingId('all')
    try {
      const toSave = DISTRICTS.map((d) => {
        const zone = zoneByDistrictId.get(d.id)
        if (!zone) return null
        return { districtId: d.id, zone }
      }).filter(Boolean) as Array<{ districtId: string; zone: DeliveryZoneRow }>

      if (!toSave.length) {
        toast.error('Нет зон для сохранения')
        return
      }
      for (const { districtId, zone } of toSave) {
        const ok = await persistZone(districtId, zone, getZoneNote(zone.keywords))
        if (!ok) return
      }
      await reloadZones()
      dispatchDeliverySettingsChanged()
      toast.success('Все зоны сохранены')
    } finally {
      setZoneSavingId(null)
    }
  }

  const activeSheetDistrictId = isMultiSelectMode
    ? selectedDistrictIds[0] || selectedDistrictId
    : selectedDistrictId
  const activeSheetDistrict = DISTRICTS.find((d) => d.id === activeSheetDistrictId) ?? selectedDistrict
  const activeSheetZone =
    zoneByDistrictId.get(activeSheetDistrict.id) ?? buildDistrictDraftZone(activeSheetDistrict.id)

  async function saveBaseDefaults() {
    setDefaultsSaving(true)
    try {
      const deliveryFee = Math.max(0, Math.trunc(Number(baseFee) || 0))
      const freeDeliveryFrom = Math.max(0, Math.trunc(Number(baseFreeFrom) || 0))
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ deliveryFee, freeDeliveryFrom }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast.error(data?.error || 'Не удалось сохранить')
        return
      }
      onDefaultsChange?.(deliveryFee, freeDeliveryFrom)
      dispatchDeliverySettingsChanged()
      toast.success('Базовые тарифы сохранены')
    } finally {
      setDefaultsSaving(false)
    }
  }

  const tabOptions = [
    { id: 'setup' as const, label: 'Настройка' },
    { id: 'summary' as const, label: 'Сводка' },
    { id: 'help' as const, label: 'Справка' },
  ]

  return (
    <div id="delivery" className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="ui-h2 text-[14px]">Зоны доставки</h2>
          <p className="ui-muted mt-0.5 text-[12px]">
            Активно: {activeCount} из {DISTRICTS.length} районов
            {zonesLoading ? ' · загрузка…' : null}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void saveAllZones()}
          disabled={zoneSavingId !== null || zonesLoading}
          className="btn btn-soft shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold disabled:opacity-50"
        >
          {zoneSavingId === 'all' ? 'Сохраняем…' : 'Сохранить все'}
        </button>
      </div>

      <PillTabToggle className="w-full" options={tabOptions} value={tab} onChange={(v) => setTab(v as TabId)} />

      <div className="rounded-xl border border-[color:var(--stroke)] bg-[color:var(--surface)] p-3">
        <div className="text-[12px] font-semibold text-[color:var(--text)]">Базовые тарифы</div>
        <p className="mt-0.5 text-[11px] text-[color:var(--muted)]">
          Для районов без своей зоны и как старт при создании нового района.
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase text-[color:var(--muted)]">доставка, ฿</div>
            <input
              className="input input--pill w-full"
              inputMode="numeric"
              value={String(baseFee)}
              onChange={(e) => setBaseFee(Math.max(0, Number(e.target.value || 0)))}
            />
          </div>
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase text-[color:var(--muted)]">бесплатно от, ฿</div>
            <input
              className="input input--pill w-full"
              inputMode="numeric"
              value={String(baseFreeFrom)}
              onChange={(e) => setBaseFreeFrom(Math.max(0, Number(e.target.value || 0)))}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => void saveBaseDefaults()}
          disabled={defaultsSaving}
          className="btn btn-soft mt-2 w-full rounded-full px-4 py-2 text-[12px] font-semibold disabled:opacity-50"
        >
          {defaultsSaving ? 'Сохраняем…' : 'Сохранить базовые'}
        </button>
      </div>

      {tab === 'setup' ? (
        <div className="space-y-3 rounded-xl border border-[color:var(--stroke)] bg-[color:var(--surface)] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2 text-[10px] font-semibold text-[color:var(--muted)]">
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#4CAF50]" /> бесплатно
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#FF9800]" /> платная
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#9E9E9E]" /> выкл.
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsMultiSelectMode((v) => {
                  if (v) setSelectedDistrictIds([])
                  return !v
                })
              }}
              className={
                isMultiSelectMode
                  ? 'btn btn-primary rounded-full px-3 py-1.5 text-[11px] font-semibold'
                  : 'btn btn-soft rounded-full px-3 py-1.5 text-[11px] font-semibold'
              }
            >
              {isMultiSelectMode ? 'Мульти: вкл' : 'Несколько районов'}
            </button>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
            <PhuketDistrictSvgPicker
              districts={DISTRICTS}
              selectedDistrictId={selectedDistrictId}
              selectedDistrictIds={selectedDistrictIds}
              onSelectDistrict={onDistrictTap}
              configuredDistrictIds={configuredDistrictIds}
              inactiveDistrictIds={inactiveDistrictIds}
              priceByDistrictId={districtPriceById}
              homeDistrictId={homeDistrictId}
            />

            <div className="min-h-0 rounded-xl border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] p-2.5">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                Активные зоны
              </div>
              {activeZonesList.length === 0 ? (
                <p className="text-[12px] text-[color:var(--muted)]">Пока нет активных районов. Тапните карту.</p>
              ) : (
                <ul className="max-h-[360px] space-y-1.5 overflow-y-auto">
                  {activeZonesList.map(({ district, zone }) => (
                    <li key={district.id}>
                      <button
                        type="button"
                        onClick={() => openDistrictSheet(district.id)}
                        className="w-full rounded-lg border border-[color:var(--stroke)] bg-[color:var(--surface)] px-2.5 py-2 text-left transition active:opacity-90"
                      >
                        <div className="text-[12px] font-semibold text-[color:var(--text)]">{district.name}</div>
                        <div className="mt-0.5 text-[10px] text-[color:var(--muted)]">
                          {zone.deliveryFee <= 0
                            ? 'бесплатно'
                            : `${zone.deliveryFee} ฿`}
                          {zone.minOrderAmount > 0 ? ` · от ${zone.minOrderAmount} ฿` : ''}
                          {zone.deliveryWindowMin ? ` · ~${zone.deliveryWindowMin} мин` : ''}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {isMultiSelectMode ? (
            <div className="rounded-xl border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] px-3 py-2">
              <div className="text-[12px] font-semibold text-[color:var(--text)]">
                {selectedDistrictIds.length > 0
                  ? `Выбрано: ${selectedDistrictIds.length}`
                  : 'Отметьте районы на карте'}
              </div>
              <button
                type="button"
                disabled={selectedDistrictIds.length === 0}
                onClick={() => {
                  const first = selectedDistrictIds[0]
                  if (first) setSheetNote(getZoneNote(zoneByDistrictId.get(first)?.keywords))
                  setIsZoneSheetOpen(true)
                }}
                className="btn btn-primary mt-2 w-full rounded-full px-4 py-2 text-[13px] font-semibold disabled:opacity-50"
              >
                Редактировать выбранные
              </button>
            </div>
          ) : (
            <p className="text-[11px] text-[color:var(--muted)]">
              Тап по району — настройки зоны. Базовые тарифы выше применяются к новым районам.
            </p>
          )}
        </div>
      ) : null}

      {tab === 'summary' ? (
        <div className="space-y-2 rounded-xl border border-[color:var(--stroke)] bg-[color:var(--surface)] p-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-[color:var(--surface-strong)] p-2.5 text-center">
              <div className="text-[18px] font-bold text-[color:var(--text)]">{activeCount}</div>
              <div className="text-[10px] text-[color:var(--muted)]">активных</div>
            </div>
            <div className="rounded-lg bg-[color:var(--surface-strong)] p-2.5 text-center">
              <div className="text-[18px] font-bold text-[color:var(--text)]">
                {summaryRows.filter((r) => r.status === 'active' && (r.zone?.deliveryFee ?? 0) <= 0).length}
              </div>
              <div className="text-[10px] text-[color:var(--muted)]">бесплатно</div>
            </div>
            <div className="rounded-lg bg-[color:var(--surface-strong)] p-2.5 text-center">
              <div className="text-[18px] font-bold text-[color:var(--text)]">
                {Math.round(
                  summaryRows
                    .filter((r) => r.status === 'active')
                    .reduce((s, r) => s + Number(r.zone?.deliveryFee ?? 0), 0) /
                    Math.max(1, activeCount)
                ) || 0}
              </div>
              <div className="text-[10px] text-[color:var(--muted)]">ср. ฿</div>
            </div>
          </div>
          <ul className="divide-y divide-[color:var(--stroke)]">
            {summaryRows.map(({ district, status, zone }) => (
              <li key={district.id} className="flex items-center justify-between gap-2 py-2">
                <button
                  type="button"
                  onClick={() => openDistrictSheet(district.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="truncate text-[13px] font-semibold text-[color:var(--text)]">{district.name}</div>
                  {status === 'active' && zone ? (
                    <div className="text-[11px] text-[color:var(--muted)]">
                      {zone.deliveryFee <= 0 ? 'бесплатно' : `${zone.deliveryFee} ฿`}
                      {zone.minOrderAmount > 0 ? ` · порог ${zone.minOrderAmount} ฿` : ''}
                      · {zone.deliveryWindowMin} мин
                    </div>
                  ) : (
                    <div className="text-[11px] text-[color:var(--muted)]">
                      {status === 'inactive' ? 'выключен' : 'не настроен'}
                    </div>
                  )}
                </button>
                <span
                  className={
                    status === 'active'
                      ? 'shrink-0 rounded-full bg-[color:var(--accent)] px-2 py-0.5 text-[10px] font-semibold text-white'
                      : 'shrink-0 rounded-full border border-[color:var(--stroke)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--muted)]'
                  }
                >
                  {status === 'active' ? 'вкл' : '—'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {tab === 'help' ? (
        <div className="space-y-2 rounded-xl border border-[color:var(--stroke)] bg-[color:var(--surface)] p-3 text-[12px] leading-relaxed text-[color:var(--text)]">
          <p>
            <span className="font-semibold">Карта</span> — микрорайоны Пхукета. Зелёный — бесплатная доставка (0 ฿),
            оранжевый — платная, серый — район выключен.
          </p>
          <p>
            <span className="font-semibold">Бесплатно от</span> — сумма заказа, после которой доставка в этот район
            становится бесплатной (не минимальный заказ).
          </p>
          <p>
            <span className="font-semibold">Время</span> — ориентир для гостя на checkout (~N мин).
          </p>
          <p>
            <span className="font-semibold">Заметка</span> — только для кухни/команды, гость не видит.
          </p>
          <p className="text-[color:var(--muted)]">
            После изменений нажмите «Готово» в районе или «Сохранить все». Гость видит цену по адресу при оформлении.
          </p>
        </div>
      ) : null}

      {isZoneSheetOpen ? (
        <div className="fixed inset-0 z-[220] bg-black/35">
          <button
            type="button"
            className="h-full w-full"
            onClick={() => setIsZoneSheetOpen(false)}
            aria-label="Закрыть"
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[82dvh] overflow-y-auto rounded-t-2xl bg-[color:var(--surface-strong)] p-4 pb-[calc(env(safe-area-inset-bottom)+14px)]">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-[color:var(--stroke-strong)]" />
            <div className="text-[18px] font-semibold text-[color:var(--text)]">
              {isMultiSelectMode
                ? `Районы (${selectedDistrictIds.length})`
                : activeSheetDistrict.name}
            </div>
            <p className="mt-1 text-[11px] text-[color:var(--muted)]">
              Цены в батах (฿). «Бесплатно от» — минимальная сумма заказа для бесплатной доставки.
            </p>
            <div className="mt-3 space-y-2.5">
              <label className="inline-flex items-center gap-2 text-[13px] font-semibold text-[color:var(--text)]">
                <input
                  type="checkbox"
                  checked={activeSheetZone.isActive}
                  onChange={(e) => {
                    const targets = isMultiSelectMode ? selectedDistrictIds : [activeSheetDistrict.id]
                    targets.forEach((id) => updateZoneDraftByDistrictId(id, { isActive: e.target.checked }))
                  }}
                />
                Доставка в район включена
              </label>
              <div>
                <div className="mb-1 text-[11px] font-semibold text-[color:var(--muted)]">Стоимость доставки, ฿</div>
                <input
                  className="input input--pill w-full"
                  value={String(activeSheetZone.deliveryFee)}
                  inputMode="numeric"
                  onChange={(e) => {
                    const n = Math.max(0, Number(e.target.value || 0))
                    const targets = isMultiSelectMode ? selectedDistrictIds : [activeSheetDistrict.id]
                    targets.forEach((id) => updateZoneDraftByDistrictId(id, { deliveryFee: n }))
                  }}
                  placeholder="0 = бесплатно"
                />
              </div>
              <div>
                <div className="mb-1 text-[11px] font-semibold text-[color:var(--muted)]">Бесплатная доставка от, ฿</div>
                <input
                  className="input input--pill w-full"
                  value={String(activeSheetZone.minOrderAmount)}
                  inputMode="numeric"
                  onChange={(e) => {
                    const n = Math.max(0, Number(e.target.value || 0))
                    const targets = isMultiSelectMode ? selectedDistrictIds : [activeSheetDistrict.id]
                    targets.forEach((id) => updateZoneDraftByDistrictId(id, { minOrderAmount: n }))
                  }}
                  placeholder="например 500"
                />
              </div>
              <div>
                <div className="mb-1 text-[11px] font-semibold text-[color:var(--muted)]">Время доставки, мин</div>
                <input
                  className="input input--pill w-full"
                  value={String(activeSheetZone.deliveryWindowMin)}
                  inputMode="numeric"
                  onChange={(e) => {
                    const n = Math.max(10, Math.trunc(Number(e.target.value || 60)))
                    const targets = isMultiSelectMode ? selectedDistrictIds : [activeSheetDistrict.id]
                    targets.forEach((id) => updateZoneDraftByDistrictId(id, { deliveryWindowMin: n }))
                  }}
                  placeholder="60"
                />
              </div>
              {!isMultiSelectMode || selectedDistrictIds.length <= 1 ? (
                <div>
                  <div className="mb-1 text-[11px] font-semibold text-[color:var(--muted)]">Заметка для кухни</div>
                  <textarea
                    className="input min-h-[72px] w-full resize-y rounded-xl"
                    value={sheetNote}
                    onChange={(e) => {
                      const note = e.target.value
                      setSheetNote(note)
                      updateZoneDraftByDistrictId(activeSheetDistrict.id, {}, note)
                    }}
                    placeholder="например: только вечером, узкая дорога"
                    rows={2}
                  />
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => void saveSheetRules()}
              disabled={zoneSavingId !== null || (isMultiSelectMode && selectedDistrictIds.length === 0)}
              className="btn btn-primary mt-4 w-full rounded-full px-4 py-2.5 text-[13px] font-semibold disabled:opacity-50"
            >
              {zoneSavingId ? 'Сохраняем…' : 'Готово'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
