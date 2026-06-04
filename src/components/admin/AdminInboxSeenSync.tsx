'use client'

import { useEffect } from 'react'
import { useVenue } from '@/lib/venue-context'
import { markOwnerInboxSeen, type OwnerInboxItemClient } from '@/lib/owner-inbox-client'

/** Просмотр любого раздела ЛК владельца = «прочитано» для короны. */
export function AdminInboxSeenSync() {
  const { restaurantId } = useVenue()

  useEffect(() => {
    if (!restaurantId || restaurantId === 'default') return
    let cancelled = false
    fetch('/api/owner/inbox', { cache: 'no-store', credentials: 'include' })
      .then((res) => res.json().catch(() => null))
      .then((data) => {
        if (cancelled || !data?.ok || !Array.isArray(data.items)) return
        markOwnerInboxSeen(restaurantId, data.items as OwnerInboxItemClient[])
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [restaurantId])

  return null
}
