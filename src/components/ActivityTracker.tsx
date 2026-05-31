'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useCartStore } from '@/store/cart-store'
import { useVenue } from '@/lib/venue-context'

function readTelegramId() {
  try {
    const raw = localStorage.getItem('tg_user')
    const user = raw ? JSON.parse(raw) : null
    return user?.id ? String(user.id) : undefined
  } catch {
    return undefined
  }
}

function sendActivity(type: string, restaurantId?: string, metadata?: Record<string, unknown>) {
  try {
    const payload = JSON.stringify({
      type,
      path: window.location.pathname,
      telegramId: readTelegramId(),
      restaurantId: restaurantId || undefined,
      metadata,
    })
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/activity', new Blob([payload], { type: 'application/json' }))
      return
    }
    void fetch('/api/activity', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payload,
      keepalive: true,
    })
  } catch {}
}

export function ActivityTracker() {
  const pathname = usePathname() || '/'
  const itemCount = useCartStore((state) => state.getItemCount())
  const { restaurantId, isLoading } = useVenue()
  const lastCartReportRef = useRef('')

  useEffect(() => {
    if (isLoading) return
    sendActivity('VIEW_PAGE', restaurantId)
  }, [pathname, restaurantId, isLoading])

  useEffect(() => {
    if (isLoading) return
    if (itemCount <= 0) return
    const key = `${pathname}:${itemCount}`
    if (lastCartReportRef.current === key) return
    lastCartReportRef.current = key
    sendActivity(pathname === '/cart' ? 'START_CHECKOUT' : 'CART_WITH_ITEMS', restaurantId, { itemCount })
  }, [itemCount, pathname, restaurantId, isLoading])

  return null
}
