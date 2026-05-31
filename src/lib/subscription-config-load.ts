import { prisma } from '@/lib/prisma'
import { defaultSubscriptionConfig, parseSubscriptionConfig, type SubscriptionConfig } from '@/lib/subscription-config'

export async function loadSubscriptionConfig(restaurantId: string): Promise<SubscriptionConfig> {
  const settings = await prisma.appSettings.findUnique({
    where: { restaurantId },
    select: { subscriptionConfigJson: true },
  })
  return parseSubscriptionConfig(settings?.subscriptionConfigJson ?? null)
}

export async function saveSubscriptionConfig(
  restaurantId: string,
  config: SubscriptionConfig
): Promise<SubscriptionConfig> {
  const parsed = parseSubscriptionConfig(config)
  await prisma.appSettings.upsert({
    where: { restaurantId },
    create: { restaurantId, subscriptionConfigJson: parsed as object },
    update: { subscriptionConfigJson: parsed as object },
  })
  return parsed
}

export { defaultSubscriptionConfig, parseSubscriptionConfig }
