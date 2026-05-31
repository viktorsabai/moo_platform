'use client'

import { cn } from '@/lib/utils'
import { PHUKET_DISTRICT_SVG_META } from '@/lib/phuket-districts'

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
  const configured = new Set(configuredDistrictIds)
  const inactive = new Set(inactiveDistrictIds)
  const selectedSet = new Set(selectedDistrictIds)
  const hasMultiSelection = selectedSet.size > 0
  const hasAnySelection = hasMultiSelection || Boolean(selectedDistrictId)
  const width = 500
  const height = 1000

  return (
    <div>
      <div className="mb-2 text-[12px] text-[color:var(--muted)]">Тапните район и задайте правила ниже.</div>

      <div className="overflow-hidden rounded-xl border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] p-2">
        <svg viewBox={`0 0 ${width} ${height}`} xmlns="http://www.w3.org/2000/svg" className="h-[380px] w-full">
          <rect x="0" y="0" width={width} height={height} fill="color-mix(in srgb, var(--surface) 88%, var(--bg) 12%)" />
          {districts.map((d) => {
            const isSelected = hasMultiSelection ? selectedSet.has(d.id) : d.id === selectedDistrictId
            const isConfigured = configured.has(d.id)
            const isInactive = inactive.has(d.id)
            const isHome = homeDistrictId === d.id
            const districtPrice = Number(priceByDistrictId[d.id] ?? (isConfigured ? 100 : 0))
            const heatFill = isInactive
              ? '#9E9E9E'
              : districtPrice <= 0
                ? '#4CAF50'
                : '#FF9800'
            const meta = PHUKET_DISTRICT_SVG_META[d.id]
            if (!meta) return null
            return (
              <g key={d.id}>
                <path
                  d={meta.d}
                  onClick={() => onSelectDistrict(d.id)}
                  className="cursor-pointer"
                  fill="transparent"
                  stroke="transparent"
                  strokeWidth={14}
                />
                <path
                  id={d.id}
                  d={meta.d}
                  onClick={() => onSelectDistrict(d.id)}
                  className="cursor-pointer transition-opacity duration-150"
                  fill={heatFill}
                  stroke={
                    isSelected
                      ? isInactive
                        ? '#4b5563'
                        : 'var(--accent-strong)'
                      : 'color-mix(in srgb, var(--stroke-strong) 55%, white 45%)'
                  }
                  strokeWidth={isSelected ? 4 : 2}
                  opacity={isSelected ? 1 : hasAnySelection ? 0.32 : 0.86}
                />
                <text
                  x={meta.labelX}
                  y={meta.labelY}
                  className={cn(
                    'pointer-events-none select-none text-[11px] font-semibold uppercase',
                    isSelected ? 'fill-white' : 'fill-[color:var(--text)]'
                  )}
                  textAnchor="middle"
                  transform={meta.rotate ? `rotate(${meta.rotate} ${meta.labelX} ${meta.labelY})` : undefined}
                >
                  {meta.label || d.name}
                </text>
                {isHome ? (
                  <g>
                    <circle
                      cx={meta.labelX}
                      cy={meta.labelY - 14}
                      r={8}
                      fill="color-mix(in srgb, var(--accent) 25%, transparent)"
                      stroke="none"
                    />
                    <circle
                      cx={meta.labelX}
                      cy={meta.labelY - 14}
                      r={4.5}
                      fill="var(--accent-strong)"
                      stroke="white"
                      strokeWidth={1.5}
                    />
                  </g>
                ) : null}
              </g>
            )
          })}
        </svg>
      </div>

      {showDistrictChips ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {districts.map((d) => {
            const active = d.id === selectedDistrictId
            const isConfigured = configured.has(d.id)
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => onSelectDistrict(d.id)}
                className={
                  active
                    ? 'rounded-full border border-[color:var(--accent-strong)] bg-[color:var(--accent)] px-2.5 py-1 text-[11px] font-semibold text-white'
                    : isConfigured
                      ? 'rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--text)]'
                      : 'rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--muted)]'
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
