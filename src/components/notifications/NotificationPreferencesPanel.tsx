'use client'

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Card } from '@/components/ui/Card'

const MODE_LABELS = {
  INSTANT: 'сразу',
  DIGEST: 'дайджест',
  OFF: 'выкл',
} as const

type Mode = keyof typeof MODE_LABELS
type EventRow = {
  id: string
  category: string
  title: string
  description: string
  audience: string
  mode: Mode
  canDigest: boolean
}

type Response = {
  ok: boolean
  audience?: 'guest' | 'owner'
  role?: string
  events?: EventRow[]
  error?: string
}

const CATEGORY_LABELS: Record<string, string> = {
  orders: 'заказы',
  subscriptions: 'подписки',
  leads: 'заявки',
  marketing: 'маркетинг и CRM',
  system: 'система',
}

export function NotificationPreferencesPanel({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<Response | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/notifications/preferences', { cache: 'no-store', credentials: 'include' })
      const json = (await res.json().catch(() => null)) as Response | null
      setData(json?.ok ? json : { ok: false, error: json?.error || 'не удалось загрузить настройки' })
    } catch {
      setData({ ok: false, error: 'не удалось загрузить настройки' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const groups = useMemo(() => {
    const map = new Map<string, EventRow[]>()
    for (const event of data?.events || []) {
      const list = map.get(event.category) || []
      list.push(event)
      map.set(event.category, list)
    }
    return Array.from(map.entries())
  }, [data?.events])

  async function changeMode(event: EventRow, mode: Mode) {
    if (saving) return
    const previous = data?.events || []
    setData((current) => current ? { ...current, events: current.events?.map((item) => item.id === event.id ? { ...item, mode } : item) } : current)
    setSaving(event.id)
    try {
      const res = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ eventId: event.id, mode }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'save_failed')
      toast.success('настройка сохранена')
    } catch {
      setData((current) => current ? { ...current, events: previous } : current)
      toast.error('не удалось сохранить настройку')
    } finally {
      setSaving(null)
    }
  }

  if (loading) return <Card variant="surfaceStrong" className="p-4 text-[13px] text-[color:var(--muted)]">Загрузка подписок…</Card>
  if (!data?.ok) return <Card variant="surfaceStrong" className="p-4 text-[13px] text-[color:var(--muted)]">{data?.error || 'Настройки недоступны'}</Card>

  return (
    <div className="space-y-4">
      <Card variant="surfaceStrong" className={compact ? 'p-4' : 'p-5'}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[15px] font-extrabold">подписки в Telegram</div>
            <p className="mt-1 text-[13px] leading-relaxed text-[color:var(--muted)]">
              {data.audience === 'owner'
                ? 'Настройте, какие рабочие события получает именно ваша роль в боте заведения.'
                : 'Выберите, какие сервисные сообщения помогут не потерять заказ или подписку.'}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-[color:var(--primary)]/10 px-2.5 py-1 text-[11px] font-bold text-[color:var(--primary)]">
            {data.role || data.audience}
          </span>
        </div>
      </Card>

      {groups.map(([category, events]) => (
        <section key={category} className="space-y-2">
          <h2 className="px-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--muted)]">{CATEGORY_LABELS[category] || category}</h2>
          {events.map((event) => (
            <Card key={event.id} variant="surface" className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[14px] font-extrabold">{event.title}</div>
                  <p className="mt-1 text-[12px] leading-relaxed text-[color:var(--muted)]">{event.description}</p>
                </div>
                <span className="shrink-0 text-[11px] text-[color:var(--muted)]">{saving === event.id ? 'сохраняем…' : MODE_LABELS[event.mode]}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(['INSTANT', 'DIGEST', 'OFF'] as Mode[]).map((mode) => {
                  const disabled = mode === 'DIGEST' && !event.canDigest
                  return (
                    <button
                      key={mode}
                      type="button"
                      disabled={disabled || saving !== null}
                      onClick={() => void changeMode(event, mode)}
                      className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-35 ${event.mode === mode ? 'border-[color:var(--primary)] bg-[color:var(--primary)] text-white' : 'border-[color:var(--stroke)] text-[color:var(--muted)]'}`}
                    >
                      {MODE_LABELS[mode]}
                    </button>
                  )
                })}
              </div>
            </Card>
          ))}
        </section>
      ))}
    </div>
  )
}
