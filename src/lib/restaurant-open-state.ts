export type RestaurantOpenStateInput = {
  openTime?: string | null
  closeTime?: string | null
  isOpenOverride?: boolean | null
  now?: Date
  timeZone?: string
}

export type RestaurantOpenState = {
  isOpen: boolean
  openTime: string
  closeTime: string
  timeZone: string
  reason: 'OVERRIDE' | 'SCHEDULE' | 'INVALID_SCHEDULE'
}

function minutesInRestaurantTime(now: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const hour = Number(parts.find((part) => part.type === 'hour')?.value)
  const minute = Number(parts.find((part) => part.type === 'minute')?.value)
  return Number.isFinite(hour) && Number.isFinite(minute) ? hour * 60 + minute : Number.NaN
}

export function getRestaurantOpenState(input: RestaurantOpenStateInput = {}): RestaurantOpenState {
  const openTime = String(input.openTime || '10:00')
  const closeTime = String(input.closeTime || '22:00')
  const timeZone = String(input.timeZone || process.env.RESTAURANT_TIMEZONE || 'Asia/Bangkok')
  if (typeof input.isOpenOverride === 'boolean') {
    return { isOpen: input.isOpenOverride, openTime, closeTime, timeZone, reason: 'OVERRIDE' }
  }

  const [openHour, openMinute] = openTime.split(':').map(Number)
  const [closeHour, closeMinute] = closeTime.split(':').map(Number)
  const open = openHour * 60 + openMinute
  const close = closeHour * 60 + closeMinute
  const current = minutesInRestaurantTime(input.now || new Date(), timeZone)
  if (![openHour, openMinute, closeHour, closeMinute, open, close, current].every(Number.isFinite)) {
    return { isOpen: true, openTime, closeTime, timeZone, reason: 'INVALID_SCHEDULE' }
  }
  const isOpen = open <= close ? current >= open && current < close : current >= open || current < close
  return { isOpen, openTime, closeTime, timeZone, reason: 'SCHEDULE' }
}
