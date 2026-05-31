'use client'

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { PageHeader } from '@/components/ui/PageHeader'
import { cn } from '@/lib/utils'

type LeadStatus = 'NEW' | 'IN_PROGRESS' | 'DONE'

type Lead = {
  id: string
  type: string
  title: string | null
  note: string | null
  guestCount: number | null
  eventDate: string | null
  status: LeadStatus
  telegramId: string | null
  name: string | null
  phone: string | null
  createdAt: string
  user?: { name: string | null; telegramUsername: string | null; phone: string | null } | null
}

const STATUS_LABEL: Record<LeadStatus, string> = {
  NEW: 'новая',
  IN_PROGRESS: 'в работе',
  DONE: 'закрыта',
}

const TYPE_LABEL: Record<string, string> = {
  catering: 'кейтеринг',
  banquet: 'банкет',
  corporate: 'корпоратив',
  custom: 'заявка',
}

const NEXT: Record<LeadStatus, LeadStatus[]> = {
  NEW: ['IN_PROGRESS', 'DONE'],
  IN_PROGRESS: ['DONE', 'NEW'],
  DONE: ['IN_PROGRESS'],
}

export function AdminLeadsClient() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/leads', { cache: 'no-store', credentials: 'include' })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        setError(data?.error || 'Не удалось загрузить заявки')
        setLeads([])
        return
      }
      setLeads(Array.isArray(data.leads) ? data.leads : [])
    } catch {
      setError('Ошибка сети')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function setStatus(id: string, status: LeadStatus) {
    setUpdatingId(id)
    try {
      const res = await fetch('/api/admin/leads', {
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
      toast.success('Статус обновлён')
    } catch {
      toast.error('Ошибка сохранения')
    } finally {
      setUpdatingId(null)
    }
  }

  const grouped = useMemo(() => ({
    NEW: leads.filter((l) => l.status === 'NEW'),
    IN_PROGRESS: leads.filter((l) => l.status === 'IN_PROGRESS'),
    DONE: leads.filter((l) => l.status === 'DONE'),
  }), [leads])

  return (
    <main className="ui-container ui-screen !pb-20">
      <PageHeader backHref="/admin" title="заявки" subtitle="кейтеринг, банкеты, корпоративы и особые запросы" />

      {loading ? (
        <div className="ui-surface p-4 text-[13px] text-[color:var(--muted)]">загрузка...</div>
      ) : error ? (
        <div className="ui-surface p-4 text-[13px] font-semibold text-red-500">{error}</div>
      ) : leads.length === 0 ? (
        <div className="ui-surface p-4">
          <div className="text-[14px] font-semibold text-[color:var(--text)]">Пока нет заявок</div>
          <p className="ui-muted mt-1 text-[13px]">Добавьте баннер “заявка” на главную, чтобы пользователи оставляли запросы.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {(['NEW', 'IN_PROGRESS', 'DONE'] as const).map((status) => (
            <section key={status} className="ui-surface p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-[13px] font-bold text-[color:var(--text)]">
                  {STATUS_LABEL[status]}
                </div>
                <span className="rounded-full bg-black/[0.06] px-2.5 py-1 text-[11px] font-bold text-black/55">
                  {grouped[status].length}
                </span>
              </div>
              <div className="space-y-2">
                {grouped[status].map((lead) => {
                  const userName = lead.name || lead.user?.name || lead.user?.telegramUsername || lead.telegramId || 'Клиент'
                  const phone = lead.phone || lead.user?.phone
                  return (
                    <div key={lead.id} className="rounded-[22px] border border-[color:var(--stroke)] bg-[color:var(--surface)] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[13px] font-extrabold text-[color:var(--text)]">{userName}</div>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            <span className="rounded-full bg-black/[0.06] px-2 py-1 text-[11px] font-bold text-black/55">
                              {TYPE_LABEL[lead.type] ?? lead.type}
                            </span>
                            {lead.guestCount ? (
                              <span className="rounded-full bg-black/[0.06] px-2 py-1 text-[11px] font-bold text-black/55">
                                {lead.guestCount} гостей
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className="shrink-0 text-right text-[11px] font-medium text-black/40">
                          {new Date(lead.createdAt).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
                        </div>
                      </div>
                      {lead.title ? <div className="mt-3 text-[13px] font-semibold text-[color:var(--text)]">{lead.title}</div> : null}
                      {lead.eventDate ? (
                        <div className="mt-1 text-[12px] font-medium text-[color:var(--muted)]">
                          дата: {new Date(lead.eventDate).toLocaleString('ru-RU')}
                        </div>
                      ) : null}
                      {phone ? <div className="mt-1 text-[12px] font-medium text-[color:var(--muted)]">тел: {phone}</div> : null}
                      {lead.note ? <div className="mt-2 text-[12px] leading-snug text-[color:var(--text)]">{lead.note}</div> : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {NEXT[lead.status].map((nextStatus) => (
                          <button
                            key={nextStatus}
                            type="button"
                            disabled={updatingId === lead.id}
                            onClick={() => setStatus(lead.id, nextStatus)}
                            className={cn(
                              'rounded-full px-3 py-1.5 text-[12px] font-semibold transition disabled:opacity-50',
                              nextStatus === 'DONE'
                                ? 'bg-black/[0.06] text-black/60'
                                : 'bg-[color:var(--primary)] text-white'
                            )}
                          >
                            {STATUS_LABEL[nextStatus]}
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
