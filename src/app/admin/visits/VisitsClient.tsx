'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  buildGuestToCampaignHref,
  buildVisitsFilterHref,
  deriveGuestCrm,
  guestMatchesListFocus,
  normalizeGuestListFocus,
  recommendedActionHint,
  type GuestListFocus,
} from '@/lib/guest-crm'
import { cn } from '@/lib/utils'
import { GuestClientCard, guestClientFromSubscriptionUser } from '@/components/ui/GuestClientCard'
import { UserAvatar } from '@/components/ui/UserAvatar'

const TZ = 'Asia/Bangkok'

export type SerializedActivityEvent = {
  id: string
  type: string
  path: string | null
  metadata: unknown
  createdAt: string
}

export type SerializedGuest = {
  key: string
  name: string
  displayName: string
  contactLabel: string | null
  photoUrl: string | null
  telegramId: string | null
  lastAt: string
  isFresh: boolean
  events: SerializedActivityEvent[]
  views: number
  dishViews: number
  cartAdds: number
  favorites: number
  checkoutStarts: number
  orders: number
  interests: string[]
  statusTone: 'hot' | 'warm' | 'neutral' | 'done'
}

export type SerializedDaily = { day: string; views: number; carts: number; checkouts: number }

type Props = {
  days: number
  selectedType: string
  selectedFocus: string
  summary: {
    views: number
    visitors: number
    carts: number
    checkouts: number
    favorites: number
    menuViews24h: number
    menuGuests24h: number
    firstTimeGuests: number
  }
  daily: SerializedDaily[]
  guests: SerializedGuest[]
  counts: {
    opportunity: number
    browsing: number
    cartDrop: number
    checkoutDrop: number
    loyal: number
    hotGuests: number
  }
  missingSchema: boolean
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: TZ,
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

function formatDay(iso: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: TZ,
    day: '2-digit',
    month: 'short',
  }).format(new Date(iso))
}

function eventLabel(type: string) {
  switch (type) {
    case 'VIEW_PAGE':
      return 'просмотр'
    case 'VIEW_DISH':
      return 'блюдо'
    case 'CART_WITH_ITEMS':
      return 'корзина'
    case 'ADD_TO_CART':
      return 'в корзину'
    case 'START_CHECKOUT':
      return 'чекаут'
    case 'ADD_FAVORITE':
      return 'избранное'
    case 'SUBMIT_ORDER':
      return 'заказ'
    default:
      return type.toLowerCase()
  }
}

function metadataName(event: SerializedActivityEvent) {
  const m = event.metadata as Record<string, unknown> | null
  const base = m?.name || m?.dishName || m?.productName
  const baseName = typeof base === 'string' ? base.trim() : ''
  return baseName
}

function crmMetricsFromSerialized(g: SerializedGuest) {
  return {
    views: g.views,
    dishViews: g.dishViews,
    cartAdds: g.cartAdds,
    favorites: g.favorites,
    checkoutStarts: g.checkoutStarts,
    orders: g.orders,
    isFresh: g.isFresh,
    interests: g.interests,
  }
}

function guestCardInfo(g: SerializedGuest) {
  return guestClientFromSubscriptionUser({
    displayName: g.displayName || g.name,
    contactLabel: g.contactLabel ?? undefined,
    telegramId: g.telegramId,
    telegramPhotoUrl: g.photoUrl,
  })
}

