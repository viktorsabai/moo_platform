'use client'

import { useEffect, useMemo, useState } from 'react'
import { CircleMarker, MapContainer, Polygon, TileLayer, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

type LatLng = [number, number]

type Props = {
  value: string | null | undefined
  onChange: (nextPolygonJson: string | null) => void
}

const PHUKET_CENTER: LatLng = [7.9519, 98.3381]

function parsePolygonJson(input: string | null | undefined): LatLng[] {
  if (!input || !input.trim()) return []
  try {
    const parsed = JSON.parse(input)
    const coords = parsed?.coordinates?.[0]
    if (parsed?.type !== 'Polygon' || !Array.isArray(coords)) return []
    return coords
      .map((pair: unknown) => {
        if (!Array.isArray(pair) || pair.length < 2) return null
        const lng = Number(pair[0])
        const lat = Number(pair[1])
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
        return [lat, lng] as LatLng
      })
      .filter(Boolean) as LatLng[]
  } catch {
    return []
  }
}

function toGeoJson(points: LatLng[]): string | null {
  if (points.length < 3) return null
  const raw = points.map(([lat, lng]) => [lng, lat])
  const first = raw[0]
  const last = raw[raw.length - 1]
  const isClosed = first[0] === last[0] && first[1] === last[1]
  const ring = isClosed ? raw : [...raw, first]
  return JSON.stringify({ type: 'Polygon', coordinates: [ring] })
}

function MapClicks({ onClick }: { onClick: (point: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onClick([e.latlng.lat, e.latlng.lng])
    },
  })
  return null
}

export function DeliveryZoneMapEditor({ value, onChange }: Props) {
  const [points, setPoints] = useState<LatLng[]>(() => parsePolygonJson(value))
  const center = useMemo<LatLng>(() => points[0] ?? PHUKET_CENTER, [points])
  const polygon = useMemo(() => points, [points])

  useEffect(() => {
    setPoints(parsePolygonJson(value))
  }, [value])

  function update(next: LatLng[]) {
    setPoints(next)
    onChange(toGeoJson(next))
  }

  return (
    <div className="rounded-xl border border-[color:var(--stroke)] bg-[color:var(--surface)] p-2">
      <div className="mb-2 text-[12px] text-[color:var(--muted)]">
        Кликните по карте минимум 3 точки, чтобы задать зону.
      </div>
      <div className="h-56 overflow-hidden rounded-lg border border-[color:var(--stroke)]">
        <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClicks onClick={(point) => update([...points, point])} />
          {polygon.length >= 3 ? (
            <Polygon positions={polygon} pathOptions={{ color: '#4f46e5', weight: 2, fillOpacity: 0.2 }} />
          ) : null}
          {points.map((point, idx) => (
            <CircleMarker
              key={`${point[0]}_${point[1]}_${idx}`}
              center={point}
              radius={4}
              pathOptions={{ color: '#111827', fillColor: '#111827', fillOpacity: 0.95 }}
            />
          ))}
        </MapContainer>
      </div>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          className="btn btn-soft rounded-full px-3 py-1.5 text-[12px]"
          onClick={() => update(points.slice(0, -1))}
          disabled={points.length === 0}
        >
          убрать точку
        </button>
        <button
          type="button"
          className="btn btn-soft rounded-full px-3 py-1.5 text-[12px]"
          onClick={() => update([])}
          disabled={points.length === 0}
        >
          очистить
        </button>
      </div>
    </div>
  )
}
