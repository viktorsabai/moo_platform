'use client'

import { useMemo } from 'react'
import { DISTRICT_GEOMETRY_BY_ID } from '@/lib/delivery-zone-helpers'
import { LazyPhuketMap, RU_MAP_LABELS } from '@/components/maps/phuket/LazyPhuketMap'
import type { MapDistrict } from '@/components/maps/phuket/PhuketMap'

export type PhuketSvgDistrict = {
  id: string
  name: string
}

type Props = {
  districts: PhuketSvgDistrict[]
  selectedDistrictId: string | null
  selectedDistrictIds?: string[]
  onSelectDistrict: (id: string) => void
  configuredDistrictIds?: string[]
  inactiveDistrictIds?: string[]
  priceByDistrictId?: Record<string, number>
  homeDistrictId?: string | null
  showDistrictChips?: boolean
}

function centroid(id: string): { lat: number; lng: number } | null {
  const ring = DISTRICT_GEOMETRY_BY_ID[id]?.coordinates?.[0]
  if (!ring?.length) return null
  const pts = ring.slice(0, -1)
  return {
    lng: pts.reduce((n, p) => n + p[0], 0) / pts.length,
    lat: pts.reduce((n, p) => n + p[1], 0) / pts.length,
  }
}

/** Выбор районов доставки на карте острова: точка района, цена рядом, цвет = бесплатно / платно / выключен. */
export function PhuketDistrictSvgPicker({
  districts,
  selectedDistrictId,
  selectedDistrictIds = [],
  onSelectDistrict,
  configuredDistrictIds = [],
  inactiveDistrictIds = [],
  priceByDistrictId = {},
  homeDistrictId = null,
  showDistrictChips = false,
}: Props) {
  const configured = useMemo(() => new Set(configuredDistrictIds), [configuredDistrictIds])
  const inactive = useMemo(() => new Set(inactiveDistrictIds), [inactiveDistrictIds])

  const mapDistricts = useMemo<MapDistrict[]>(
    () =>
      districts.flatMap((d) => {
        const c = centroid(d.id)
        if (!c) return []
        const isConfigured = configured.has(d.id)
        const price = Number(priceByDistrictId[d.id] ?? (isConfigured ? 100 : 0))
        const off = inactive.has(d.id)
        return [
          {
            id: d.id,
            name: { ru: d.name, en: d.name },
            lat: c.lat,
            lng: c.lng,
            badge: isConfigured ? (price <= 0 ? 'бесплатно' : `${price} ฿`) : undefined,
            tone: off ? 'off' : isConfigured ? (price <= 0 ? 'free' : 'paid') : undefined,
            home: homeDistrictId === d.id,
          } satisfies MapDistrict,
        ]
      }),
    [districts, configured, inactive, priceByDistrictId, homeDistrictId]
  )

  const selectedIds = selectedDistrictIds.length ? selectedDistrictIds : selectedDistrictId ? [selectedDistrictId] : []

  return (
    <div>
      <div className="mb-2 text-[12px] text-[color:var(--muted)]">Тапните район и задайте правила ниже.</div>
      <div className="h-[380px] w-full">
        <LazyPhuketMap
          locale="ru"
          pins={[]}
          districts={mapDistricts}
          selectedIds={selectedIds}
          onPickDistrict={onSelectDistrict}
          fit="island"
          labels={RU_MAP_LABELS}
          showGrid={false}
        />
      </div>

      {showDistrictChips ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {districts.map((d) => {
            const active = d.id === selectedDistrictId
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => onSelectDistrict(d.id)}
                aria-pressed={active}
                className={
                  active
                    ? 'min-h-[36px] rounded-full bg-[color:var(--primary)] px-3 text-[12px] font-semibold text-[color:var(--on-primary)]'
                    : 'min-h-[36px] rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] px-3 text-[12px] font-semibold text-[color:var(--text)]'
                }
              >
                {d.name}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
