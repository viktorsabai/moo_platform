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
import { VENUE_REBOOTSTRAP_EVENT, bootstrapVenueCookie } from '@/lib/venue-bootstrap'

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
  menuEnabled: true,
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
  const cachedBoot = typeof window !== 'undefined' ? readVenueCache() : null
  const [restaurantId, setRestaurantId] = useState<string>(cachedBoot?.restaurantId ?? 'default')
  const [name, setName] = useState<string | undefined>(cachedBoot?.name)
  const [settings, setSettings] = useState<VenueSettings>(cachedBoot?.settings ?? defaultSettings)
  const [isLoading, setIsLoading] = useState(!cachedBoot?.restaurantId)
  const [error, setError] = useState(false)
  const lastValidRestaurantIdRef = useRef<string | null>(cachedBoot?.restaurantId ?? null)
  const ownerModeRef = useRef(false)

  const fetchContext = useCallback(async () => {
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : ''
    const inOwnerContext = isOwnerPath(currentPath)
    const cached = readVenueCache()
    const hasStableVenue = Boolean(lastValidRestaurantIdRef.current || cached?.restaurantId)
    if (cached?.restaurantId) {
      if (!lastValidRestaurantIdRef.current) lastValidRestaurantIdRef.current = cached.restaurantId
      setRestaurantId(cached.restaurantId)
      setName(cached.name)
      setSettings(cached.settings)
    }
    if (!hasStableVenue) setIsLoading(true)
    setError(false)
    try {
      let explicitRestaurantId = cached?.restaurantId || lastValidRestaurantIdRef.current || ''

      const boot = await bootstrapVenueCookie()
      if (boot?.restaurantId) {
        explicitRestaurantId = boot.restaurantId
        lastValidRestaurantIdRef.current = boot.restaurantId
        if (boot.name) setName(boot.name)
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
      let contextUrl = inOwnerContext ? '/api/owner/venue/context' : '/api/venue/context'
      let res = await fetch(contextUrl, contextFetchOptions())
      let data = await res.json().catch(() => null)
      if (inOwnerContext && (res.status === 401 || res.status === 403)) {
        contextUrl = '/api/venue/context'
        res = await fetch(contextUrl, contextFetchOptions())
        data = await res.json().catch(() => null)
      }
      if ((!res.ok || !data?.ok) && res.status >= 500) {
        await new Promise((r) => setTimeout(r, 800))
        res = await fetch(contextUrl, contextFetchOptions())
        data = await res.json().catch(() => null)
      }
      if (res.ok && data?.ok) {
        const rid = String(data.restaurantId ?? 'default')
        const useRid = rid || 'default'
        // Не сбрасываем заведение на default при кратком сбое cookie (типично после /admin → /profile).
        if (useRid === 'default' && lastValidRestaurantIdRef.current && !inOwnerContext) {
          // keep sticky venue; skip downgrade
        } else if (useRid === 'default') {
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
        const stickyRid =
          useRid === 'default' && lastValidRestaurantIdRef.current && !inOwnerContext
            ? lastValidRestaurantIdRef.current
            : useRid
        const skipDowngrade =
          useRid === 'default' && Boolean(lastValidRestaurantIdRef.current) && !inOwnerContext
        if (!skipDowngrade) {
          setRestaurantId(stickyRid)
          setName(typeof data.name === 'string' ? data.name : undefined)
          setSettings(nextSettings)
          if (stickyRid !== 'default' && !inOwnerContext) {
            writeVenueCache({
              restaurantId: stickyRid,
              name: typeof data.name === 'string' ? data.name : undefined,
              settings: nextSettings,
              ts: Date.now(),
            })
          }
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

  const pathname = usePathname() || ''
  const inOwnerContext = isOwnerPath(pathname)
  useEffect(() => {
    if (ownerModeRef.current !== inOwnerContext) {
      ownerModeRef.current = inOwnerContext
      void fetchContext()
    }
  }, [inOwnerContext, fetchContext])

  useEffect(() => {
    const onRebootstrap = () => {
      void fetchContext()
    }
    window.addEventListener(VENUE_REBOOTSTRAP_EVENT, onRebootstrap)
    return () => window.removeEventListener(VENUE_REBOOTSTRAP_EVENT, onRebootstrap)
  }, [fetchContext])

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
