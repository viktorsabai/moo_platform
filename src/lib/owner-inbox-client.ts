/** Клиентский «прочитано» для короны — синхронизируется с блоком входящих в /admin. */

export const OWNER_INBOX_SEEN_EVENT = 'ufo:owner-inbox-seen'

export type OwnerInboxItemKind = 'order' | 'subscription' | 'lead'

export type OwnerInboxItemClient = {
  kind: OwnerInboxItemKind
  id: string
  label: string
  subtitle?: string
  href: string
  createdAt: string
}

const STORAGE_KEY = 'ufo:owner-inbox-seen:v2'

type SeenStore = Record<string, string[]>

function itemKey(item: Pick<OwnerInboxItemClient, 'kind' | 'id'>): string {
  return `${item.kind}:${item.id}`
}

function readStore(): SeenStore {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as SeenStore
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeStore(store: SeenStore) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // ignore quota
  }
}

export function getSeenInboxKeys(restaurantId: string): Set<string> {
  const keys = readStore()[restaurantId]
  return new Set(Array.isArray(keys) ? keys : [])
}

export function markOwnerInboxSeen(restaurantId: string, items: Pick<OwnerInboxItemClient, 'kind' | 'id'>[]) {
  if (!restaurantId || restaurantId === 'default') return
  const store = readStore()
  const prev = new Set(store[restaurantId] ?? [])
  for (const item of items) prev.add(itemKey(item))
  store[restaurantId] = [...prev]
  writeStore(store)
  window.dispatchEvent(new CustomEvent(OWNER_INBOX_SEEN_EVENT, { detail: { restaurantId } }))
}

export function countUnseenInboxItems(
  restaurantId: string,
  items: Pick<OwnerInboxItemClient, 'kind' | 'id'>[]
): number {
  if (!restaurantId || restaurantId === 'default') return 0
  const seen = getSeenInboxKeys(restaurantId)
  return items.filter((item) => !seen.has(itemKey(item))).length
}

export function filterUnseenInboxItems(
  restaurantId: string,
  items: OwnerInboxItemClient[]
): OwnerInboxItemClient[] {
  if (!restaurantId || restaurantId === 'default') return []
  const seen = getSeenInboxKeys(restaurantId)
  return items.filter((item) => !seen.has(itemKey(item)))
}

export function inboxBreakdownFromItems(items: OwnerInboxItemClient[]) {
  return {
    orders: items.filter((i) => i.kind === 'order').length,
    subscriptions: items.filter((i) => i.kind === 'subscription').length,
    leads: items.filter((i) => i.kind === 'lead').length,
  }
}
