import { prisma } from '@/lib/prisma'
import { getScheduledDeliveryDates } from '@/lib/subscription-deliveries'

export async function scheduleDeliveriesForSubscription(
  subscriptionId: string,
  deliveryDays: number[],
  startFrom: Date,
  periodDays: number
) {
  if (!deliveryDays.length) return 0
  const weeks = Math.max(4, Math.ceil(periodDays / 7))
  const dates = getScheduledDeliveryDates(deliveryDays, startFrom, weeks)
  if (!dates.length) return 0
  await prisma.subscriptionDelivery.createMany({
    data: dates.map((scheduledDate) => ({
      subscriptionId,
      scheduledDate,
      status: 'SCHEDULED' as const,
    })),
  })
  return dates.length
}

export async function activatePendingSubscription(subscriptionId: string, restaurantId: string) {
  const sub = await prisma.subscription.findFirst({
    where: { id: subscriptionId, restaurantId, status: 'PENDING' },
    select: {
      id: true,
      deliveryDays: true,
      startDate: true,
      nextDelivery: true,
      periodDays: true,
    },
  })
  if (!sub) throw new Error('Подписка не найдена или уже обработана')

  const startFrom = sub.nextDelivery ?? sub.startDate ?? new Date()
  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: 'ACTIVE',
      startDate: startFrom,
      nextDelivery: startFrom,
    },
  })
  await scheduleDeliveriesForSubscription(subscriptionId, sub.deliveryDays, startFrom, sub.periodDays)
  return sub
}

export async function rejectPendingSubscription(subscriptionId: string, restaurantId: string) {
  const sub = await prisma.subscription.findFirst({
    where: { id: subscriptionId, restaurantId, status: 'PENDING' },
    select: { id: true },
  })
  if (!sub) throw new Error('Подписка не найдена или уже обработана')
  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: { status: 'CANCELLED' },
  })
}
