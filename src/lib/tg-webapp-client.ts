/** Client-only helpers for Telegram WebApp auth headers consumed by `resolveApiUser`. */

export function readTelegramInitData(): string {
  if (typeof window === 'undefined') return ''
  try {
    return String((window as unknown as { Telegram?: { WebApp?: { initData?: string } } })?.Telegram?.WebApp?.initData || '')
  } catch {
    return ''
  }
}

/** Pass spread into `headers` for `fetch` to authenticated consumer APIs. */
export function telegramInitHeaderRecord(): Record<string, string> {
  const initData = readTelegramInitData()
  if (!initData) return {}
  return { 'x-telegram-init-data': initData }
}
