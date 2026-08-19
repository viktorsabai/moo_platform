'use client'

import { useEffect, useState } from 'react'

type BuildInfo = {
  ref?: string | null
  sha?: string | null
  deployedAt?: string | null
  environment?: string
}

export function TestBuildBanner() {
  const [build, setBuild] = useState<BuildInfo | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/app-version', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.ok && data.environment === 'test') setBuild(data)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  if (!build) return null

  const shortSha = build.sha ? build.sha.slice(0, 7) : 'local'

  return (
    <div
      role="status"
      className="sticky top-0 z-[80] border-b border-amber-200 bg-amber-50 px-3 py-1.5 text-center text-[11px] font-semibold text-amber-950"
    >
      тестовая версия · {build.ref || 'test'} · {shortSha}
    </div>
  )
}
