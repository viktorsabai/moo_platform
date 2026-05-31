'use client'

import { CircleMarker, MapContainer, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

type Props = {
  lat: number
  lng: number
}

export function ReadOnlyLocationMap({ lat, lng }: Props) {
  return (
    <div className="h-44 overflow-hidden rounded-xl border border-[color:var(--stroke)]">
      <MapContainer center={[lat, lng]} zoom={15} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <CircleMarker
          center={[lat, lng]}
          radius={7}
          pathOptions={{
            color: '#1d4ed8',
            weight: 2,
            fillColor: '#1d4ed8',
            fillOpacity: 0.35,
          }}
        />
      </MapContainer>
    </div>
  )
}
