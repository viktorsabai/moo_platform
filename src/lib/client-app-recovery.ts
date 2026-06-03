import { dispatchVenueRebootstrap } from '@/lib/venue-bootstrap'

export type SoftResetOptions = {
  /** Куда перейти после сброса. По умолчанию — главная. */
  redirect?: string
}

/** Сброс только локального кэша UI. Сессия и httpOnly cookie заведения не трогаем. */
export function softResetClientApp(options: SoftResetOptions = {}) {
  const redirect = options.redirect ?? '/'

  const localKeys = ['cart-storage', 'orders-storage', 'subscriptions-storage', 'ufo:venue:context:v1']
  for (const key of localKeys) {
    try {
      localStorage.removeItem(key)
    } catch {
      // ignore
    }
  }

  if (typeof window !== 'undefined') {
    try {
      const ss = window.sessionStorage
      const toRemove: string[] = []
      for (let i = 0; i < ss.length; i++) {
        const k = ss.key(i)
        if (k && k.startsWith('ufo:')) toRemove.push(k)
      }
      for (const k of toRemove) ss.removeItem(k)
    } catch {
      // ignore
    }
  }

  dispatchVenueRebootstrap()

  try {
    window.location.assign(redirect)
  } catch {
    try {
      window.location.href = redirect
    } catch {
      // ignore
    }
  }
}
