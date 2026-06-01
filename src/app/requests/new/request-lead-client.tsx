'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { PageHeader } from '@/components/ui/PageHeader'
import { cn } from '@/lib/utils'

type LeadType = 'catering' | 'banquet' | 'corporate' | 'custom'

const TYPE_OPTIONS: Array<{ value: LeadType; label: string; hint: string; placeholder: string }> = [
  {
    value: 'catering',
    label: 'кейтеринг',
    hint: 'еда на событие',
    placeholder: 'Например: фуршет на 25 человек в офис',
  },
  {
    value: 'banquet',
    label: 'банкет',
    hint: 'праздник или ужин',
    placeholder: 'Например: день рождения, нужны закуски и горячее',
  },
  {
    value: 'corporate',
    label: 'корпоратив',
    hint: 'офис, команда, регулярность',
    placeholder: 'Например: обеды для команды 3 раза в неделю',
  },
  {
    value: 'custom',
    label: 'другое',
    hint: 'любой запрос',
    placeholder: 'Коротко опишите, что нужно',
  },
]

function normalizeType(input: string): LeadType {
  return TYPE_OPTIONS.some((x) => x.value === input) ? (input as LeadType) : 'custom'
}

export function RequestLeadClient({ initialType }: { initialType: string }) {
  const [type, setType] = useState<LeadType>(() => normalizeType(initialType))
  const [title, setTitle] = useState('')
  const [guestCount, setGuestCount] = useState('')
  const [eventDay, setEventDay] = useState('')
  const [eventTime, setEventTime] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [sent, setSent] = useState(false)

  const selected = useMemo(() => TYPE_OPTIONS.find((x) => x.value === type) || TYPE_OPTIONS[0], [type])
  const canSubmit = Boolean(title.trim() || note.trim())
  const eventDate = useMemo(() => {
    if (!eventDay.trim() && !eventTime.trim()) return null
    if (eventDay.trim() && eventTime.trim()) return `${eventDay.trim()}T${eventTime.trim()}`
    return eventDay.trim() || null
  }, [eventDay, eventTime])

  async function submit() {
    if (!canSubmit || saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type,
          title,
          guestCount: guestCount ? Number(guestCount) : null,
          eventDate,
          note,
          source: 'home',
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast.error(data?.error || 'Не удалось отправить')
        return
      }
      setSent(true)
      toast.success('Заявка отправлена')
    } catch {
      toast.error('Ошибка сети')
    } finally {
      setSaving(false)
    }
  }

  if (sent) {
    return (
      <main className="ui-container ui-screen max-w-full overflow-x-hidden !pb-32">
        <PageHeader backHref="/" title="заявка" subtitle="мы всё получили" />
        <div className="ui-surface p-5">
          <div className="text-[20px] font-extrabold tracking-tight text-[color:var(--text)]">Заявка отправлена</div>
          <p className="ui-muted mt-2 text-[14px]">
            Команда заведения получила запрос и свяжется с вами в Telegram.
          </p>
          <Link
            href="/"
            prefetch={false}
            scroll={false}
            className="mt-5 flex h-12 w-full items-center justify-center rounded-full bg-[color:var(--primary)] px-5 text-[14px] font-semibold text-white"
          >
            на главную
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="ui-container ui-screen max-w-full overflow-x-hidden !pb-32">
      <div className="ui-header min-w-0 justify-start">
        <Link href="/" prefetch={false} className="mr-3 shrink-0 text-[26px] leading-none text-[color:var(--muted)]" aria-label="назад">
          ‹
        </Link>
        <div className="min-w-0 flex-1 text-left">
          <div className="ui-title truncate">оставить заявку</div>
          <div className="ui-subtitle mt-1">кейтеринг, банкет, корпоратив или особый запрос</div>
        </div>
      </div>

      <div className="min-w-0 space-y-4">
        <section className="ui-surface min-w-0 p-4">
          <div className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">что нужно</div>
          <div className="grid min-w-0 grid-cols-2 gap-2">
            {TYPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setType(option.value)}
                className={cn(
                  'rounded-[22px] px-3 py-3 text-left transition active:scale-[0.99]',
                  type === option.value
                    ? 'bg-[color:var(--primary)] text-white shadow-[0_12px_28px_rgba(0,0,0,0.12)]'
                    : 'bg-[color:var(--surface)] text-[color:var(--text)]'
                )}
              >
                <span className="block text-[14px] font-extrabold leading-tight">{option.label}</span>
                <span className={cn('mt-1 block text-[11px] font-semibold', type === option.value ? 'text-white/72' : 'text-[color:var(--muted)]')}>
                  {option.hint}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="ui-surface min-w-0 p-4">
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[12px] font-semibold text-[color:var(--muted)]">Коротко</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input input--pill w-full min-w-0"
                placeholder={selected.placeholder}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="min-w-0">
                <label className="mb-1 block text-[12px] font-semibold text-[color:var(--muted)]">Гостей</label>
                <input
                  type="number"
                  min={1}
                  value={guestCount}
                  onChange={(e) => setGuestCount(e.target.value)}
                  className="input input--pill w-full min-w-0"
                  placeholder="25"
                />
              </div>
              <div className="min-w-0">
                <label className="mb-1 block text-[12px] font-semibold text-[color:var(--muted)]">Дата</label>
                <input
                  type="date"
                  value={eventDay}
                  onChange={(e) => setEventDay(e.target.value)}
                  className="input input--pill w-full min-w-0 text-[13px]"
                />
              </div>
            </div>
            <div className="min-w-0">
              <label className="mb-1 block text-[12px] font-semibold text-[color:var(--muted)]">Время, если известно</label>
              <input
                type="time"
                value={eventTime}
                onChange={(e) => setEventTime(e.target.value)}
                className="input input--pill w-full min-w-0 text-[13px]"
              />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-semibold text-[color:var(--muted)]">Комментарий</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="input min-h-[132px] w-full min-w-0 rounded-[24px] px-4 py-3"
                placeholder="Бюджет, адрес, формат, пожелания по меню"
              />
            </div>
          </div>
        </section>

        <button
          type="button"
          disabled={!canSubmit || saving}
          onClick={submit}
          className="flex h-[52px] w-full items-center justify-center rounded-full bg-[color:var(--primary)] px-5 py-4 text-[15px] font-extrabold text-white transition active:scale-[0.99] disabled:opacity-50"
        >
          {saving ? 'отправляем...' : 'отправить заявку'}
        </button>
      </div>
    </main>
  )
}
