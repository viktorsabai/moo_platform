/**
 * Helpers for SubscriptionDelivery: compute scheduled dates and create records.
 * deliveryDays: 0=Sun, 1=Mon, .. 6=Sat (matches JS Date.getDay).
 */

/**
 * Compute delivery dates for the next N weeks based on deliveryDays and startFrom.
 * deliveryDays: 0=Sun, 1=Mon, .. 6=Sat.
 */
export function getScheduledDeliveryDates(
  deliveryDays: number[],
  startFrom: Date,
  weeks = 4
): Date[] {
  if (!deliveryDays.length) return []
  const daySet = new Set(deliveryDays)
  const result: Date[] = []
  const d = new Date(startFrom)
  d.setHours(12, 0, 0, 0)
  const end = new Date(d)
  end.setDate(end.getDate() + weeks * 7)
  while (d < end) {
    if (daySet.has(d.getDay())) result.push(new Date(d))
    d.setDate(d.getDate() + 1)
  }
  return result
}
