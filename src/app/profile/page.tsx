'use client'

import { useEffect, useMemo, useState } from 'react'
import { signIn, useSession } from 'next-auth/react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { getDemoBotLink } from '@/lib/telegram'
import { PageHeader } from '@/components/ui/PageHeader'
import { SettingsRow } from '@/components/ui/SettingsRow'
import { IconBell, IconCrown, IconHeart, IconMapPin, IconReceipt } from '@/components/ui/icons'
import { loadDeliveryProfile } from '@/lib/delivery-profile'
import { useVenue } from '@/lib/venue-context'
import { readTelegramInitData, telegramInitHeaderRecord } from '@/lib/tg-webapp-client'
import { cn } from '@/lib/utils'

const bizInquirySentStorageKey = (userId: string) => `ufo:biz-inquiry-sent:v1:${userId}`

type ProfileSummary = {
  ordersCount: number
  activeSubscriptionsCount: number
  favoritesCount: number
  addressLabel?: string | null
}

type ProfileSummaryCache = {
  summary: ProfileSummary
  ts: number
}

const PROFILE_SUMMARY_CACHE_TTL_MS = 60_000
const profileSummaryMemoryCache = new Map<string, ProfileSummaryCache>()

export default function ProfilePage() {
  const { data: session, status: sessionStatus } = useSession()
  const { restaurantId: venueRestaurantId } = useVenue()
  const [summary, setSummary] = useState<ProfileSummary>({ ordersCount: 0, activeSubscriptionsCount: 0, favoritesCount: 0 })
  /** Адрес из localStorage (чекаут / «доставка») — не подменяется адресом ресторана из заказа на самовывоз. */
  const [localDeliveryLine, setLocalDeliveryLine] = useState<string | null>(null)
  const [tgUser, setTgUser] = useState<any>(null)
  const [businessInquiry, setBusinessInquiry] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const tgDeepLink = getDemoBotLink().tg

  const [isTelegramWebApp, setIsTelegramWebApp] = useState(false)
  const sessionUserId = String((session?.user as any)?.id || '').trim()
  const sessionTelegramId = String((session?.user as any)?.telegramId || '').trim()

  const readTelegramUserId = () => {
    try {
      const w = window as any
      const id = String(w?.Telegram?.WebApp?.initDataUnsafe?.user?.id || '').trim()
      if (id) return id
      const initData = String(w?.Telegram?.WebApp?.initData || '')
      if (!initData) return ''
      const raw = new URLSearchParams(initData).get('user')
      if (!raw) return ''
      const parsed = JSON.parse(raw)
      return String(parsed?.id || '').trim()
    } catch {
      return ''
    }
  }
  useEffect(() => {
    const w = typeof window !== 'undefined' ? (window as any) : null
    setIsTelegramWebApp(Boolean(w?.Telegram?.WebApp))
    try {
      const raw = window.localStorage.getItem('tg_user')
      setTgUser(raw ? JSON.parse(raw) : null)
    } catch {
      setTgUser(null)
    }
  }, [])

  useEffect(() => {
    if (!sessionUserId || typeof window === 'undefined') return
    try {
      if (window.localStorage.getItem(bizInquirySentStorageKey(sessionUserId)) === '1') {
        setBusinessInquiry('sent')
      }
    } catch {
      // ignore
    }
  }, [sessionUserId])

  useEffect(() => {
    if (sessionStatus === 'loading') return
    const tgInit = isTelegramWebApp ? readTelegramInitData() : ''
    if (!sessionUserId && !tgInit) return
    let cancelled = false
    const cacheKey = `ufo:profile:summary:v1:${sessionUserId || sessionTelegramId || 'guest'}:${String(venueRestaurantId || 'default')}`
    const now = Date.now()
    const cachedMemory = profileSummaryMemoryCache.get(cacheKey)
    const cachedStorage = (() => {
      if (typeof window === 'undefined') return null
      try {
        const raw = window.sessionStorage.getItem(cacheKey)
        if (!raw) return null
        const parsed = JSON.parse(raw) as ProfileSummaryCache
        return parsed?.summary ? parsed : null
      } catch {
        return null
      }
    })()
    const cached = cachedMemory ?? cachedStorage
    if (cached && now - cached.ts < PROFILE_SUMMARY_CACHE_TTL_MS) {
      setSummary((prev) => ({
        ...cached.summary,
        addressLabel: cached.summary.addressLabel || prev.addressLabel || null,
      }))
      return
    }
    const restaurantHeader =
      venueRestaurantId && venueRestaurantId !== 'default'
        ? { 'x-ufo-restaurant': venueRestaurantId }
        : {}
    fetch('/api/profile/summary', {
      cache: 'no-store',
      credentials: 'include',
      headers: { ...telegramInitHeaderRecord(), ...restaurantHeader } as HeadersInit,
    })
      .then((res) => res.json().catch(() => null))
      .then((data) => {
        if (cancelled || !data?.ok) return
        setSummary((prev) => {
          const nextAddress = String(data.summary?.addressLabel || '').trim()
          const nextSummary = {
            ordersCount: Number(data.summary?.ordersCount ?? 0),
            activeSubscriptionsCount: Number(data.summary?.activeSubscriptionsCount ?? 0),
            favoritesCount: Number(data.summary?.favoritesCount ?? 0),
            // Do not erase a locally restored address with empty API value.
            addressLabel: nextAddress || prev.addressLabel || null,
          }
          const payload: ProfileSummaryCache = { summary: nextSummary, ts: Date.now() }
          profileSummaryMemoryCache.set(cacheKey, payload)
          try {
            window.sessionStorage.setItem(cacheKey, JSON.stringify(payload))
          } catch {
            // ignore webview storage limitations
          }
          return nextSummary
        })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [sessionStatus, isTelegramWebApp, venueRestaurantId, sessionUserId, sessionTelegramId])

  useEffect(() => {
    const syncLocal = () => {
      const p = loadDeliveryProfile()
      const line = [p?.address, p?.apartment]
        .map((v) => String(v || '').trim())
        .filter(Boolean)
        .join(', ')
      setLocalDeliveryLine(line.trim() ? line : null)
    }
    syncLocal()
    const onVis = () => {
      if (document.visibilityState === 'visible') syncLocal()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  useEffect(() => {
    if (!isTelegramWebApp) return
    const w = window as any
    const initData = w?.Telegram?.WebApp?.initData
    if (!initData) return
    const telegramUserId = readTelegramUserId()
    if (!telegramUserId) return
    const shouldReloginViaTelegram =
      !sessionUserId ||
      sessionTelegramId !== telegramUserId
    if (!shouldReloginViaTelegram) return
    signIn('telegram', { initData, redirect: false }).catch(() => {})
  }, [sessionUserId, sessionTelegramId, isTelegramWebApp])

  const displayName = useMemo(() => {
    const name = session?.user?.name
    if (name) return name
    const tgName = String(tgUser?.first_name || tgUser?.username || '').trim()
    if (tgName) return tgName
    const telegramId = (session?.user as any)?.telegramId
    if (telegramId) return 'telegram user'
    return '—'
  }, [session?.user, tgUser])

  const memberRole = (session?.user as any)?.memberRole as string | undefined
  const platformRole = (session?.user as any)?.platformRole as string | undefined
  const isOwner = memberRole === 'OWNER' || memberRole === 'ADMIN'
  const canUseOwnerCabinet = isOwner || platformRole === 'SUPERADMIN'
  const roleLabel =
    platformRole === 'SUPERADMIN'
      ? 'админ'
      : memberRole === 'OWNER'
        ? 'владелец'
        : memberRole === 'ADMIN'
          ? 'админ'
          : 'пользователь'

  const cardClass = 'ui-surface-card overflow-hidden p-0'
  const cardRadius = { borderRadius: 'var(--radius-large)' } as const

  const notLoggedIn = !String((session?.user as any)?.id || '').trim()
  const avatarLetter = displayName.trim().slice(0, 1).toUpperCase() || 'U'
  const avatarUrl = String((session?.user as any)?.image || tgUser?.photo_url || '').trim()
  const deliveryPreviewLine =
    (localDeliveryLine || summary.addressLabel || '').trim() || null

  function persistBizInquirySent() {
    if (!sessionUserId || typeof window === 'undefined') return
    try {
      window.localStorage.setItem(bizInquirySentStorageKey(sessionUserId), '1')
    } catch {
      // ignore
    }
  }

  async function submitBusinessInquiry() {
    if (businessInquiry === 'sending' || businessInquiry === 'sent') return
    setBusinessInquiry('sending')
    try {
      const h: Record<string, string> = {
        'content-type': 'application/json',
        ...telegramInitHeaderRecord(),
      }
      if (venueRestaurantId && venueRestaurantId !== 'default') {
        h['x-ufo-restaurant'] = venueRestaurantId
      }
      const res = await fetch('/api/profile/business-inquiry', {
        method: 'POST',
        credentials: 'include',
        headers: h,
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        setBusinessInquiry('error')
        toast.error(typeof data?.error === 'string' ? data.error : 'не удалось отправить')
        return
      }
      if (data.cooldown) {
        toast('заявку уже отправляли недавно — мы скоро свяжемся', { icon: '✓' })
        setBusinessInquiry('sent')
        persistBizInquirySent()
        return
      }
      toast.success('заявку отправили — ответим в Telegram')
      setBusinessInquiry('sent')
      persistBizInquirySent()
    } catch {
      setBusinessInquiry('error')
      toast.error('сеть — попробуйте ещё раз')
    }
  }

  return (
    <main className="ui-container ui-screen">
      <PageHeader title="профиль" compact className="mb-3" />
      {notLoggedIn && (
        <div className="ui-surface-card" style={cardRadius}>
          <div className="p-4">
            <h2 className="ui-h2 mb-1 text-[14px]">профиль</h2>
            <p className="ui-muted mb-4 text-[13px]">
              {isTelegramWebApp
                ? 'Войдите через Telegram, чтобы видеть заказы, подписки и настройки.'
                : 'Приложение работает внутри Telegram. Откройте ссылку в Telegram или войдите по логину и паролю.'}
            </p>
            {isTelegramWebApp ? (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    const w = window as any
                    const initData = w?.Telegram?.WebApp?.initData
                    if (!initData) return
                    signIn('telegram', { initData, redirect: false }).catch(() => {})
                  }}
                  className="btn btn-primary block w-full rounded-full px-6 py-3 text-center text-[14px] font-semibold transition active:opacity-90"
                  style={{ borderRadius: 'var(--radius-pill)' }}
                >
                  Войти через Telegram
                </button>
                <Link
                  href="/signin/password"
                  className="block w-full rounded-full border border-[color:var(--stroke)] px-6 py-3 text-center text-[14px] font-semibold text-[color:var(--text)] transition active:opacity-90"
                  style={{ borderRadius: 'var(--radius-pill)' }}
                >
                  Войти по логину и паролю
                </Link>
                <Link
                  href="/signin/admin"
                  className="block w-full rounded-full border border-[color:var(--stroke)] px-6 py-2.5 text-center text-[13px] font-medium text-[color:var(--muted)] transition active:opacity-90"
                  style={{ borderRadius: 'var(--radius-pill)' }}
                >
                  Вход для админов
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                <a
                  href={tgDeepLink}
                  className="btn btn-primary block w-full rounded-full px-6 py-3 text-center text-[14px] font-semibold transition active:opacity-90"
                  style={{ borderRadius: 'var(--radius-pill)' }}
                >
                  Открыть в Telegram
                </a>
                <Link
                  href="/signin/password"
                  className="block w-full rounded-full border border-[color:var(--stroke)] px-6 py-3 text-center text-[14px] font-semibold text-[color:var(--text)] transition active:opacity-90"
                  style={{ borderRadius: 'var(--radius-pill)' }}
                >
                  Войти по логину и паролю (кабинет)
                </Link>
                <Link
                  href="/signin/admin"
                  className="block w-full rounded-full border border-[color:var(--stroke)] px-6 py-2.5 text-center text-[13px] font-medium text-[color:var(--muted)] transition active:opacity-90"
                  style={{ borderRadius: 'var(--radius-pill)' }}
                >
                  Вход для админов (логин/пароль)
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {!notLoggedIn && (
        <div className="space-y-4">
          <section className="ui-surface-card overflow-hidden p-4" style={cardRadius}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-full border border-[color:var(--stroke)] object-cover"
                  />
                ) : (
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[color:var(--text)] text-[20px] font-extrabold text-[color:var(--surface)]">
                    {avatarLetter}
                  </div>
                )}
                <div className="min-w-0">
                  <h2 className="truncate text-[22px] font-extrabold leading-none tracking-[-0.04em] text-[color:var(--text)]">{displayName}</h2>
                  <div className="mt-1 text-[12px] font-semibold text-[color:var(--muted)]">{roleLabel}</div>
                </div>
              </div>
            </div>

            <Link href="/profile/delivery" prefetch={false} className="mt-4 flex items-center justify-between rounded-[22px] bg-[color:var(--surface)] px-3 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <IconMapPin className="h-5 w-5 shrink-0 text-[color:var(--muted)]" />
                <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-wide text-[color:var(--muted)]">доставка</div>
                <div className="mt-0.5 line-clamp-3 whitespace-pre-line text-[13px] font-semibold leading-snug text-[color:var(--text)]">
                  {deliveryPreviewLine || 'добавить адрес и контакт'}
                </div>
                </div>
              </div>
              <span className="text-[color:var(--muted)]">›</span>
            </Link>

            <div className="mt-4 grid grid-cols-3 divide-x divide-[color:var(--stroke)] rounded-[20px] border border-[color:var(--stroke)] bg-[color:var(--surface)]">
              <Link href="/orders?from=profile" prefetch={false} className="px-3 py-3">
                <div className="text-[19px] font-extrabold leading-none text-[color:var(--text)]">{summary.ordersCount}</div>
                <div className="mt-1 text-[11px] font-semibold text-[color:var(--muted)]">заказов</div>
              </Link>
              <Link href="/subscriptions" prefetch={false} className="px-3 py-3">
                <div className="text-[19px] font-extrabold leading-none text-[color:var(--text)]">{summary.activeSubscriptionsCount}</div>
                <div className="mt-1 text-[11px] font-semibold text-[color:var(--muted)]">подписок</div>
              </Link>
              <Link href="/profile/favorites" prefetch={false} className="px-3 py-3">
                <div className="text-[19px] font-extrabold leading-none text-[color:var(--text)]">{summary.favoritesCount}</div>
                <div className="mt-1 text-[11px] font-semibold text-[color:var(--muted)]">любимых</div>
              </Link>
            </div>
          </section>

          <section className={cardClass} style={cardRadius}>
            <div className="px-4 py-2">
              <div className="ui-kicker py-2">мои разделы</div>
              <div className="divide-y divide-[color:var(--stroke)] pb-1">
                <SettingsRow inset href="/profile/favorites" title="избранное" subtitle="любимые блюда" left={<IconHeart className="h-5 w-5 text-[color:var(--text)]" />} />
                <SettingsRow inset href="/orders?from=profile" title="заказы" subtitle="история покупок" left={<IconReceipt className="h-5 w-5 text-[color:var(--text)]" />} />
                <SettingsRow inset href="/subscriptions" title="подписки" subtitle="активные планы" left={<IconBell className="h-5 w-5 text-[color:var(--text)]" />} />
                <SettingsRow inset href="/profile/promocodes" title="мои промокоды" subtitle="акции и бонусы" left={<IconBell className="h-5 w-5 text-[color:var(--text)]" />} />
              </div>
            </div>
          </section>

          <section className={cardClass} style={cardRadius}>
            <div className="px-4 py-2 pb-3">
              <div className="flex items-center justify-between py-2">
                <div className="ui-kicker">{canUseOwnerCabinet ? 'бизнес' : 'для бизнеса'}</div>
                {canUseOwnerCabinet ? (
                  <span className="rounded-lg bg-[color:var(--surface)] px-2 py-1 text-[11px] font-extrabold text-[color:var(--muted)]">
                    Pro
                  </span>
                ) : null}
              </div>
              <div className="divide-y divide-[color:var(--stroke)]">
                {canUseOwnerCabinet ? (
                  <SettingsRow
                    inset
                    href="/profile/owner"
                    title="кабинет заведения"
                    subtitle={isOwner ? 'доступ владельца' : 'режим владельца'}
                    left={<IconCrown className="h-5 w-5 text-[color:var(--text)]" />}
                  />
                ) : (
                  <SettingsRow
                    inset
                    disabled={businessInquiry === 'sent'}
                    onClick={submitBusinessInquiry}
                    title={businessInquiry === 'sent' ? 'заявку отправили' : 'подключить заведение'}
                    subtitle={
                      businessInquiry === 'sent'
                        ? 'ответ придёт в Telegram от команды MOO'
                        : businessInquiry === 'sending'
                          ? 'отправляем…'
                          : 'один тап — заявка в поддержку, без анкеты'
                    }
                    left={
                      <IconCrown
                        className={cn(
                          'h-5 w-5 shrink-0',
                          businessInquiry === 'sent'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-[color:var(--text)]'
                        )}
                      />
                    }
                    right={
                      businessInquiry === 'sent' ? (
                        <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                          <span aria-hidden>✓</span>
                          готово
                        </span>
                      ) : businessInquiry === 'sending' ? (
                        <span className="shrink-0 text-[12px] font-semibold text-[color:var(--muted)]">…</span>
                      ) : businessInquiry === 'error' ? (
                        <span className="shrink-0 text-[11px] font-semibold text-red-600">ещё раз</span>
                      ) : undefined
                    }
                    className={cn(
                      businessInquiry === 'sent' &&
                        'rounded-[18px] border border-emerald-500/30 bg-[color-mix(in_srgb,var(--accent)_08%,var(--surface))] px-1 py-0.5 disabled:opacity-100'
                    )}
                  />
                )}
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}
