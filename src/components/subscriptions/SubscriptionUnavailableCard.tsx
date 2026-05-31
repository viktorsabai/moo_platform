'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { useVenue } from '@/lib/venue-context'
import { cn } from '@/lib/utils'
import { telegramInitHeaderRecord } from '@/lib/tg-webapp-client'

const cardRadius = { borderRadius: 'var(--radius-large)' } as const

export function SubscriptionUnavailableCard({ className }: { className?: string }) {
  const { name: venueName } = useVenue()
  const [submitting, setSubmitting] = useState(false)
  const [note, setNote] = useState('')
  const [done, setDone] = useState(false)
  const [inlineStatus, setInlineStatus] = useState<string | null>(null)

  async function submitRequest() {
    if (submitting || done) return
    setSubmitting(true)
    setInlineStatus(null)
    try {
      const res = await fetch('/api/subscription-requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...telegramInitHeaderRecord() },
        credentials: 'include',
        body: JSON.stringify({ note }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast.error(data?.error || 'Не удалось отправить заявку')
        setInlineStatus('Не удалось отправить. Попробуйте ещё раз.')
        return
      }
      setDone(true)
      setInlineStatus(data?.warning || 'Готово.')
      toast.success('Запрос отправлен владельцу')
    } catch {
      toast.error('Ошибка сети')
      setInlineStatus('Проверьте интернет и повторите.')
    } finally {
      setSubmitting(false)
    }
  }

  const venue = venueName?.trim()

  return (
    <div
      className={cn('ui-surface-card mx-auto w-full max-w-md p-4 sm:p-5', className)}
      style={cardRadius}
      aria-label="подписки недоступны"
    >
      <p className="ui-muted text-[13px] leading-relaxed">
        {venue
          ? `В «${venue}» рационы по подписке пока не включены. Заявка уйдёт владельцу.`
          : 'Рационы по подписке здесь пока не включены. Заявка уйдёт владельцу.'}
      </p>

      <details className="group mt-4">
        <summary className="cursor-pointer list-none text-[12px] font-semibold text-[color:var(--text)] [&::-webkit-details-marker]:hidden">
          комментарий
          <span className="font-medium text-[color:var(--muted)]"> · по желанию</span>
        </summary>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="например: хотим завтраки в будни"
          className="input mt-2 min-h-[72px] w-full resize-y py-2.5 text-[13px]"
          disabled={done}
        />
      </details>

      <button
        type="button"
        onClick={submitRequest}
        disabled={submitting || done}
        className="btn btn-primary mt-4 w-full rounded-full py-2.5 text-[13px] font-semibold disabled:opacity-60"
        style={{ borderRadius: 'var(--radius-pill)' }}
      >
        {done ? 'заявка отправлена' : submitting ? 'отправляем…' : 'хочу подписку'}
      </button>
      {inlineStatus ? (
        <p className="mt-3 text-center text-[12px] font-medium text-[color:var(--muted)]">{inlineStatus}</p>
      ) : null}
    </div>
  )
}
