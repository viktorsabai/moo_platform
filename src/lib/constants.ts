// Константы приложения

export const ORDER_STATUSES = {
  PENDING: 'Ожидает подтверждения',
  CONFIRMED: 'Подтвержден',
  PREPARING: 'Готовится',
  READY: 'Готов',
  OUT_FOR_DELIVERY: 'В пути',
  DELIVERED: 'Доставлен',
  CANCELLED: 'Отменен',
} as const

export const PAYMENT_STATUSES = {
  PENDING: 'Ожидает оплаты',
  AWAITING_RECEIPT: 'Ждём чек перевода',
  UNDER_REVIEW: 'Проверка оплаты',
  PAID: 'Оплачен',
  FAILED: 'Ошибка оплаты',
  REFUNDED: 'Возвращен',
} as const

export const SUBSCRIPTION_PLANS = {
  WEEKLY: 'Еженедельная',
  BIWEEKLY: 'Раз в две недели',
  MONTHLY: 'Ежемесячная',
} as const

export const SUBSCRIPTION_STATUSES = {
  ACTIVE: 'Активна',
  PENDING: 'На подтверждении',
  PAUSED: 'Приостановлена',
  CANCELLED: 'Отменена',
  EXPIRED: 'Истекла',
  DRAFT: 'Черновик',
} as const

/** Dashboard filter labels (strict: активная, закончилась, черновик). PAUSED not shown as separate type. */
export const SUBSCRIPTION_STATUS_FILTERS = {
  active: 'активная',
  pending: 'на подтверждении',
  ended: 'закончилась',
  draft: 'черновик',
} as const

/** Map backend status to dashboard filter key. */
export const SUBSCRIPTION_STATUS_TO_FILTER: Record<string, 'active' | 'pending' | 'ended' | 'draft'> = {
  ACTIVE: 'active',
  PAUSED: 'active',
  PENDING: 'pending',
  EXPIRED: 'ended',
  CANCELLED: 'ended',
  DRAFT: 'draft',
}

export const DELIVERY_STATUSES = {
  SCHEDULED: 'Запланирована',
  CONFIRMED: 'Подтверждена',
  DELIVERED: 'Доставлена',
  SKIPPED: 'Пропущена',
  CANCELLED: 'Отменена',
} as const

// Дни недели для доставок
export const WEEKDAYS = [
  'Воскресенье',
  'Понедельник',
  'Вторник',
  'Среда',
  'Четверг',
  'Пятница',
  'Суббота',
] as const

export const MIN_ORDER_AMOUNT = 500 // Минимальная сумма заказа в рублях
export const DELIVERY_FEE = 150 // Стоимость доставки в рублях
export const FREE_DELIVERY_THRESHOLD = 1500 // Бесплатная доставка от этой суммы







