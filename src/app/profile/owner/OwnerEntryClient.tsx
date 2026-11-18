'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
import type { OwnerVenue } from '@/lib/restaurant-context'
import { Card, Btn } from '@/components/kit'
import { IconChevronRight, IconHome, IconPlus } from '@/components/ui/icons'

const COOKIE_NAME = 'ufo_restaurant'

export type OwnerEntryVariant = 'onboarding' | 'empty' | 'list'

function clearRestaurantCookie() {
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`
}

async function switchVenue(restaurantId: string): Promise<boolean> {
  const res = await fetch('/api/restaurant/switch', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ restaurantId }),
    credentials: 'include',
  })
  const data = await res.json().catch(() => null)
  return res.ok && data?.ok === true
}

function rowChevron() {
  return <IconChevronRight className="h-4 w-4 shrink-0 text-[color:var(--muted)]" />
}

export function OwnerEntryClient({
  variant,
  venues,
  singleTenant = false,
}: {
  variant: OwnerEntryVariant
  venues: OwnerVenue[]
  singleTenant?: boolean
}) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [switchingId, setSwitchingId] = useState<string | null>(null)

  const goToAdmin = async (restaurantId: string) => {
    setSwitchingId(restaurantId)
    try {
      const ok = await switchVenue(restaurantId)
      if (ok) {
        setSwitchingId(null)
        router.push('/admin')
        return
      }
    } catch {
      // fall through to full navigation
    }
    // POST мог вернуться без ok (редирект/сеть). GET switch выставляет httpOnly cookie и ведёт в /admin — надёжно в Telegram WebView.
    if (typeof window !== 'undefined') {
      const u = `/api/restaurant/switch?venue=${encodeURIComponent(restaurantId)}&redirect=${encodeURIComponent('/admin')}`
      window.location.assign(u)
      return
    }
    router.push(`/admin?venue=${encodeURIComponent(restaurantId)}`)
    setSwitchingId(null)
  }

  const handleDelete = async (v: OwnerVenue) => {
    if (!confirm(`Удалить заведение «${v.name}»? Меню, заказы и настройки будут удалены без возможности восстановления.`)) return
    if (v.id === 'default') return
    setDeletingId(v.id)
    try {
      const res = await fetch(`/api/restaurant/${encodeURIComponent(v.id)}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data.error === 'cannot_delete_default' ? 'Нельзя удалить заведение по умолчанию.' : 'Не удалось удалить.')
        return
      }
      try {
        const current = document.cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`))?.[1]
        if (current && decodeURIComponent(current) === v.id) clearRestaurantCookie()
      } catch {}
      router.refresh()
    } finally {
      setDeletingId(null)
    }
  }

  if (variant === 'onboarding') {
    return (
      <Card>
        <div className="text-[12px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">MOO для заведений</div>
        <p className="mt-2 text-[13px] leading-snug text-[color:var(--muted)]">
          Вы в клиентском режиме. Подключите своё заведение к платформе: меню, заказы и команда в одном кабинете.
        </p>
        <Link href="/profile/restaurant/new" prefetch={false}>
          <Btn full className="mt-4">Подключить заведение</Btn>
        </Link>
        <p className="mt-3 text-[12px] text-[color:var(--muted)]">
          Уже есть доступ? После выдачи роли владельца список заведений появится здесь автоматически.
        </p>
      </Card>
    )
  }

  if (variant === 'empty') {
    return (
      <Card>
        <div className="text-[12px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">кабинет</div>
        <p className="mt-2 text-[13px] leading-snug text-[color:var(--muted)]">
          Не нашли заведение для этого аккаунта. Если вы только что сбросили кэш — откройте список ещё раз или создайте точку.
        </p>
        <Btn variant="secondary" full className="mt-4" onClick={() => router.refresh()}>
          обновить список
        </Btn>
        <Link href="/profile/restaurant/new" prefetch={false}>
          <Btn full className="mt-3">Создать заведение</Btn>
        </Link>
      </Card>
    )
  }

  return (
    <Card className="!p-0 overflow-hidden">
      <p className="px-4 pb-1 pt-4 text-[12px] font-medium leading-snug text-[color:var(--muted)]">
        Выберите заведение, чтобы открыть кабинет владельца.
      </p>
      <ul className="divide-y divide-[color:var(--stroke)] px-4 pb-2">
        {venues.map((v) => (
          <li key={v.id} className="flex items-stretch gap-0">
            <button
              type="button"
              onClick={() => goToAdmin(v.id)}
              disabled={Boolean(switchingId)}
              className="flex min-w-0 flex-1 items-center justify-between gap-3 py-3.5 text-left transition active:opacity-80 disabled:opacity-60"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[color:var(--surface)] text-[color:var(--muted)]">
                  <IconHome className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-semibold text-[color:var(--text)]">{v.name}</span>
                  <span className="mt-0.5 block truncate text-[12px] text-[color:var(--muted)]">
                    {switchingId === v.id ? 'открываем…' : 'кабинет'}
                  </span>
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {rowChevron()}
              </span>
            </button>
            {!singleTenant && v.id !== 'default' ? (
              <div className="flex shrink-0 items-center border-l border-[color:var(--stroke)] px-2">
                <Btn
                  type="button"
                  onClick={() => handleDelete(v)}
                  disabled={deletingId === v.id}
                  variant="danger"
                  className="h-10 rounded-xl px-3 text-[12px]"
                >
                  {deletingId === v.id ? '…' : 'удалить'}
                </Btn>
              </div>
            ) : null}
          </li>
        ))}
        {!singleTenant ? (
          <li>
            <Link
              href="/profile/restaurant/new"
              prefetch={false}
              className="flex items-center justify-between gap-3 py-3.5 text-[14px] font-semibold text-[color:var(--text)] transition active:opacity-80"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[color:var(--surface)] text-[color:var(--muted)]">
                  <IconPlus className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-semibold text-[color:var(--text)]">добавить заведение</span>
                  <span className="mt-0.5 block truncate text-[12px] text-[color:var(--muted)]">создать новую точку</span>
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {rowChevron()}
              </span>
            </Link>
          </li>
        ) : null}
      </ul>
    </Card>
  )
}
