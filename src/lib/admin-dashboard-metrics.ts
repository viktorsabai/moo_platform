/** Серверные метрики для hero ЛК владельца. */

export type ActivityEventForHot = {
  type: string
  userName: string | null
  telegramUsername: string | null
  telegramId: string | null
  createdAt: Date | string
}

const HOT_EVENT_TYPES = new Set(['ADD_TO_CART', 'CART_WITH_ITEMS', 'START_CHECKOUT'])

/** Уникальные гости с «горячим» интересом за последние 24ч. */
export function countHotGuestsFromActivity(events: ActivityEventForHot[]): number {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000
  const byGuest = new Map<string, { fresh: boolean; hot: boolean }>()

  for (const event of events) {
    const key = event.userName || event.telegramUsername || event.telegramId || ''
    if (!key) continue
    const at = new Date(event.createdAt).getTime()
    if (Number.isNaN(at)) continue
    const fresh = at >= cutoff
    const hot = HOT_EVENT_TYPES.has(event.type)
    const prev = byGuest.get(key) ?? { fresh: false, hot: false }
    byGuest.set(key, { fresh: prev.fresh || fresh, hot: prev.hot || hot })
  }

  let n = 0
  for (const g of byGuest.values()) {
    if (g.fresh && g.hot) n += 1
  }
  return n
}

export function inboxPendingTotal(params: {
  pendingOrders: number
  pendingSubscriptions: number
  newServiceLeads: number
  newSubscriptionRequestLeads?: number
}): number {
  return (
    params.pendingOrders +
    params.pendingSubscriptions +
    params.newServiceLeads +
    (params.newSubscriptionRequestLeads ?? 0)
  )
}
