import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(price?: unknown): string {
  const n = typeof price === 'number'
    ? price
    : typeof price === 'string'
      ? Number(price)
      : NaN

  const safe = Number.isFinite(n) ? n : 0
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(safe)} ฿`
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date))
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

const WEEKDAYS_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

/** Nearest event label for subscription card: "доставка сегодня 13:00", "следующая доставка в ср", etc. */
export function getNearestEventLabel(
  nextDelivery: Date | string | undefined,
  deliveryTime: string | undefined
): string {
  if (!nextDelivery) return 'ближайшая доставка —'
  const d = new Date(nextDelivery)
  const today = new Date()
  const isToday =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  const time = deliveryTime ? ` ${deliveryTime}` : ''
  if (isToday) return `доставка сегодня${time}`
  const w = WEEKDAYS_SHORT[d.getDay()]
  return `следующая доставка ${w}${time}`
}
