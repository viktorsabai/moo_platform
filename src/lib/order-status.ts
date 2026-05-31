import type { OrderStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ensureMvpTables, newId } from '@/lib/mvp-db'

const NEXT_ALLOWED: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['OUT_FOR_DELIVERY', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
}

const NEXT_ACTION_BY_STATUS: Record<string, string | null> = {
  PENDING: 'confirm',
  CONFIRMED: 'preparing',
  PREPARING: 'ready',
  READY: 'out',
  OUT_FOR_DELIVERY: 'delivered',
  DELIVERED: null,
  CANCELLED: null,
}

/** Подписи кнопок в Telegram и в админке: глагол действия, не название статуса. */
const NEXT_LABEL_BY_STATUS: Record<string, string | null> = {
  PENDING: 'Подтвердить',
  CONFIRMED: 'Начать готовить',
  PREPARING: 'Готов к выдаче',
  READY: 'Передать в доставку',
  OUT_FOR_DELIVERY: 'Отметить доставленным',
  DELIVERED: null,
  CANCELLED: null,
}

export function canTransitionOrderStatus(from: string, to: string) {
  const fromKey = String(from || '').toUpperCase()
  const toKey = String(to || '').toUpperCase()
  if (fromKey === toKey) return true
  return NEXT_ALLOWED[fromKey]?.includes(toKey) ?? false
}

export function getOrderNextAction(from: string): { action: string; toStatus: string; label: string } | null {
  const key = String(from || '').toUpperCase()
  const action = NEXT_ACTION_BY_STATUS[key]
  const label = NEXT_LABEL_BY_STATUS[key]
  if (!action || !label) return null
  const toStatus = action === 'confirm'
    ? 'CONFIRMED'
    : action === 'preparing'
      ? 'PREPARING'
      : action === 'ready'
        ? 'READY'
        : action === 'out'
          ? 'OUT_FOR_DELIVERY'
          : action === 'delivered'
            ? 'DELIVERED'
            : null
  if (!toStatus) return null
  return { action, toStatus, label }
}

export function canCancelOrderStatus(from: string) {
  return canTransitionOrderStatus(from, 'CANCELLED')
}

export async function appendOrderStatusLog(params: {
  orderId: string
  restaurantId: string
  fromStatus: string | null
  toStatus: string
  changedByUserId?: string | null
  source?: 'SYSTEM' | 'ADMIN' | 'BOT'
  comment?: string | null
}) {
  await ensureMvpTables()
  const { orderId, restaurantId, fromStatus, toStatus, changedByUserId, source = 'ADMIN', comment } = params
  await prisma.$executeRawUnsafe(
    `INSERT INTO "OrderStatusLog" ("id","orderId","restaurantId","fromStatus","toStatus","changedByUserId","source","comment")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    newId('ordlog'),
    orderId,
    restaurantId,
    fromStatus,
    toStatus,
    changedByUserId ?? null,
    source,
    comment ?? null
  )
}

export function asOrderStatus(value: string): OrderStatus {
  return value as OrderStatus
}
