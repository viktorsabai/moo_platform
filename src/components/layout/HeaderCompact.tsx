'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCartStore } from '@/store/cart-store'
import { useVenue } from '@/lib/venue-context'
import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { BackLink } from '@/components/ui/BackLink'
import { cn } from '@/lib/utils'
import { applyTheme, readTheme, saveTheme, type UiTheme } from '@/lib/theme'
import { IconCrown, IconMoon, IconSun } from '@/components/ui/icons'

function isOwnerContext(pathname: string) {
  return pathname.startsWith('/admin') || pathname === '/profile/owner'
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

export function HeaderCompact() {
  const pathname = usePathname() || ''
  const inOwnerContext = isOwnerContext(pathname)
  const itemCount = useCartStore((state) => state.getItemCount())
  const { data: session } = useSession()
  const { name: venueName } = useVenue()
  const [isMounted, setIsMounted] = useState(false)
  const [tgUser, setTgUser] = useState<any>(null)
  const [compact, setCompact] = useState(false)
  const [openState, setOpenState] = useState<{ isOpen: boolean; label: string }>({ isOpen: true, label: 'открыто' })
  const [restaurantName, setRestaurantName] = useState<string>('—')
  const [theme, setTheme] = useState<UiTheme>('system')

  const platformRole = (session?.user as any)?.platformRole as string | undefined
  const memberRole = (session?.user as any)?.memberRole as string | undefined
  const isAdmin = platformRole === 'SUPERADMIN' || memberRole === 'OWNER' || memberRole === 'ADMIN'
  const nextTheme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'

  function cycleTheme() {
    setTheme(nextTheme)
    saveTheme(nextTheme)
    applyTheme(nextTheme)
  }

  useEffect(() => {
    setIsMounted(true)
    const currentTheme = readTheme()
    setTheme(currentTheme)
    applyTheme(currentTheme)

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
      if (document.visibilityState === 'visible') {
        readTgUser()
        loadSettings()
      }
    }

    window.addEventListener('storage', onStorage)
    window.addEventListener('tg_user_updated' as any, onCustom)
    document.addEventListener('visibilitychange', onVisibility)

    const onScroll = () => {
      const y = window.scrollY || 0
      setCompact(y > 8)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })

    const loadSettings = async () => {
      try {
        const res = await fetch('/api/settings', { cache: 'no-store', credentials: 'include' })
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.ok) return
        const s = data.settings || {}
        const override = s.isOpenOverride
        const openTime = typeof s.openTime === 'string' ? s.openTime : '10:00'
        const closeTime = typeof s.closeTime === 'string' ? s.closeTime : '22:00'

        const computeIsOpen = () => {
          if (typeof override === 'boolean') return override
          const now = new Date()
          const [oh, om] = String(openTime).split(':').map((x) => Number(x))
          const [ch, cm] = String(closeTime).split(':').map((x) => Number(x))
          if (!Number.isFinite(oh) || !Number.isFinite(om) || !Number.isFinite(ch) || !Number.isFinite(cm)) return true
          const mins = now.getHours() * 60 + now.getMinutes()
          const o = oh * 60 + om
          const c = ch * 60 + cm
          return o <= c ? mins >= o && mins < c : mins >= o || mins < c
        }

        const isOpen = computeIsOpen()
        setOpenState({ isOpen, label: isOpen ? 'открыто' : 'закрыто' })
      } catch {
        // ignore
      }
    }
    loadSettings()

    const loadRestaurant = async () => {
      try {
        const res = await fetch('/api/restaurant', { cache: 'no-store', credentials: 'include' })
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.ok) return
        const name = String(data?.restaurant?.name || '').trim()
        if (name) setRestaurantName(name)
      } catch {
        // ignore
      }
    }
    loadRestaurant()

    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('tg_user_updated' as any, onCustom)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  const initials = useMemo(() => {
    const name = String(tgUser?.first_name || tgUser?.username || '').trim()
    if (!name) return ''
    const parts = name.split(/\s+/g).filter(Boolean)
    const s = (parts[0]?.[0] || '') + (parts[1]?.[0] || '')
    return s.toUpperCase()
  }, [tgUser])

  const ownerBackHref =
    pathname === '/profile/owner'
      ? '/profile'
      : pathname === '/admin'
        ? '/profile'
        : pathname.startsWith('/admin')
          ? '/admin'
          : '/profile'

  return (
    <header
      className="fixed top-0 left-0 right-0 z-[200] border-b border-[color:var(--stroke)] bg-[color:var(--sticky-bg)] backdrop-blur-xl"
      style={{
        ['--header-h' as any]: 'calc(env(safe-area-inset-top) + 48px)',
      }}
    >
      <div
        className="mx-auto max-w-[1100px] px-4"
        style={{
          paddingTop: `calc(env(safe-area-inset-top) + ${compact ? 4 : 8}px)`,
          paddingBottom: compact ? 4 : 8,
          transition: 'padding 180ms ease',
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-2">
            {inOwnerContext ? (
              <div className="flex shrink-0 items-center self-start pt-0.5">
                <BackLink href={ownerBackHref} className="shrink-0" />
              </div>
            ) : null}
            <Link href="/" className="min-w-0 flex-1">
              <div className="min-w-0">
                <div className="ui-h2 truncate leading-tight">{venueName || restaurantName || '—'}</div>
                <div className="ui-muted mt-1 flex min-h-[18px] flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-none">
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                    <span
                      className={cn(
                        'h-1.5 w-1.5 shrink-0 rounded-full',
                        openState.isOpen ? 'bg-emerald-500' : 'bg-rose-500'
                      )}
                      aria-hidden
                    />
                    <span>{openState.label}</span>
                  </span>
                </div>
              </div>
            </Link>
          </div>

          <div className="flex shrink-0 items-center gap-2 self-start pt-0.5">
            <button
              type="button"
              onClick={cycleTheme}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--muted)] transition active:scale-[0.95]"
              aria-label="Сменить тему"
            >
              {theme === 'dark' ? <IconMoon className="h-5 w-5" /> : <IconSun className="h-5 w-5" />}
            </button>
            {isAdmin ? (
              <Link
                href="/profile/owner"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--muted)] transition active:scale-[0.95]"
                aria-label="Режим владельца"
              >
                <IconCrown className="h-5 w-5" />
              </Link>
            ) : null}
            <Link
              href="/cart"
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--muted)] transition active:scale-[0.95]"
              aria-label="Корзина"
            >
              <CartIcon />
              {isMounted && itemCount > 0 && (
                <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] h-[18px] px-1 items-center justify-center rounded-full bg-[color:var(--primary)] text-white text-[10px] font-extrabold">
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              )}
            </Link>

            <Link
              href="/profile"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--muted)] transition active:scale-[0.95]"
              aria-label="Профиль"
            >
              <span className="relative">
                {tgUser?.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={tgUser.photo_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                ) : initials ? (
                  <span className="grid h-7 w-7 place-items-center rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] text-[10px] font-extrabold text-[color:var(--text)]">
                    {initials}
                  </span>
                ) : (
                  <ProfileIcon />
                )}
              </span>
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}