export function VisitsClient({
  days,
  selectedType,
  selectedFocus: selectedFocusRaw,
  summary,
  daily,
  guests,
  counts,
  missingSchema,
}: Props) {
  const selectedFocus = normalizeGuestListFocus(selectedFocusRaw)
  const [panelGuestKey, setPanelGuestKey] = useState<string | null>(null)

  const filtered = useMemo(
    () =>
      guests.filter((g) =>
        guestMatchesListFocus(
          {
            ...crmMetricsFromSerialized(g),
            statusTone: g.statusTone,
          },
          selectedFocus
        )
      ),
    [guests, selectedFocus]
  )

  const panelGuest = useMemo(
    () => (panelGuestKey ? guests.find((g) => g.key === panelGuestKey) ?? null : null),
    [guests, panelGuestKey]
  )

  const maxDaily = Math.max(1, ...daily.map((row) => Number(row.views ?? 0) + Number(row.carts ?? 0) + Number(row.checkouts ?? 0)))

  const closePanel = useCallback(() => setPanelGuestKey(null), [])

  useEffect(() => {
    if (!panelGuestKey) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePanel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panelGuestKey, closePanel])

  const chip = (active: boolean, className?: string) =>
    cn(
      'inline-flex h-9 shrink-0 items-center rounded-full px-3.5 text-[12px] font-semibold transition',
      active
        ? 'bg-[color:var(--text)] text-[color:var(--surface)]'
        : 'border border-[color:var(--stroke)] bg-[color:var(--surface)] text-[color:var(--text)]',
      className
    )

  const insightChip = (focus: GuestListFocus, label: string, value: number, tone: string) => {
    const active = selectedFocus === focus
    const bg =
      tone === 'violet'
        ? 'border-violet-500/30 bg-violet-500/[0.07]'
        : tone === 'amber'
          ? 'border-amber-400/35 bg-amber-400/[0.1]'
          : tone === 'rose'
            ? 'border-rose-400/35 bg-rose-500/[0.07]'
            : tone === 'orange'
              ? 'border-orange-400/35 bg-orange-400/[0.09]'
              : 'border-emerald-500/30 bg-emerald-500/[0.07]'
    return (
      <Link
        key={focus}
        href={buildVisitsFilterHref(days, selectedType, focus)}
        prefetch={false}
        scroll={false}
        className={cn(
          'flex min-w-[132px] shrink-0 flex-col rounded-[16px] border px-2.5 py-2',
          active ? 'border-2 border-[color:var(--primary)]' : 'border border-[color:var(--stroke)]',
          bg
        )}
      >
        <span className="text-[18px] font-extrabold leading-none text-[color:var(--text)]">{value}</span>
        <span className="mt-1 text-[10px] font-semibold leading-tight text-[color:var(--text)]">{label}</span>
      </Link>
    )
  }

  return (
    <main className="ui-container ui-screen !pb-24 min-w-0 max-w-full overflow-x-hidden">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h1 className="text-[20px] font-extrabold tracking-tight text-[color:var(--text)]">Гости</h1>
        <span className="text-[10px] font-medium text-[color:var(--muted)]">Asia/Bangkok</span>
      </header>

      <section
        className="ui-surface-card mb-3 p-2.5"
        style={{ borderRadius: 'var(--radius-large)' }}
      >
        <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(
            [
              [1, 'сегодня'],
              [7, '7 дней'],
              [30, '30 дней'],
            ] as const
          ).map(([value, label]) => (
            <Link
              key={value}
              href={buildVisitsFilterHref(Number(value), selectedType, selectedFocus)}
              prefetch={false}
              scroll={false}
              className={cn(
                chip(days === value),
                days === value && 'bg-[color:var(--primary)] text-white'
              )}
            >
              {label}
            </Link>
          ))}
          <span className="mx-1 w-px shrink-0 self-stretch bg-[color:var(--stroke)]" aria-hidden />
          {(
            [
              ['ALL', 'все'],
              ['VIEW_PAGE', 'просмотры'],
              ['VIEW_DISH', 'блюда'],
              ['ADD_FAVORITE', 'избранное'],
              ['ADD_TO_CART', 'корзина'],
              ['START_CHECKOUT', 'чекаут'],
            ] as const
          ).map(([value, label]) => (
            <Link
              key={value}
              href={buildVisitsFilterHref(days, value, selectedFocus)}
              prefetch={false}
              scroll={false}
              className={chip(selectedType === value)}
            >
              {label}
            </Link>
          ))}
        </div>

        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {insightChip('OPPORTUNITY', 'конверт', counts.opportunity, 'violet')}
          {insightChip('BROWSING', 'смотрят', counts.browsing, 'amber')}
          {insightChip('CART_DROP', 'корзина', counts.cartDrop, 'rose')}
          {insightChip('CHECKOUT_DROP', 'чекаут', counts.checkoutDrop, 'orange')}
          {insightChip('LOYAL', 'лояльные', counts.loyal, 'emerald')}
          <Link
            href={buildVisitsFilterHref(days, selectedType, 'ALL')}
            prefetch={false}
            scroll={false}
            className={chip(selectedFocus === 'ALL', 'ml-0.5')}
          >
            сброс
          </Link>
        </div>

        <details className="mt-2 rounded-[12px] border border-[color:var(--stroke)] px-2 py-1.5">
          <summary className="cursor-pointer list-none text-[10px] font-bold text-[color:var(--muted)] [&::-webkit-details-marker]:hidden">
            ещё фильтры и цифры за период
          </summary>
          <div className="mt-2 flex flex-wrap gap-1">
            {(
              [
                ['NEW', 'new 24ч'],
                ['HOT', 'горячие'],
                ['FAVORITES', 'избранное'],
                ['CARTS', 'корзина'],
                ['CHECKOUTS', 'чекаут'],
              ] as const
            ).map(([focus, label]) => (
              <Link
                key={focus}
                href={buildVisitsFilterHref(days, selectedType, focus)}
                prefetch={false}
                scroll={false}
                className={chip(selectedFocus === focus, '!h-8 !px-2.5 !text-[11px]')}
              >
                {label}
              </Link>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {[
              ['открытий меню', summary.views],
              ['уник. гостей', summary.visitors],
              ['впервые за период', summary.firstTimeGuests],
              ['горячие', counts.hotGuests],
              ['избранное', summary.favorites],
              ['корзины', summary.carts],
              ['чекаут', summary.checkouts],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-[10px] bg-[color:var(--surface-strong)] px-2 py-1.5">
                <div className="text-[14px] font-extrabold text-[color:var(--text)]">{value}</div>
                <div className="text-[8px] font-bold uppercase leading-tight text-[color:var(--muted)]">{label}</div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] leading-snug text-[color:var(--muted)]">
            Срез «меню · 24 ч»: {summary.menuViews24h} открытий страниц · {summary.menuGuests24h} уникальных — только
            просмотры витрины, без корзины и чекаута.
          </p>
        </details>
      </section>

      <section className="ui-surface-card mb-3 p-3" style={{ borderRadius: 'var(--radius-large)' }}>
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] font-bold uppercase tracking-wide text-[color:var(--muted)]">динамика</div>
          <Link
            href={buildVisitsFilterHref(days, selectedType, selectedFocus)}
            prefetch={false}
            scroll={false}
            className="text-[11px] font-semibold text-[color:var(--muted)]"
          >
            обновить
          </Link>
        </div>
        {daily.length === 0 ? (
          <p className="mt-3 text-[13px] text-[color:var(--muted)]">Пока нет данных для графика.</p>
        ) : (
          <div className="mt-3 space-y-2">
            <svg viewBox="0 0 100 36" className="h-24 w-full overflow-visible">
              <polyline fill="none" stroke="var(--stroke)" strokeWidth="0.6" points="0,35 100,35" />
              <polyline
                fill="none"
                stroke="var(--primary)"
                strokeWidth="2.2"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={daily.map((row, index) => {
                  const total = Number(row.views ?? 0) + Number(row.carts ?? 0) + Number(row.checkouts ?? 0)
                  const x = daily.length <= 1 ? 50 : (index / (daily.length - 1)) * 100
                  const y = 34 - (Math.max(0, total) / maxDaily) * 30
                  return `${x},${Math.max(2, Math.min(34, y))}`
                }).join(' ')}
              />
            </svg>
            <div className="flex justify-between text-[10px] font-semibold text-[color:var(--muted)]">
              <span>{formatDay(daily[0].day)}</span>
              <span>{formatDay(daily[daily.length - 1].day)}</span>
            </div>
          </div>
        )}
      </section>

      <section className="ui-surface-card overflow-hidden p-0" style={{ borderRadius: 'var(--radius-large)' }}>
        <div className="border-b border-[color:var(--stroke)] px-3 py-2.5">
          <div className="text-[11px] font-bold uppercase tracking-wide text-[color:var(--muted)]">гости</div>
          <p className="mt-0.5 text-[11px] text-[color:var(--muted)]">
            сортировка по последнему заходу сверху вниз · тап — карточка и акция
          </p>
        </div>
        {missingSchema ? (
          <p className="p-4 text-[13px] leading-relaxed text-[color:var(--muted)]">
            Не удалось загрузить события из базы (ошибка запроса). Нажмите «обновить» выше или откройте страницу ещё раз. Если после миграции Prisma таблица
            <code className="mx-0.5 rounded bg-[color:var(--surface-strong)] px-1">UserActivityEvent</code>
            ещё не создана — выполните migrate deploy.
          </p>
        ) : guests.length === 0 ? (
          <div className="p-4 text-[13px] leading-relaxed text-[color:var(--muted)]">
            <p>Пока нет событий за выбранный период для этого заведения.</p>
            <p className="mt-2">
              Счётчик пишется из мини‑приложения (просмотры, корзина, чекаут). Если гости заходили в другом контексте
              заведения или до включения трекинга — здесь будет пусто.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-4 text-[13px] text-[color:var(--muted)]">По этому фильтру никого нет — нажмите «сброс» или другую карточку сверху.</p>
        ) : (
          <ul className="divide-y divide-[color:var(--stroke)]">
            {filtered.map((g) => {
              const crm = deriveGuestCrm(crmMetricsFromSerialized(g))
              const short =
                g.orders > 0
                  ? `${g.orders} заказ(ов) · ${g.views} откр. меню`
                  : `${g.views} откр. меню · ${g.dishViews} блюд · ${g.favorites} избр.`
              return (
                <li key={g.key}>
                  <button
                    type="button"
                    onClick={() => setPanelGuestKey(g.key)}
                    className="flex w-full items-center gap-3 px-3 py-3 text-left transition active:bg-[color:var(--surface-strong)]"
                  >
                    <UserAvatar name={g.displayName || g.name} photoUrl={g.photoUrl} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-[15px] font-extrabold text-[color:var(--text)]">
                          {g.displayName || g.name}
                        </span>
                        {g.contactLabel ? (
                          <span className="truncate text-[12px] font-semibold text-[color:var(--primary)]">
                            {g.contactLabel}
                          </span>
                        ) : null}
                        {g.isFresh ? (
                          <span className="shrink-0 rounded-full bg-[color:var(--primary)] px-1.5 py-0.5 text-[8px] font-extrabold text-[color:var(--surface)]">
                            new
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 text-[12px] font-semibold text-[color:var(--text)]">
                        {crm.segmentEmoji} {crm.segmentLabel}
                      </div>
                      <div className="mt-0.5 truncate text-[11px] text-[color:var(--muted)]">{short}</div>
                      <div className="mt-0.5 text-[10px] font-medium text-[color:var(--muted)]">
                        был {formatDate(g.lastAt)}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-[color:var(--text)] px-3 py-1.5 text-[11px] font-bold text-[color:var(--surface)]">
                      открыть
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {panelGuest ? (
        <GuestDetailPanel
          guest={panelGuest}
          onClose={closePanel}
          formatDate={formatDate}
        />
      ) : null}
    </main>
  )
}

function GuestDetailPanel({
  guest,
  onClose,
  formatDate,
}: {
  guest: SerializedGuest
  onClose: () => void
  formatDate: (iso: string) => string
}) {
  const crm = deriveGuestCrm(crmMetricsFromSerialized(guest))
  const hint = recommendedActionHint(crm.crmSeg)
  const campaignHref = buildGuestToCampaignHref({
    crmSeg: crm.crmSeg,
    telegramId: guest.telegramId,
    guestName: guest.name,
  })

  return (
    <div
      className="fixed inset-0 z-[120] flex flex-col justify-end bg-black/45 p-0 sm:items-center sm:justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Карточка гостя"
    >
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Закрыть" onClick={onClose} />
      <div
        className="relative z-[121] max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-[22px] border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] shadow-2xl sm:rounded-[var(--radius-large)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[color:var(--stroke)] bg-[color:var(--surface-strong)] px-4 py-3">
          <GuestClientCard client={guestCardInfo(guest)} variant="row" meta={`был ${formatDate(guest.lastAt)}`} />
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full bg-[color:var(--surface)] px-3 py-1.5 text-[12px] font-bold text-[color:var(--text)]"
          >
            закрыть
          </button>
        </div>

        <div className="space-y-4 px-4 py-4">
          <div className="rounded-[18px] border border-[color:var(--stroke)] bg-[color:var(--surface)] px-3 py-3">
            <div className="text-[13px] font-extrabold text-[color:var(--text)]">
              {crm.segmentEmoji} {crm.segmentLabel}
            </div>
            <p className="mt-1 text-[13px] leading-snug text-[color:var(--muted)]">{crm.insightLine}</p>
            <div className="mt-3 grid grid-cols-3 gap-1.5 text-center sm:grid-cols-5">
              {[
                ['меню', guest.views],
                ['блюда', guest.dishViews],
                ['избр.', guest.favorites],
                ['корз.', guest.cartAdds],
                ['заказы', guest.orders],
              ].map(([l, v]) => (
                <div key={String(l)} className="rounded-[12px] bg-[color:var(--surface-strong)] py-2">
                  <div className="text-[15px] font-extrabold text-[color:var(--text)]">{v}</div>
                  <div className="text-[8px] font-bold uppercase text-[color:var(--muted)]">{l}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[18px] border-2 border-amber-400/50 bg-amber-400/[0.08] px-3 py-3">
            <div className="text-[10px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">
              рекомендуем
            </div>
            <div className="mt-1 text-[14px] font-extrabold text-[color:var(--text)]">{hint.title}</div>
            <p className="mt-1 text-[12px] leading-snug text-[color:var(--text)]">{hint.body}</p>
          </div>

          <div className="flex flex-col gap-2">
            <Link
              href={campaignHref}
              prefetch={false}
              className="flex h-12 w-full items-center justify-center rounded-full bg-[color:var(--primary)] text-[14px] font-extrabold text-white"
            >
              создать акцию
            </Link>
            {guest.telegramId ? (
              <a
                href={`tg://user?id=${encodeURIComponent(guest.telegramId)}`}
                className="flex h-11 w-full items-center justify-center rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface)] text-[13px] font-bold text-[color:var(--text)] transition active:opacity-90"
              >
                написать в Telegram
              </a>
            ) : (
              <p className="text-center text-[11px] font-medium text-[color:var(--muted)]">
                Нет Telegram ID — пишите гостю только после привязки аккаунта в приложении.
              </p>
            )}
          </div>

          <div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">хронология</div>
            <ul className="mt-2 max-h-[40vh] space-y-2 overflow-y-auto">
              {guest.events.slice(0, 40).map((ev) => (
                <li key={ev.id} className="flex justify-between gap-2 text-[11px]">
                  <span className="min-w-0 truncate text-[color:var(--muted)]">
                    {eventLabel(ev.type)} · {metadataName(ev) || ev.path || '/'}
                  </span>
                  <span className="shrink-0 text-[color:var(--muted)]">{formatDate(ev.createdAt)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
