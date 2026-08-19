import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export const CONTENT_SYNC_DOMAINS = {
  MENU: 'MENU',
  SUBSCRIPTION: 'SUBSCRIPTION',
} as const

export type ContentSyncDomain = (typeof CONTENT_SYNC_DOMAINS)[keyof typeof CONTENT_SYNC_DOMAINS]

export type PublishContentChangeInput = {
  restaurantId: string
  domain: ContentSyncDomain
  action: 'UPSERT' | 'DELETE' | 'PUBLISH' | 'CONFIG_CHANGED'
  entityType?: string
  entityId?: string
  payload?: Prisma.InputJsonValue
}

export async function publishRestaurantContentChange(input: PublishContentChangeInput) {
  const restaurantId = String(input.restaurantId || '').trim()
  if (!restaurantId) throw new Error('restaurantId is required')

  return prisma.$transaction(async (tx) => {
    const current = await tx.restaurantContentSyncState.upsert({
      where: { restaurantId },
      create: { restaurantId },
      update: {},
      select: { menuVersion: true, subscriptionVersion: true },
    })

    const nextVersion = input.domain === CONTENT_SYNC_DOMAINS.MENU
      ? current.menuVersion + 1
      : current.subscriptionVersion + 1

    const event = await tx.restaurantContentSyncEvent.create({
      data: {
        restaurantId,
        domain: input.domain,
        action: input.action,
        version: nextVersion,
        entityType: input.entityType || null,
        entityId: input.entityId || null,
        payload: input.payload,
      },
      select: { id: true, domain: true, action: true, version: true, createdAt: true },
    })

    const state = await tx.restaurantContentSyncState.update({
      where: { restaurantId },
      data: {
        ...(input.domain === CONTENT_SYNC_DOMAINS.MENU
          ? { menuVersion: nextVersion }
          : { subscriptionVersion: nextVersion }),
        lastEventId: event.id,
        lastPublishedAt: event.createdAt,
      },
      select: {
        restaurantId: true,
        menuVersion: true,
        subscriptionVersion: true,
        lastEventId: true,
        lastPublishedAt: true,
      },
    })

    return { state, event }
  })
}

export async function getRestaurantContentSyncState(restaurantId: string) {
  const state = await prisma.restaurantContentSyncState.findUnique({
    where: { restaurantId },
    select: {
      restaurantId: true,
      menuVersion: true,
      subscriptionVersion: true,
      lastEventId: true,
      lastPublishedAt: true,
    },
  })

  return state ?? {
    restaurantId,
    menuVersion: 0,
    subscriptionVersion: 0,
    lastEventId: null,
    lastPublishedAt: null,
  }
}

export async function listRestaurantContentSyncEvents(input: {
  restaurantId: string
  after?: string | null
  domains?: ContentSyncDomain[]
  limit?: number
}) {
  const limit = Math.min(Math.max(Number(input.limit || 50), 1), 100)
  const after = String(input.after || '').trim()
  const cursorEvent = after
    ? await prisma.restaurantContentSyncEvent.findUnique({
        where: { id: after },
        select: { createdAt: true, id: true },
      })
    : null

  const events = await prisma.restaurantContentSyncEvent.findMany({
    where: {
      restaurantId: input.restaurantId,
      ...(input.domains?.length ? { domain: { in: input.domains } } : {}),
      ...(cursorEvent ? {
        OR: [
          { createdAt: { gt: cursorEvent.createdAt } },
          { createdAt: cursorEvent.createdAt, id: { gt: cursorEvent.id } },
        ],
      } : {}),
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: limit,
    select: {
      id: true,
      domain: true,
      action: true,
      version: true,
      entityType: true,
      entityId: true,
      createdAt: true,
    },
  })

  return events
}
