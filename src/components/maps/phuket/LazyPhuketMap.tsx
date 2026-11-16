'use client'

import dynamic from 'next/dynamic'

/** Карта тянет ~270 КБ геоданных — грузим только на экранах, где она нужна. */
export const LazyPhuketMap = dynamic(() => import('./PhuketMap').then((m) => m.PhuketMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[320px] w-full items-center justify-center rounded-[20px] border border-[color:var(--stroke)] text-[13px] text-[color:var(--muted)]">
      загружаю карту…
    </div>
  ),
})

export const RU_MAP_LABELS = {
  sea: 'Андаманское море',
  north: 'С',
  km: 'км',
  zoomIn: 'Увеличить',
  zoomOut: 'Уменьшить',
  ariaLabel: 'Карта Пхукета',
  attribution: '© OpenStreetMap contributors',
}
