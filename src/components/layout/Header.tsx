'use client'

import Link from 'next/link'
import { useCartStore } from '@/store/cart-store'
import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { RoleDot } from '@/components/ui/RoleBadges'
import { useVenue } from '@/lib/venue-context'

function RestaurantIcon() {
  return (
    <span className="grid h-9 w-9 place-items-center rounded-2xl bg-black/[0.04] text-[16px] font-extrabold text-black/70">
      u
    </span>
  )
}

function CartIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 6h15l-1.5 9h-12z" />
      <path d="M6 6l-2-2H2" />
      <circle cx="9" cy="20" r="1" />
      <circle cx="18" cy="20" r="1" />
    </svg>
  )
}

function ProfileIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 21a8 8 0 1 0-16 0" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

export function Header() {
  const itemCount = useCartStore((state) => state.getItemCount())
  const { data: session } = useSession()
  const { name: venueName, settings, restaurantId } = useVenue()
  const [isMounted, setIsMounted] = useState(false)
  const [tgUser, setTgUser] = useState<any>(null)
  const [compact, setCompact] = useState(false)
  const [openState, setOpenState] = useState<{ isOpen: boolean; label: string }>({ isOpen: true, label: 'открыто' })
  const [workHours, setWorkHours] = useState<{ openTime: string; closeTime: string; isOpenOverride: boolean | null }>({
    openTime: '10:00',
    closeTime: '22:00',
    isOpenOverride: null,
  })

  const platformRole = (session?.user as any)?.platformRole as string | undefined
  const memberRole = (session?.user as any)?.memberRole as string | undefined
  const isAdmin = platformRole === 'SUPERADMIN' || memberRole === 'OWNER' || memberRole === 'ADMIN'
  const roleLabel =
    platformRole === 'SUPERADMIN'
      ? 'superadmin'
      : memberRole === 'OWNER'
        ? 'владелец'
        : memberRole === 'ADMIN'
          ? 'админ'
          : ''

  useEffect(() => {
    setIsMounted(true)

    const readTgUser = () => {
      try {
        const raw = localStorage.getItem('tg_user')
        setTgUser(raw ? JSON.parse(raw) : null)
      } catch {
        setTgUser(null)
      }
    }

    readTgUser()

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'tg_user') readTgUser()
    }

    const onCustom = () => readTgUser()

    const onVisibility = () => {
      if (document.visibilityState === 'visible') readTgUser()
    }

    window.addEventListener('storage', onStorage)
    window.addEventListener('tg_user_updated' as any, onCustom)
    document.addEventListener('visibilitychange', onVisibility)

    const onScroll = () => {
      const y = window.scrollY || 0
      setCompact(y > 14)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('tg_user_updated' as any, onCustom)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  useEffect(() => {
    const key = `ufo:header:hours:v1:${restaurantId || 'default'}`
    const cached = (() => {
      try {
        const raw = window.sessionStorage.getItem(key)
        if (!raw) return null
        const parsed = JSON.parse(raw) as { openTime?: string; closeTime?: string; isOpenOverride?: boolean | null; ts?: number }
        if (!parsed?.openTime || !parsed?.closeTime) return null
        if (Date.now() - Number(parsed.ts || 0) > 5 * 60_000) return null
        return parsed
      } catch {
        return null
      }
    })()
    if (cached) {
      setWorkHours({
        openTime: cached.openTime || '10:00',
        closeTime: cached.closeTime || '22:00',
        isOpenOverride: typeof cached.isOpenOverride === 'boolean' ? cached.isOpenOverride : null,
      })
      return
    }
    fetch('/api/settings', { credentials: 'include' })
      .then((r) => r.json().catch(() => null))
      .then((data) => {
        if (!data?.ok) return
        const next = {
          openTime: typeof data?.settings?.openTime === 'string' ? data.settings.openTime : '10:00',
          closeTime: typeof data?.settings?.closeTime === 'string' ? data.settings.closeTime : '22:00',
          isOpenOverride:
            data?.settings?.isOpenOverride === null || typeof data?.settings?.isOpenOverride === 'boolean'
              ? data.settings.isOpenOverride
              : null,
        }
        setWorkHours(next)
        try {
          window.sessionStorage.setItem(key, JSON.stringify({ ...next, ts: Date.now() }))
        } catch {
          // ignore
        }
      })
      .catch(() => {})
  }, [restaurantId])

  useEffect(() => {
    const compute = () => {
      const override = workHours.isOpenOverride
      const openTime = workHours.openTime
      const closeTime = workHours.closeTime
      const isOpen = (() => {
        if (typeof override === 'boolean') return override
        const now = new Date()
        const [oh, om] = String(openTime).split(':').map((x) => Number(x))
        const [ch, cm] = String(closeTime).split(':').map((x) => Number(x))
        if (!Number.isFinite(oh) || !Number.isFinite(om) || !Number.isFinite(ch) || !Number.isFinite(cm)) return true
        const mins = now.getHours() * 60 + now.getMinutes()
        const o = oh * 60 + om
        const c = ch * 60 + cm
        return o <= c ? mins >= o && mins < c : mins >= o || mins < c
      })()
      setOpenState({ isOpen, label: isOpen ? 'открыто' : 'закрыто' })
    }
    compute()
    const interval = window.setInterval(compute, 60_000)
    return () => window.clearInterval(interval)
  }, [settings, workHours])

  const initials = useMemo(() => {
    const name = String(tgUser?.first_name || tgUser?.username || '').trim()
    if (!name) return ''
    const parts = name.split(/\s+/g).filter(Boolean)
    const s = (parts[0]?.[0] || '') + (parts[1]?.[0] || '')
    return s.toUpperCase()
  }, [tgUser])

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 border-b border-[color:var(--stroke)] bg-[color:var(--sticky-bg)] backdrop-blur-xl"
      style={{
        // used by layout to offset content (main padding-top)
        ['--header-h' as any]: 'calc(env(safe-area-inset-top) + 56px)',
      }}
    >
      <div
        className="mx-auto max-w-[1100px] px-4"
        style={{
          paddingTop: `calc(env(safe-area-inset-top) + ${compact ? 6 : 12}px)`,
          paddingBottom: compact ? 6 : 12,
          transition: 'padding 180ms ease',
        }}
      >
        <div className="flex items-center justify-between gap-3">
          {/* restaurant */}
          <Link href="/" className="flex items-center gap-3 min-w-0">
            <RestaurantIcon />
            <div className="min-w-0">
              <div className="truncate text-[15px] font-extrabold tracking-tight text-black/90">{venueName || '—'}</div>
              <div className="mt-0.5 flex items-center gap-2 text-[12px] font-semibold text-black/45">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className={`h-2 w-2 rounded-full ${openState.isOpen ? 'bg-[color:var(--accent)]/70' : 'bg-black/25'}`}
                    aria-hidden
                  />
                  {openState.label}
                </span>
              </div>
            </div>
          </Link>

          {/* actions */}
          <div className="flex items-center gap-2">
            <Link
              href="/cart"
              className="relative inline-flex h-10 items-center justify-center rounded-full px-3 text-sm font-semibold text-black/80 transition active:scale-[0.98]"
              aria-label="Корзина"
            >
              <CartIcon />
              {isMounted && itemCount > 0 && (
                <span className="ml-2 inline-flex min-w-[20px] h-5 px-1.5 items-center justify-center rounded-full bg-[color:var(--primary)] text-white text-[11px] font-extrabold">
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              )}
            </Link>

            <Link
              href="/profile"
              className="inline-flex h-10 items-center justify-center rounded-full px-3 text-sm font-semibold text-black/80 transition active:scale-[0.98]"
              aria-label="Профиль"
              title="профиль"
            >
              <span className="relative">
                {tgUser?.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={tgUser.photo_url} alt="" className="h-6 w-6 rounded-full object-cover" />
                ) : initials ? (
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-black/[0.04] text-[11px] font-extrabold">
                    {initials}
                  </span>
                ) : (
                  <ProfileIcon />
                )}

                {isAdmin ? (
                  <RoleDot
                    platformRole={platformRole}
                    memberRole={memberRole}
                    className="absolute -right-2 -bottom-2"
                    title={roleLabel || 'admin'}
                  />
                ) : null}
              </span>
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}
