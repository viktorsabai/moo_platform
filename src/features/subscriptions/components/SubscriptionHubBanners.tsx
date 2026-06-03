'use client'

import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { PromoCard } from '@/components/ui/PromoCard'
import { VerticalReelCard } from '@/components/ui/VerticalReelCard'
import { telegramInitHeaderRecord } from '@/lib/tg-webapp-client'
import { useVenue } from '@/lib/venue-context'

type Banner = {
  id: string
  title: string
  description?: string | null
  image?: string | null
  href: string
  cta: string
  type: string
}

export function SubscriptionHubBanners() {
  const { settings } = useVenue()
  const [banners, setBanners] = useState<Banner[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/banners?placement=subscriptions', {
      credentials: 'include',
      cache: 'no-store',
      headers: { ...telegramInitHeaderRecord() },
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data?.ok || !Array.isArray(data.banners)) return
        setBanners(data.banners as Banner[])
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    return banners.filter((b) => {
      const href = String(b.href || '')
      if (href.includes('/subscriptions') && !settings.subscriptionEnabled) return false
      if ((href === '/menu' || href.startsWith('/menu?')) && !settings.menuEnabled) return false
      return true
    })
  }, [banners, settings.menuEnabled, settings.subscriptionEnabled])

  const chips = filtered.filter((b) => b.type !== 'reel')
  const reels = filtered.filter((b) => b.type === 'reel')

  if (!loaded) {
    return (
      <div className="mb-4 -mx-1">
        <div className="h-[120px] animate-pulse rounded-[var(--radius-large)] bg-[color:var(--stroke)]/35" />
      </div>
    )
  }

  if (chips.length === 0 && reels.length === 0) return null

  return (
    <section className="mb-4" aria-label="предложения подписки">
      {chips.length > 0 ? (
        <>
          <h2 className="mb-2 px-0.5 text-[11px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
            для вас
          </h2>
          <div className="-mx-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex gap-3 px-0.5 pr-3">
              {chips.map((b) => (
                <PromoCard
                  key={b.id}
                  href={b.href}
                  title={b.title}
                  description={b.description}
                  image={b.image}
                  cta={b.cta}
                  className="h-[128px] w-[min(84vw,360px)] min-w-[min(78vw,300px)]"
                />
              ))}
            </div>
          </div>
        </>
      ) : null}

      {reels.length > 0 ? (
        <div className={cn(chips.length > 0 && 'mt-3')}>
          <div className="-mx-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex gap-3 px-0.5 pr-3">
              {reels.map((b) => (
                <VerticalReelCard
                  key={b.id}
                  href={b.href}
                  title={b.title}
                  support={b.description}
                  image={b.image}
                  cta={b.cta}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
