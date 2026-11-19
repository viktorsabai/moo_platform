'use client'

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Screen, Card, Chip, Badge, Empty } from '@/components/kit'
import { formatTelegramContact, telegramUserUrl } from '@/lib/telegram-contact'

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
  createdAt: string
  user?: { name: string | null; telegramUsername: string | null; telegramId: string | null } | null
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
    <Screen title="заявки" subtitle="кейтеринг, банкеты, корпоративы и особые запросы" back="/admin/more" className="!pb-20">
      {loading ? (
        <Card className="text-[13px] text-[color:var(--muted)]">загрузка...</Card>
      ) : error ? (
        <Card className="text-[13px] font-semibold text-[color:var(--danger)]">{error}</Card>
      ) : leads.length === 0 ? (
        <Empty title="Пока нет заявок" hint="Добавьте баннер «заявка» на главную, чтобы пользователи оставляли запросы." />
      ) : (
        <div className="space-y-4">
          {(['NEW', 'IN_PROGRESS', 'DONE'] as const).map((status) => (
            <Card key={status}>
              <div className="mb-3 flex items-center justify-between">
                <div className="text-[13px] font-bold text-[color:var(--text)]">
                  {STATUS_LABEL[status]}
                </div>
                <Badge tone="muted">{grouped[status].length}</Badge>
              </div>
              <div className="space-y-2">
                {grouped[status].map((lead) => {
                  const contact = formatTelegramContact({
                    name: lead.name || lead.user?.name,
                    telegramUsername: lead.user?.telegramUsername,
                    telegramId: lead.telegramId || lead.user?.telegramId,
                  })
                  const tgUrl = telegramUserUrl(lead.telegramId || lead.user?.telegramId)
                  return (
                    <div key={lead.id} className="rounded-[22px] border border-[color:var(--stroke)] bg-[color:var(--surface)] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          {tgUrl ? (
                            <a
                              href={tgUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[13px] font-extrabold text-[color:var(--primary)]"
                            >
                              {contact}
                            </a>
                          ) : (
                            <div className="text-[13px] font-extrabold text-[color:var(--text)]">{contact}</div>
                          )}
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            <Badge tone="muted">{TYPE_LABEL[lead.type] ?? lead.type}</Badge>
                            {lead.guestCount ? <Badge tone="muted">{lead.guestCount} гостей</Badge> : null}
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
                      {lead.note ? <div className="mt-2 text-[12px] leading-snug text-[color:var(--text)]">{lead.note}</div> : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {NEXT[lead.status].map((nextStatus) => (
                          <Chip
                            key={nextStatus}
                            active={nextStatus !== 'DONE'}
                            onClick={() => setStatus(lead.id, nextStatus)}
                            className={updatingId === lead.id ? 'pointer-events-none opacity-50' : undefined}
                          >
                            {STATUS_LABEL[nextStatus]}
                          </Chip>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          ))}
        </div>
      )}
    </Screen>
  )
}
