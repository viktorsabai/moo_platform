'use client'

import { useEffect, useRef } from 'react'
import { telegramInitHeaderRecord } from '@/lib/tg-webapp-client'

type ContentSyncState = {
  menuVersion: number
  subscriptionVersion: number
  lastEventId: string | null
}

type UseContentSyncOptions = {
  onMenuChanged?: () => void | Promise<void>
  onSubscriptionChanged?: () => void | Promise<void>
  intervalMs?: number
}

export function useContentSync({
  onMenuChanged,
  onSubscriptionChanged,
  intervalMs = 4000,
}: UseContentSyncOptions) {
  const stateRef = useRef<ContentSyncState | null>(null)
  const callbacksRef = useRef({ onMenuChanged, onSubscriptionChanged })

  useEffect(() => {
    callbacksRef.current = { onMenuChanged, onSubscriptionChanged }
  }, [onMenuChanged, onSubscriptionChanged])

  useEffect(() => {
    let disposed = false
    let timer: number | null = null
    let inFlight = false

    const schedule = () => {
      if (!disposed) timer = window.setTimeout(check, intervalMs)
    }

    const check = async () => {
      if (disposed) return
      if (document.visibilityState !== 'visible' || inFlight) {
        schedule()
        return
      }
      inFlight = true
      try {
        const res = await fetch('/api/sync/state', {
          cache: 'no-store',
          credentials: 'include',
          headers: { ...telegramInitHeaderRecord() },
        })
        const data = await res.json().catch(() => null)
        if (!disposed && res.ok && data?.ok) {
          const next: ContentSyncState = {
            menuVersion: Number(data.menuVersion || 0),
            subscriptionVersion: Number(data.subscriptionVersion || 0),
            lastEventId: data.lastEventId ? String(data.lastEventId) : null,
          }
          const prev = stateRef.current
          stateRef.current = next
          if (prev && next.menuVersion !== prev.menuVersion) await callbacksRef.current.onMenuChanged?.()
          if (prev && next.subscriptionVersion !== prev.subscriptionVersion) await callbacksRef.current.onSubscriptionChanged?.()
        }
      } catch {
        // The canonical page loaders remain the fallback when the sync endpoint is unavailable.
      } finally {
        inFlight = false
        schedule()
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void check()
    }

    document.addEventListener('visibilitychange', onVisibility)
    void check()
    return () => {
      disposed = true
      if (timer !== null) window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [intervalMs])
}
