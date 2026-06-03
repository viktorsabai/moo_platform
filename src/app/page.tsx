'use client'

import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useVenue } from '@/lib/venue-context'
import { getDemoBotLink } from '@/lib/telegram'
import { PromoCard } from '@/components/ui/PromoCard'
import { EmptyStatePlaceholder } from '@/components/ui/EmptyStatePlaceholder'
import { VerticalReelCard } from '@/components/ui/VerticalReelCard'

type Banner = {
  id: string
  title: string
  description?: string | null
  image?: string | null
  href: string
  cta: string
  type: string
  targetType?: string | null
}

type BannerCache = {
  chips: Banner[]
  reels: Banner[]
  ts: number
}

const BANNERS_CACHE_TTL_MS = 90_000
const HOME_BANNERS_CACHE_PREFIX = 'ufo:home:banners:v1:'
const memoryBannersCache = new Map<string, BannerCache>()

function filterBannersBySettings(
  banners: Banner[],
  settings: { menuEnabled: boolean; subscriptionEnabled: boolean }
): Banner[] {
  return banners.filter((b) => {
    const href = String(b.href || '')
    if (href.includes('/subscriptions') && !settings.subscriptionEnabled) return false
    if ((href === '/menu' || href.startsWith('/menu?')) && !settings.menuEnabled) return false
    return true
  })
}

