'use client'

import { useEffect } from 'react'
import { useVenue } from '@/lib/venue-context'

/** Sets document.title from venue name. */
export function DynamicTitle() {
  const { name: venueName } = useVenue()
  useEffect(() => {
    document.title = venueName ? `${venueName} | MOO` : 'MOO'
  }, [venueName])
  return null
}
