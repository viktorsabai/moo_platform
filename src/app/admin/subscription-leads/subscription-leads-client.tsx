'use client'

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { formatTelegramContact, telegramUserUrl } from '@/lib/telegram-contact'

type Lead = {
  id: string
  userId: string
  telegramId: string | null
  note: string | null
  status: 'NEW' | 'IN_PROGRESS' | 'DONE'
  createdAt: string
  name: string | null
  telegramUsername: string | null
}

const LABEL: Record<Lead['status'], string> = {
  NEW: 'новая',
  IN_PROGRESS: 'в работе',
  DONE: 'закрыта',
}

const NEXT: Record<Lead['status'], Lead['status'][]> = {
  NEW: ['IN_PROGRESS', 'DONE'],
  IN_PROGRESS: ['DONE', 'NEW'],
  DONE: ['IN_PROGRESS'],
}

export function SubscriptionLeadsClient() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/subscription-leads', { cache: 'no-store', credentials: 'include' })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        setError(data?.error || 'Не удалось загрузить лиды')
        setLeads([])
      } else {
        setLeads(Array.isArray(data.leads) ? data.leads : [])
      }
    } catch {
      setError('Ошибка сети')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function setStatus(id: string, status: Lead['status']) {
    setUpdatingId(id)
    try {
      const res = await fetch('/api/admin/subscription-leads', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast.error(data?.error || 'Не удалось обновить')
        return
      }
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)))
    } finally {
      setUpdatingId(id)
      setUpdatingId(null)
    }
  }

  const grouped = useMemo(() => {
    return {
      NEW: leads.filter((l) => l.status === 'NEW'),
      IN_PROGRESS: leads.filter((l) => l.status === 'IN_PROGRESS'),
      DONE: leads.filter((l) => l.status === 'DONE'),
    }
  }, [leads])

  return (
    <main className="ui-container ui-screen !pb-20">
      {loading ? (
        <div className="ui-surface p-4 text-[13px] text-[color:var(--muted)]">загрузка...</div>
      ) : error ? (
        <div className="ui-surface p-4 text-[13px] font-semibold text-red-400">{error}</div>
      ) : leads.length === 0 ? (
        <div className="ui-surface p-4 text-[13px] text-[color:var(--muted)]">Пока нет лидов.</div>
      ) : (
        <div className="space-y-4">
          {(['NEW', 'IN_PROGRESS', 'DONE'] as const).map((status) => (
            <section key={status} className="ui-surface p-4">
              <div className="mb-3 text-[13px] font-bold text-[color:var(--text)]">
                {LABEL[status]}: {grouped[status].length}
              </div>
              <div className="space-y-2">
                {grouped[status].map((lead) => {
                  const contact = formatTelegramContact(lead)
                  const tgUrl = telegramUserUrl(lead.telegramId)
                  return (
                  <div key={lead.id} className="rounded-xl border border-[color:var(--stroke)] bg-[color:var(--surface)] p-3">
                    {tgUrl ? (
                      <a
                        href={tgUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[13px] font-semibold text-[color:var(--primary)]"
                      >
                        {contact}
                      </a>
                    ) : (
                      <div className="text-[13px] font-semibold text-[color:var(--text)]">{contact}</div>
                    )}
                    <div className="mt-0.5 text-[12px] text-[color:var(--muted)]">
                      {new Date(lead.createdAt).toLocaleString('ru-RU')}
                    </div>
                    {lead.note && <div className="mt-2 text-[12px] text-[color:var(--text)]">{lead.note}</div>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {NEXT[lead.status].map((nextStatus) => (
                        <button
                          key={nextStatus}
                          type="button"
                          disabled={updatingId === lead.id}
                          onClick={() => setStatus(lead.id, nextStatus)}
                          className="btn btn-soft rounded-full px-3 py-1.5 text-[12px] font-semibold"
                        >
                          {LABEL[nextStatus]}
                        </button>
                      ))}
                    </div>
                  </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  )
}