export default function HomePage() {
  const { data: session } = useSession()
  const { settings, restaurantId, isLoading: venueLoading } = useVenue()
  const tmeLink = useMemo(() => getDemoBotLink().tme, [])

  const [rawChips, setRawChips] = useState<Banner[]>([])
  const [rawReels, setRawReels] = useState<Banner[]>([])
  const [bannersLoaded, setBannersLoaded] = useState(false)

  const chips = useMemo(
    () => (venueLoading ? rawChips : filterBannersBySettings(rawChips, settings)),
    [rawChips, settings, venueLoading]
  )
  const reels = useMemo(
    () => (venueLoading ? rawReels : filterBannersBySettings(rawReels, settings)),
    [rawReels, settings, venueLoading]
  )

  useEffect(() => {
    if (session?.user) return
    const inWebApp = typeof window !== 'undefined' && Boolean((window as any)?.Telegram?.WebApp)
    if (!inWebApp && tmeLink) window.location.href = tmeLink
  }, [session?.user, tmeLink])

  useEffect(() => {
    const cacheKey = `${HOME_BANNERS_CACHE_PREFIX}${restaurantId || 'default'}`
    const now = Date.now()
    const memoryCached = memoryBannersCache.get(cacheKey)
    const storageCached = (() => {
      if (typeof window === 'undefined') return null
      try {
        const raw = window.sessionStorage.getItem(cacheKey)
        if (!raw) return null
        const parsed = JSON.parse(raw) as BannerCache
        return parsed && Array.isArray(parsed.chips) && Array.isArray(parsed.reels) ? parsed : null
      } catch {
        return null
      }
    })()
    const cached = memoryCached ?? storageCached
    const cacheUsable =
      cached &&
      now - cached.ts < BANNERS_CACHE_TTL_MS &&
      // Пока venue в контексте ещё `default`, пустой кеш часто означает гонку до cookie init — не залипаем на пустоте.
      !(restaurantId === 'default' && cached.chips.length === 0 && cached.reels.length === 0)
    if (cacheUsable) {
      setRawChips(cached.chips)
      setRawReels(cached.reels)
      setBannersLoaded(true)
      return
    }

    let cancelled = false
    const bannerHeaders =
      restaurantId && restaurantId !== 'default'
        ? ({ 'x-ufo-restaurant': restaurantId } as Record<string, string>)
        : undefined
    fetch('/api/banners', {
      credentials: 'include',
      ...(bannerHeaders ? { headers: bannerHeaders } : {}),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data?.ok || !Array.isArray(data.banners)) return
        const list = data.banners as Banner[]
        const nextCache: BannerCache = {
          chips: list.filter((b) => b.type === 'chip'),
          reels: list.filter((b) => b.type === 'reel'),
          ts: Date.now(),
        }
        memoryBannersCache.set(cacheKey, nextCache)
        try {
          window.sessionStorage.setItem(cacheKey, JSON.stringify(nextCache))
        } catch {
          // ignore storage limitations in webview
        }
        setRawChips(nextCache.chips)
        setRawReels(nextCache.reels)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setBannersLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [restaurantId])

  const [reelIndex, setReelIndex] = useState(0)
  const [chipIndex, setChipIndex] = useState(0)
  const reelRefs = useRef<(HTMLDivElement | null)[]>([])
  const chipRefs = useRef<(HTMLDivElement | null)[]>([])
  const reelScrollerRef = useRef<HTMLDivElement | null>(null)
  const chipScrollerRef = useRef<HTMLDivElement | null>(null)

  const goToReel = useCallback((idx: number) => {
    const i = Math.max(0, Math.min(idx, reels.length - 1))
    setReelIndex(i)
    const scroller = reelScrollerRef.current
    const el = reelRefs.current[i]
    if (scroller && el) {
      const left = el.offsetLeft - (scroller.clientWidth - el.clientWidth) / 2
      scroller.scrollTo({ left: Math.max(0, left), behavior: 'smooth' })
    }
  }, [reels.length])

  const goToChip = useCallback((idx: number) => {
    const i = Math.max(0, Math.min(idx, chips.length - 1))
    setChipIndex(i)
    const scroller = chipScrollerRef.current
    const el = chipRefs.current[i]
    if (scroller && el) {
      const left = el.offsetLeft - (scroller.clientWidth - el.clientWidth) / 2
      scroller.scrollTo({ left: Math.max(0, left), behavior: 'smooth' })
    }
  }, [chips.length])

  useEffect(() => {
    if (reels.length < 2) return
    const id = setInterval(() => {
      setReelIndex((prev) => {
        const next = prev + 1 >= reels.length ? 0 : prev + 1
        const scroller = reelScrollerRef.current
        const el = reelRefs.current[next]
        if (scroller && el) {
          const left = el.offsetLeft - (scroller.clientWidth - el.clientWidth) / 2
          scroller.scrollTo({ left: Math.max(0, left), behavior: 'smooth' })
        }
        return next
      })
    }, 4500)
    return () => clearInterval(id)
  }, [reels.length])

  useEffect(() => {
    if (chips.length < 2) return
    const id = setInterval(() => {
      setChipIndex((prev) => {
        const next = prev + 1 >= chips.length ? 0 : prev + 1
        const scroller = chipScrollerRef.current
        const el = chipRefs.current[next]
        if (scroller && el) {
          const left = el.offsetLeft - (scroller.clientWidth - el.clientWidth) / 2
          scroller.scrollTo({ left: Math.max(0, left), behavior: 'smooth' })
        }
        return next
      })
    }, 4800)
    return () => clearInterval(id)
  }, [chips.length])

  const hasBanners = chips.length > 0 || reels.length > 0 || bannersLoaded

  return (
    <main className="ui-container overflow-x-hidden pt-4 pb-24">
      {!bannersLoaded && (
        <section className="space-y-5" aria-label="загрузка главной">
          <div className="-mx-4 sm:-mx-5 px-4 sm:px-5">
            <div className="h-[140px] w-[min(88vw,400px)] min-w-[min(82vw,340px)] animate-pulse rounded-[var(--radius-large)] border border-black/[0.04] bg-black/[0.035]" />
          </div>
          <div className="h-[116px] animate-pulse rounded-[28px] border border-black/[0.04] bg-black/[0.035]" />
        </section>
      )}
      {!hasBanners && bannersLoaded && <EmptyStatePlaceholder variant="home" />}

      {/* Hero баннеры — только то, что владелец создал в ЛК */}
      {bannersLoaded && chips.length > 0 && (
      <section className="-mx-4 px-4 sm:-mx-5 sm:px-5" aria-label="лучшие предложения">
        <h2 className="mb-3 px-1 text-[13px] font-bold uppercase tracking-tight text-[color:var(--muted)]">лучшие предложения</h2>
        <div ref={chipScrollerRef} className="overflow-x-auto overflow-y-hidden snap-x snap-mandatory pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden [-webkit-overflow-scrolling:touch]">
          <div className="flex gap-4 pr-4">
            {chips.map((b, i) => (
              <div key={b.id} ref={(el) => { chipRefs.current[i] = el }} className="snap-center shrink-0">
                <PromoCard
                  href={b.href}
                  title={b.title}
                  description={b.description ?? undefined}
                  image={b.image}
                  cta={b.cta}
                />
              </div>
            ))}
          </div>
        </div>
        {chips.length > 1 && (
          <div className="mt-2 flex justify-center gap-2">
            {chips.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goToChip(i)}
                aria-label={`Предложение ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${i === chipIndex ? 'w-5 bg-[color:var(--accent)]' : 'w-1.5 bg-[color:var(--stroke)]'}`}
              />
            ))}
          </div>
        )}
      </section>
      )}

      {bannersLoaded && (
      <section className={chips.length > 0 ? 'mt-7' : 'mt-0'} aria-label="для событий">
        <h2 className="mb-3 px-1 text-[13px] font-bold uppercase tracking-tight text-[color:var(--muted)]">для событий</h2>
        <div className="overflow-hidden rounded-[28px] border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] p-4 shadow-[var(--shadow-soft)]">
          <div className="pointer-events-none absolute opacity-0" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[22px] font-extrabold leading-[0.98] tracking-[-0.04em] text-[color:var(--text)]">
                Еда для событий
              </h2>
              <p className="mt-2 max-w-[86%] text-[13px] font-semibold leading-snug text-[color:var(--muted)]">
                Кейтеринг, банкеты и корпоративы.
              </p>
            </div>
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[color:var(--surface)] text-[24px]" aria-hidden>
              ✦
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              { label: 'кейтеринг', href: '/requests/new?type=catering' },
              { label: 'банкет', href: '/requests/new?type=banquet' },
              { label: 'корпоратив', href: '/requests/new?type=corporate' },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                scroll={false}
                className="rounded-full bg-[color:var(--surface)] px-3 py-1.5 text-[12px] font-extrabold text-[color:var(--muted)] transition active:scale-95"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/requests/new?type=catering"
              prefetch={false}
              scroll={false}
              className="rounded-full bg-[color:var(--accent)] px-4 py-1.5 text-[12px] font-extrabold text-white shadow-[0_8px_18px_rgba(127,150,255,0.20)] transition active:scale-95"
            >
              оставить заявку →
            </Link>
          </div>
        </div>
      </section>
      )}

      {/* Reels — только если есть в ЛК */}
      {bannersLoaded && reels.length > 0 && (
      <section className="mt-8" aria-label="сценарии">
        <h2 className="mb-4 px-1 text-[13px] font-bold uppercase tracking-tight text-[color:var(--muted)]">полезное</h2>
        <div ref={reelScrollerRef} className="-mx-4 sm:-mx-5 overflow-x-auto overflow-y-hidden snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [-webkit-overflow-scrolling:touch]">
          <div className="flex gap-5 px-4 pb-4 sm:px-5" style={{ minHeight: 'min(58vh, 430px)' }}>
            {reels.map((b, i) => (
              <div key={b.id} ref={(el) => { reelRefs.current[i] = el }} className="snap-center shrink-0">
                <VerticalReelCard
                  href={b.href}
                  title={b.title}
                  support={b.description ?? undefined}
                  image={b.image}
                  cta={b.cta}
                />
              </div>
            ))}
          </div>
        </div>
        {reels.length > 1 && (
          <div className="flex justify-center gap-2 mt-4">
            {reels.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goToReel(i)}
                aria-label={`Слайд ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${i === reelIndex ? 'w-5 bg-[color:var(--accent)]' : 'w-1.5 bg-[color:var(--stroke)]'}`}
              />
            ))}
          </div>
        )}
      </section>
      )}
    </main>
  )
}
