export type ProfileSummaryData = {
  ordersCount: number
  activeSubscriptionsCount: number
  favoritesCount: number
  addressLabel?: string | null
}

type ProfileSummaryCache = {
  summary: ProfileSummaryData
  restaurantId: string
  ts: number
}

const PROFILE_SUMMARY_CACHE_TTL_MS = 5 * 60_000
const memory = new Map<string, ProfileSummaryCache>()

function userKey(userId: string) {
  return `ufo:profile:summary:v1:${userId}`
}

function storageKey(userId: string) {
  return userKey(userId)
}

export function readProfileSummaryCache(userId: string): ProfileSummaryCache | null {
  const key = userKey(userId)
  const now = Date.now()
  const mem = memory.get(key)
  if (mem && now - mem.ts < PROFILE_SUMMARY_CACHE_TTL_MS) return mem
  if (typeof window === 'undefined') return mem ?? null
  try {
    const raw = window.sessionStorage.getItem(storageKey(userId))
    if (!raw) return mem ?? null
    const parsed = JSON.parse(raw) as ProfileSummaryCache
    if (!parsed?.summary || now - parsed.ts >= PROFILE_SUMMARY_CACHE_TTL_MS) return mem ?? null
    memory.set(key, parsed)
    return parsed
  } catch {
    return mem ?? null
  }
}

export function writeProfileSummaryCache(
  userId: string,
  summary: ProfileSummaryData,
  restaurantId: string
) {
  const payload: ProfileSummaryCache = {
    summary,
    restaurantId,
    ts: Date.now(),
  }
  const key = userKey(userId)
  memory.set(key, payload)
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(storageKey(userId), JSON.stringify(payload))
  } catch {
    // ignore webview storage limits
  }
}

export function clearProfileSummaryCache() {
  memory.clear()
}
