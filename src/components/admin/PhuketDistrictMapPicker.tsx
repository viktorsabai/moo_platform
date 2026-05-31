'use client'

import { MapContainer, Polygon, TileLayer, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

type LatLng = [number, number]

export type PhuketDistrict = {
  id: string
  name: string
  polygon: LatLng[]
}

type Props = {
  districts: PhuketDistrict[]
  selectedDistrictId: string | null
  onSelectDistrict: (id: string) => void
}

const CENTER: LatLng = [7.92, 98.35]

function polygonCenter(points: LatLng[]): LatLng {
  if (!points.length) return CENTER
  const acc = points.reduce(
    (sum, [lat, lng]) => ({ lat: sum.lat + lat, lng: sum.lng + lng }),
    { lat: 0, lng: 0 }
  )
  return [acc.lat / points.length, acc.lng / points.length]
}

export function PhuketDistrictMapPicker({ districts, selectedDistrictId, onSelectDistrict }: Props) {
  return (
    <div className="rounded-xl border border-[color:var(--stroke)] bg-[color:var(--surface)] p-2">
      <div className="mb-2 text-[12px] text-[color:var(--muted)]">
        Тапните на район на карте и задайте правила доставки.
      </div>
      <div className="h-72 overflow-hidden rounded-lg border border-[color:var(--stroke)]">
        <MapContainer center={CENTER} zoom={10} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {districts.map((d) => {
            const selected = d.id === selectedDistrictId
            const center = polygonCenter(d.polygon)
            return (
              <Polygon
                key={d.id}
                positions={d.polygon}
                eventHandlers={{ click: () => onSelectDistrict(d.id) }}
                pathOptions={{
                  color: selected ? '#1d4ed8' : '#64748b',
                  weight: selected ? 3 : 2,
                  fillOpacity: selected ? 0.24 : 0.12,
                }}
              >
                <Tooltip
                  permanent
                  direction="center"
                  position={center}
                  opacity={selected ? 0.95 : 0.72}
                  className={selected ? 'district-tip district-tip--active' : 'district-tip'}
                >
                  {d.name}
                </Tooltip>
              </Polygon>
            )
          })}
        </MapContainer>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {districts.map((d) => {
          const active = d.id === selectedDistrictId
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => onSelectDistrict(d.id)}
              className={
                active
                  ? 'rounded-full border border-[color:var(--accent-strong)] bg-[color:var(--accent)] px-2.5 py-1 text-[11px] font-semibold text-white'
                  : 'rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--text)]'
              }
            >
              {d.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
