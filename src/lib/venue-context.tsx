'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react'
import { usePathname } from 'next/navigation'
import { useCartStore } from '@/store/cart-store'

export type VenueSettings = {
  menuEnabled: boolean
  storeEnabled: boolean
  subscriptionEnabled: boolean
}

export type VenueContextValue = {
  restaurantId: string
  name?: string
  settings: VenueSettings
  isLoading: boolean
  error: boolean
  refetch: () => Promise<void>
}

const defaultSettings: VenueSettings = {
  menuEnabled: false,
  storeEnabled: true,
  subscriptionEnabled: false,
}

const defaultValue: VenueContextValue = {
  restaurantId: 'default',
  name: undefined,
  settings: defaultSettings,
  isLoading: true,
  error: false,
  refetch: async () => {},
}

const VenueContext = createContext<VenueContextValue>(defaultValue)
const VENUE_CACHE_KEY = 'ufo:venue:context:v1'

type VenueCache = {
  restaurantId: string
  name?: string
  settings: VenueSettings
  ts: number
}

function readVenueCache(): VenueCache | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(VENUE_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as VenueCache
    if (!parsed?.restaurantId || parsed.restaurantId === 'default') return null
    return parsed
  } catch {
    return null
  }
}

function writeVenueCache(value: VenueCache) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(VENUE_CACHE_KEY, JSON.stringify(value))
  } catch {
    // ignore storage failures in Telegram webview
  }
}

function clearVenueCache() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(VENUE_CACHE_KEY)
  } catch {
    // ignore storage failures in Telegram webview
  }
}

function isOwnerPath(pathname: string) {
  return pathname.startsWith('/admin') || pathname === '/profile/owner' || pathname === '/platform'
}

