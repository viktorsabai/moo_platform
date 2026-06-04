'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'

type RegistryEvent = {
  id: string
  category: string
  title: string
  description: string
  audience: string
  audienceLabel: string
  trigger: string
  setup: string[]
  webAppButtons?: string[]
  callbackButtons?: string[]
  handler?: string
}

type RegistryCategory = {
  category: string
  label: string
  events: RegistryEvent[]
}

type RegistryResponse = {
  ok: boolean
  setup?: {
    botConnected: boolean
    botUsername: string | null
    webhookConfigured: boolean
    opsRecipientCount: number
    teamTotal: number
    teamWithTelegram: number
    envOwnerIds: boolean
  }
  team?: Array<{
    role: string
    name: string | null
    telegramUsername: string | null
    hasTelegram: boolean
  }>
  categories?: RegistryCategory[]
  error?: string
}

const AUDIENCE_TONE: Record<string, string> = {
  guest: 'bg-[color:var(--primary)]/10 text-[color:var(--primary)]',
  owner: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  platform: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
}

export function AdminNotificationsCatalog() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<RegistryResponse | null>(null)
  const [filter, setFilter] = useState<'all' | 'guest' | 'owner' | 'platform'>('all')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/admin/notifications/registry', { cache: 'no-store', credentials: 'include' })
        const json = (await res.json().catch(() => null)) as RegistryResponse | null
        if (!cancelled) setData(json?.ok ? json : { ok: false, error: json?.error || 'не удалось загрузить' })
      } catch {
        if (!cancelled) setData({ ok: false, error: 'не удалось загрузить' })
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const categories = useMemo(() => {
    const raw = data?.categories ?? []
    if (filter === 'all') return raw
    return raw
      .map((cat) => ({
        ...cat,
        events: cat.events.filter((e) => e.audience === filter),
      }))
      .filter((cat) => cat.events.length > 0)
  }, [data?.categories, filter])

  const setup = data?.setup

  if (loading) {
    return (
      <Card variant="surfaceStrong" className="p-5">
        <div className="text-[14px] text-[color:var(--muted)]">Загрузка каталога уведомлений…</div>
      </Card>
    )
  }

  if (!data?.ok) {
    return (
      <Card variant="surfaceStrong" className="p-5">
        <div className="text-[14px] font-semibold text-[color:var(--text)]">Не удалось загрузить</div>
        <p className="mt-1 text-[13px] text-[color:var(--muted)]">{data?.error || 'ошибка'}</p>
      </Card>
    )
  }

  return (
    <div className="space-y-4 min-w-0">
      <Card variant="surfaceStrong" className="p-5 space-y-4">
        <div>
          <div className="text-[15px] font-semibold text-[color:var(--text)]">Настройка доставки</div>
          <p className="mt-1 text-[13px] text-[color:var(--muted)]">
            Все события идут через Telegram-бота заведения. Команда получает уведомления, если у участника привязан
            Telegram.
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <SetupRow
            ok={setup?.botConnected}
            label="Бот подключён"
            hint={setup?.botUsername ? `@${setup.botUsername}` : 'Настройте в разделе «Заведение»'}
          />
          <SetupRow
            ok={setup?.webhookConfigured}
            label="Webhook"
            hint={setup?.webhookConfigured ? 'настроен' : 'нужен для кнопок в чате'}
          />
          <SetupRow
            ok={(setup?.opsRecipientCount ?? 0) > 0}
            label="Получатели команды"
            hint={`${setup?.teamWithTelegram ?? 0} из ${setup?.teamTotal ?? 0} с Telegram · всего адресов: ${setup?.opsRecipientCount ?? 0}`}
          />
          <SetupRow
            ok={setup?.envOwnerIds}
            label="Запасные chat id (env)"
            hint={setup?.envOwnerIds ? 'UFO_OWNER_NOTIFY_TELEGRAM_IDS' : 'не заданы — опционально'}
            optional
          />
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <Link
            href="/admin/qr"
            className="inline-flex h-9 items-center rounded-full bg-[color:var(--primary)] px-4 text-[13px] font-semibold text-white"
          >
            Бот и интеграция
          </Link>
          <Link
            href="/admin/team"
            className="inline-flex h-9 items-center rounded-full border border-[color:var(--stroke)] px-4 text-[13px] font-medium text-[color:var(--text)]"
          >
            Команда
          </Link>
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['all', 'Все'],
            ['guest', 'Гости'],
            ['owner', 'Команда'],
            ['platform', 'Платформа'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={[
              'h-8 rounded-full px-3 text-[12px] font-medium transition',
              filter === id
                ? 'bg-[color:var(--primary)] text-white'
                : 'bg-[color:var(--surface)] text-[color:var(--muted)] border border-[color:var(--stroke)]',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {categories.map((cat) => (
        <section key={cat.category} className="space-y-2">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">{cat.label}</h2>
          <div className="space-y-2">
            {cat.events.map((event) => (
              <Card key={event.id} variant="surface" className="p-4 min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-semibold text-[color:var(--text)]">{event.title}</div>
                    <p className="mt-1 text-[13px] text-[color:var(--muted)]">{event.description}</p>
                  </div>
                  <span
                    className={[
                      'shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium',
                      AUDIENCE_TONE[event.audience] ?? 'bg-[color:var(--surface)] text-[color:var(--muted)]',
                    ].join(' ')}
                  >
                    {event.audienceLabel}
                  </span>
                </div>

                <dl className="mt-3 grid gap-2 text-[12px]">
                  <div>
                    <dt className="font-medium text-[color:var(--muted)]">Когда</dt>
                    <dd className="mt-0.5 font-mono text-[11px] text-[color:var(--text)] break-all">{event.trigger}</dd>
                  </div>
                  {event.setup.length > 0 && (
                    <div>
                      <dt className="font-medium text-[color:var(--muted)]">Настройка</dt>
                      <dd className="mt-0.5 text-[color:var(--text)]">{event.setup.join(' · ')}</dd>
                    </div>
                  )}
                  {(event.webAppButtons?.length || event.callbackButtons?.length) && (
                    <div>
                      <dt className="font-medium text-[color:var(--muted)]">Кнопки</dt>
                      <dd className="mt-0.5 flex flex-wrap gap-1">
                        {event.webAppButtons?.map((b) => (
                          <code
                            key={b}
                            className="rounded bg-[color:var(--surface)] px-1.5 py-0.5 text-[10px] text-[color:var(--text)]"
                          >
                            {b}
                          </code>
                        ))}
                        {event.callbackButtons?.map((b) => (
                          <code
                            key={b}
                            className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-800 dark:text-amber-200"
                          >
                            {b}
                          </code>
                        ))}
                      </dd>
                    </div>
                  )}
                </dl>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function SetupRow({
  ok,
  label,
  hint,
  optional,
}: {
  ok?: boolean
  label: string
  hint: string
  optional?: boolean
}) {
  const tone = ok ? 'text-emerald-600 dark:text-emerald-400' : optional ? 'text-[color:var(--muted)]' : 'text-amber-600 dark:text-amber-400'
  const icon = ok ? '✓' : optional ? '·' : '!'
  return (
    <div className="rounded-xl border border-[color:var(--stroke)] bg-[color:var(--surface)] p-3">
      <div className={`text-[13px] font-semibold ${tone}`}>
        {icon} {label}
      </div>
      <div className="mt-0.5 text-[12px] text-[color:var(--muted)]">{hint}</div>
    </div>
  )
}
