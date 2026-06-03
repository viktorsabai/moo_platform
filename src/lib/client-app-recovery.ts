/** Безопасный сброс локальных данных приложения (не трогает сессию и httpOnly cookie). */
export function softResetClientApp(targetPath = '/profile/owner') {
  const storageKeys = [
    'cart-storage',
    'orders-storage',
    'subscriptions-storage',
    'ufo:venue:context:v1',
    'tg_user',
  ]
  for (const key of storageKeys) {
    try {
      localStorage.removeItem(key)
    } catch {
      // ignore
    }
  }
  try {
    window.location.assign(targetPath)
  } catch {
    try {
      window.location.href = targetPath
    } catch {
      // ignore
    }
  }
}