export function VenueProvider({ children }: { children: ReactNode }) {
  const [restaurantId, setRestaurantId] = useState<string>('default')
  const [name, setName] = useState<string | undefined>(undefined)
  const [settings, setSettings] = useState<VenueSettings>(defaultSettings)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)
  const lastValidRestaurantIdRef = useRef<string | null>(null)

  const fetchContext = useCallback(async () => {
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : ''
    const inOwnerContext = isOwnerPath(currentPath)
    const cached = inOwnerContext ? null : readVenueCache()
    const hasStableVenue = Boolean(lastValidRestaurantIdRef.current || cached?.restaurantId)
    if (cached && !lastValidRestaurantIdRef.current) {
      lastValidRestaurantIdRef.current = cached.restaurantId
      setRestaurantId(cached.restaurantId)
      setName(cached.name)
      setSettings(cached.settings)
    }
    setIsLoading(!hasStableVenue)
    setError(false)
    try {
      let explicitRestaurantId = inOwnerContext ? '' : cached?.restaurantId || lastValidRestaurantIdRef.current || ''
      // Set venue cookie from Telegram startParam when available (before context fetch)
      const tg = (typeof window !== 'undefined' ? (window as any)?.Telegram?.WebApp : null) as { initData?: string } | null
      const initData = tg?.initData
      const queryStartParam = (() => {
        if (typeof window === 'undefined') return ''
        try {
          const qs = new URLSearchParams(window.location.search)
          return String(qs.get('startapp') || qs.get('start_param') || '').trim()
        } catch {
          return ''
        }
      })()
      if (initData && !inOwnerContext) {
        try {
          const initRes = await fetch('/api/venue/init', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ initData, startParam: queryStartParam || undefined }),
            cache: 'no-store',
            credentials: 'include',
          })
          if (initRes.ok) {
            const initDataRes = await initRes.json().catch(() => null)
            if (initDataRes?.name) setName(initDataRes.name)
            if (initDataRes?.restaurantId && initDataRes.restaurantId !== 'default') {
              explicitRestaurantId = String(initDataRes.restaurantId)
              lastValidRestaurantIdRef.current = explicitRestaurantId
            }
          }
        } catch {
          // ignore init failure, proceed with context
        }
      } else if (queryStartParam && !inOwnerContext) {
        // Fallback: WebApp can be opened from URL with ?startapp=... even when initData has no start_param.
        try {
          const initRes = await fetch('/api/venue/init', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ startParam: queryStartParam }),
            cache: 'no-store',
            credentials: 'include',
          })
          if (initRes.ok) {
            const initDataRes = await initRes.json().catch(() => null)
            if (initDataRes?.name) setName(initDataRes.name)
            if (initDataRes?.restaurantId && initDataRes.restaurantId !== 'default') {
              explicitRestaurantId = String(initDataRes.restaurantId)
              lastValidRestaurantIdRef.current = explicitRestaurantId
            }
          }
        } catch {
          // ignore init failure, proceed with context
        }
      }

      const contextFetchOptions = () => ({
        cache: 'no-store' as RequestCache,
        credentials: 'include' as RequestCredentials,
        headers:
          String(process.env.NEXT_PUBLIC_UFO_ALLOW_HEADER_CONTEXT || '').toLowerCase() === 'true' &&
          explicitRestaurantId
            ? { 'x-ufo-restaurant': explicitRestaurantId }
            : undefined,
      })
      const contextUrl = inOwnerContext ? '/api/owner/venue/context' : '/api/venue/context'
      let res = await fetch(contextUrl, contextFetchOptions())
      let data = await res.json().catch(() => null)
      // Retry при transient failure (БД, сеть)
      if ((!res.ok || !data?.ok) && res.status >= 500) {
        await new Promise((r) => setTimeout(r, 800))
        res = await fetch(contextUrl, contextFetchOptions())
        data = await res.json().catch(() => null)
      }
      if (res.ok && data?.ok) {
        const rid = String(data.restaurantId ?? 'default')
        // Respect explicit switch to demo/default and clear sticky venue cache.
        const useRid = rid || 'default'
        if (useRid === 'default') {
          lastValidRestaurantIdRef.current = null
          if (!inOwnerContext) clearVenueCache()
        } else {
          lastValidRestaurantIdRef.current = useRid
        }
        const nextSettings = {
          menuEnabled: Boolean(data.settings?.menuEnabled),
          storeEnabled: Boolean(data.settings?.storeEnabled ?? true),
          subscriptionEnabled: Boolean(data.settings?.subscriptionEnabled),
        }
        setRestaurantId(useRid)
        setName(typeof data.name === 'string' ? data.name : undefined)
        setSettings(nextSettings)
        if (useRid !== 'default' && !inOwnerContext) {
          writeVenueCache({
            restaurantId: useRid,
            name: typeof data.name === 'string' ? data.name : undefined,
            settings: nextSettings,
            ts: Date.now(),
          })
        }
      } else {
        setError(true)
        const fallback = readVenueCache()
        if (fallback) {
          lastValidRestaurantIdRef.current = fallback.restaurantId
          setRestaurantId(fallback.restaurantId)
          setName(fallback.name)
          setSettings(fallback.settings)
        }
      }
    } catch {
      setError(true)
      const fallback = readVenueCache()
      if (fallback) {
        lastValidRestaurantIdRef.current = fallback.restaurantId
        setRestaurantId(fallback.restaurantId)
        setName(fallback.name)
        setSettings(fallback.settings)
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchContext()
  }, [fetchContext])

  const prevRestaurantIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!restaurantId || isLoading) return
    const syncWithVenue = useCartStore.getState().syncWithVenue
    if (prevRestaurantIdRef.current !== restaurantId) {
      syncWithVenue(restaurantId)
      prevRestaurantIdRef.current = restaurantId
    }
  }, [restaurantId, isLoading])

  const pathname = usePathname()
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void fetchContext()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [fetchContext])
  useEffect(() => {
    if (pathname) void fetchContext()
  }, [pathname, fetchContext])

  const value: VenueContextValue = {
    restaurantId,
    name,
    settings,
    isLoading,
    error,
    refetch: fetchContext,
  }

  return (
    <VenueContext.Provider value={value}>{children}</VenueContext.Provider>
  )
}

export function useVenue(): VenueContextValue {
  const ctx = useContext(VenueContext)
  if (!ctx) {
    return defaultValue
  }
  return ctx
}
