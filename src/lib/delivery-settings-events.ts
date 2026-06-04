/** Сигнал для гостевых экранов: зоны или базовые тарифы изменились в админке. */
export const DELIVERY_SETTINGS_CHANGED_EVENT = 'ufo:delivery-settings-changed'

export function dispatchDeliverySettingsChanged() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem('ufo:delivery:rev', String(Date.now()))
  } catch {
    // ignore
  }
  window.dispatchEvent(new CustomEvent(DELIVERY_SETTINGS_CHANGED_EVENT))
}

export function readDeliverySettingsRevision(): string {
  if (typeof window === 'undefined') return '0'
  try {
    return window.localStorage.getItem('ufo:delivery:rev') || '0'
  } catch {
    return '0'
  }
}
