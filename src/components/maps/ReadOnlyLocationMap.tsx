'use client'

import { LazyPhuketMap, RU_MAP_LABELS } from '@/components/maps/phuket/LazyPhuketMap'

type Props = {
  lat: number
  lng: number
}

export function ReadOnlyLocationMap({ lat, lng }: Props) {
  return (
    <div className="h-48 overflow-hidden rounded-[16px]">
      <LazyPhuketMap
        locale="ru"
        pins={[]}
        districts={[]}
        fit={{ lat, lng, zoom: 4 }}
        marker={{ lat, lng, label: 'вы здесь' }}
        labels={RU_MAP_LABELS}
        showGrid={false}
        interactive
      />
    </div>
  )
}
