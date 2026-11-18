export type Tone = 'ok' | 'warn' | 'danger' | 'muted'

/** Подписи статусов заказа для кабинета: коротко и по-русски. */
export const ORDER_STATE: Record<string, { label: string; tone: Tone }> = {
  PENDING: { label: 'новый', tone: 'warn' },
  CONFIRMED: { label: 'принят', tone: 'ok' },
  PREPARING: { label: 'готовим', tone: 'warn' },
  READY: { label: 'готов', tone: 'ok' },
  OUT_FOR_DELIVERY: { label: 'в пути', tone: 'ok' },
  DELIVERED: { label: 'доставлен', tone: 'muted' },
  CANCELLED: { label: 'отменён', tone: 'danger' },
}

export const ORDER_STEPS: Array<{ status: string; label: string }> = [
  { status: 'CONFIRMED', label: 'принят' },
  { status: 'PREPARING', label: 'готовим' },
  { status: 'READY', label: 'готов' },
  { status: 'OUT_FOR_DELIVERY', label: 'в пути' },
  { status: 'DELIVERED', label: 'у гостя' },
]

/** Главная кнопка карточки: одно действие на статус. */
export const ORDER_NEXT: Record<string, { to: string; label: string } | null> = {
  PENDING: { to: 'CONFIRMED', label: 'принять заказ' },
  CONFIRMED: { to: 'PREPARING', label: 'начать готовить' },
  PREPARING: { to: 'READY', label: 'готово' },
  READY: { to: 'OUT_FOR_DELIVERY', label: 'передать курьеру' },
  OUT_FOR_DELIVERY: { to: 'DELIVERED', label: 'доставлен' },
  DELIVERED: null,
  CANCELLED: null,
}
