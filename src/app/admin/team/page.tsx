'use client'

import { useEffect, useMemo, useState } from 'react'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

type Member = {
  id: string
  role: 'OWNER' | 'ADMIN' | 'STAFF'
  user: { telegramId?: string | null; telegramUsername?: string | null; name?: string | null; email?: string | null }
}

type Invite = {
  id: string
  invitedTelegramId: string
  role: 'OWNER' | 'ADMIN' | 'STAFF'
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED'
  createdAt: string
  resolvedAt?: string | null
  createdBy?: { name?: string | null; telegramUsername?: string | null; telegramId?: string | null } | null
}

function inviteStatusLabel(inv: Invite): string {
  if (inv.status === 'PENDING') return 'ожидает: человек должен один раз открыть mini app с этим Telegram'
  if (inv.status === 'ACCEPTED') return 'принято'
  if (inv.status === 'DECLINED') return 'отклонено'
  return inv.status
}

export default function AdminTeamPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<Invite[]>([])

  const [telegramId, setTelegramId] = useState('')
  const [role, setRole] = useState<'STAFF' | 'ADMIN' | 'OWNER'>('STAFF')

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/team', { cache: 'no-store', credentials: 'include' })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        setError(data?.error || 'не удалось загрузить')
        setMembers([])
        setInvites([])
        return
      }
      setMembers(Array.isArray(data.members) ? data.members : [])
      setInvites(Array.isArray(data.invites) ? data.invites : [])
    } catch {
      setError('не удалось загрузить')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const canAdd = useMemo(() => Boolean(telegramId.trim()), [telegramId])

  const pendingInvites = useMemo(() => invites.filter((i) => i.status === 'PENDING'), [invites])
  const settledInvites = useMemo(() => invites.filter((i) => i.status !== 'PENDING'), [invites])

  async function addOrUpdate() {
    if (!canAdd) return
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/api/admin/team', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ telegramId: telegramId.trim(), role }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        setError(data?.error || 'ошибка')
        return
      }
      if (data.kind === 'member') {
        setSuccess('сотрудник добавлен в команду.')
      } else if (data.kind === 'member_bootstrap') {
        setSuccess('сотрудник добавлен в команду (режим без модуля приглашений).')
      } else if (data.kind === 'invite_created') {
        setSuccess('приглашение создано. статус — «ожидает», пока человек не зайдёт в приложение.')
      } else if (data.kind === 'invite_pending') {
        setSuccess('ожидающее приглашение обновлено (роль).')
      }
      setTelegramId('')
      await load()
    } catch {
      setError('ошибка')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="ui-container ui-screen !pb-20">
      <Card variant="surfaceStrong" className="p-4">
        <div className="text-[13px] font-extrabold tracking-tight text-[color:var(--text)]">добавить сотрудника</div>
        <div className="mt-1 text-[13px] font-medium text-[color:var(--muted)]">
          если пользователь уже заходил в mini app — сразу попадёт в список участников. иначе создаётся приглашение: как
          только он откроет приложение с тем же Telegram ID, роль применится автоматически.
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input
            className="input input--pill"
            placeholder="telegram id сотрудника"
            value={telegramId}
            onChange={(e) => setTelegramId(e.target.value)}
            inputMode="numeric"
          />
          <CustomSelect
            value={role}
            onChange={(v) => setRole(v as any)}
            options={[
              { value: 'STAFF', label: 'персонал' },
              { value: 'ADMIN', label: 'админ' },
              { value: 'OWNER', label: 'владелец' },
            ]}
          />
          <Button
            type="button"
            onClick={addOrUpdate}
            disabled={!canAdd || loading}
            className="h-11 w-full rounded-full text-[14px]"
          >
            сохранить
          </Button>
        </div>
        {success ? <div className="mt-2 text-[12px] font-semibold text-emerald-700">{success}</div> : null}
        {error ? (
          <div className="mt-2 text-[12px] font-semibold text-red-600">
            {String(error).includes('user not found')
              ? 'пользователь не найден. пусть сотрудник откроет mini app один раз, потом повтори.'
              : error}
          </div>
        ) : null}
      </Card>

      {pendingInvites.length > 0 ? (
        <div className="mt-5">
          <div className="mb-2 text-[13px] font-extrabold tracking-tight text-[color:var(--text)]">ожидают входа</div>
          <Card variant="surfaceStrong" className="p-0 overflow-hidden">
            <div className="divide-y divide-[color:var(--stroke)]">
              {pendingInvites.map((inv) => (
                <div key={inv.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold text-[color:var(--text)]">telegram {inv.invitedTelegramId}</div>
                      <div className="mt-1 text-[12px] font-semibold text-amber-800/90">{inviteStatusLabel(inv)}</div>
                      <div className="mt-0.5 text-[11px] font-medium text-[color:var(--muted)]">
                        роль: {inv.role === 'OWNER' ? 'владелец' : inv.role === 'ADMIN' ? 'админ' : 'персонал'}
                        {inv.createdBy?.name || inv.createdBy?.telegramUsername
                          ? ` · от ${inv.createdBy?.name || inv.createdBy?.telegramUsername}`
                          : ''}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-900">
                      ожидает
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      ) : null}

      <div className="mt-5">
        <div className="mb-2 text-[13px] font-extrabold tracking-tight text-[color:var(--text)]">участники</div>
        {loading ? (
          <Card variant="surfaceStrong" className="p-5 text-[13px] font-semibold text-[color:var(--muted)]">
            загрузка…
          </Card>
        ) : members.length === 0 ? (
          <Card variant="surfaceStrong" className="p-5 text-center">
            <div className="text-[14px] font-semibold text-[color:var(--text)]">пока никого в команде</div>
            <div className="mt-1 text-[13px] font-medium text-[color:var(--muted)]">
              добавь по Telegram ID выше или дождись, пока примут приглашение
            </div>
          </Card>
        ) : (
          <div className="ufo-list">
            <div className="divide-y divide-[color:var(--stroke)]">
              {members.map((m) => (
                <div key={m.id} className="px-1 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold text-[color:var(--text)]">
                        {m.user.name || m.user.telegramUsername || m.user.telegramId || 'user'}
                      </div>
                      <div className="mt-0.5 text-[12px] font-semibold text-[color:var(--muted)]">
                        {m.user.telegramId ? `telegram id ${m.user.telegramId}` : '—'} ·{' '}
                        {m.role === 'OWNER' ? 'владелец' : m.role === 'ADMIN' ? 'админ' : 'персонал'}
                      </div>
                    </div>
                    <span className="rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface)] px-3 py-1 text-[12px] font-semibold text-[color:var(--text)]">
                      {m.role === 'OWNER' ? 'владелец' : m.role === 'ADMIN' ? 'админ' : 'персонал'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-5">
        <div className="mb-2 text-[13px] font-extrabold tracking-tight text-[color:var(--text)]">уведомления и доступ</div>
        <Card variant="surfaceStrong" className="p-4">
          <div className="space-y-2 text-[12px]">
            <div className="font-semibold text-[color:var(--text)]">получение уведомлений</div>
            <div className="text-[color:var(--muted)]">• новые заказы и обновления подписок: OWNER / ADMIN / STAFF (кто в команде и с telegram id)</div>
            <div className="text-[color:var(--muted)]">• персональные уведомления клиента: получает только сам клиент</div>
            <div className="pt-2 font-semibold text-[color:var(--text)]">кто может отправлять вручную</div>
            <div className="text-[color:var(--muted)]">• сценарные сообщения гостям из кабинета: OWNER и ADMIN</div>
            <div className="text-[color:var(--muted)]">• STAFF видит операционные события, но не отправляет сценарные push</div>
          </div>
        </Card>
      </div>

      {!loading && settledInvites.length > 0 ? (
        <div className="mt-5">
          <div className="mb-2 text-[13px] font-extrabold tracking-tight text-[color:var(--text)]">история приглашений</div>
          <Card variant="surfaceStrong" className="p-0 overflow-hidden">
            <div className="divide-y divide-[color:var(--stroke)]">
              {settledInvites.map((inv) => (
                <div key={inv.id} className="px-4 py-2.5">
                  <div className="flex items-center justify-between gap-2 text-[12px]">
                    <span className="font-semibold text-[color:var(--text)]">{inv.invitedTelegramId}</span>
                    <span className="text-[color:var(--muted)]">{inviteStatusLabel(inv)}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      ) : null}
    </main>
  )
}
