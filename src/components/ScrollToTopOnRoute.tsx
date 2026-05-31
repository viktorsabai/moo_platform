'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

/** На каждом route-change сбрасывает scroll наверх для нативного mini-app UX. */
export function ScrollToTopOnRoute() {
  const pathname = usePathname() || ''

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname])

  return null
}
