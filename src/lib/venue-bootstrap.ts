/** Восстановление cookie заведения из Telegram / single-tenant (как меню — с сервера). */

export type VenueBootstrapResult = {
  restaurantId: string
  name?: string
}

export function readTelegramStartParam(): string {
  if (typeof window === 'undefined') return ''
  try {
    const qs = new URLSearchParams(window.location.search)
    return String(qs.get('startapp') || qs.get('start_param') || '').trim()
  } catch {
    return ''
  }
}

export function readTelegramInitDataClient(): string {
  if (typeof window === 'undefined') return ''
  try {
    return String((window as any)?.Telegram?.WebApp?.initData || '')
  } catch {
    return ''
  }
}

export async function bootstrapVenueCookie(): Promise<VenueBootstrapResult | null> {
  if (typeof window === 'undefined') return null
  const initData = readTelegramInitDataClient()
  const startParam = readTelegramStartParam()
  if (!initData && !startParam) return null

  try {
    const res = await fetch('/api/venue/init', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      cache: 'no-store',
      body: JSON.stringify({
        ...(initData ? { initData } : {}),
        ...(startParam ? { startParam } : {}),
      }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.ok || !data.restaurantId || data.restaurantId === 'default') return null
    return { restaurantId: String(data.restaurantId), name: data.name ? String(data.name) : undefined }
  } catch {
    return null
  }
}

export const VENUE_REBOOTSTRAP_EVENT = 'ufo:venue:rebootstrap'

export function dispatchVenueRebootstrap() {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new CustomEvent(VENUE_REBOOTSTRAP_EVENT))
  } catch {
    // ignore
  }
}
