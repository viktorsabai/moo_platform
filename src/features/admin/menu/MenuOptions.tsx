'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { Btn, Card, Sheet } from '@/components/kit'

/*
 * Справочник опций: группы («размер», «соус») и их значения.
 * Какие значения есть у конкретного блюда и за сколько — в карточке блюда.
 * «Убрать» скрывает (так API делает по умолчанию): у старых заказов ничего не ломается.
 */

export type OptValue = { id: string; name: string; isActive: boolean }
export type OptGroup = { id: string; name: string; isActive: boolean; values: OptValue[] }

const call = (method: string, body?: unknown, query = '') =>
  fetch(`/api/admin/menu/options${query}`, {
    method,
    credentials: 'include',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (r) => ({ ok: r.ok, data: await r.json().catch(() => null) }))

export function MenuOptions({ groups, onChanged }: { groups: OptGroup[]; onChanged: () => void }) {
  const [edit, setEdit] = useState<OptGroup | 'new' | null>(null)
  const active = groups.filter((g) => g.isActive)

  return (
    <div className="flex flex-col gap-3">
      <p className="px-1 text-[13px] text-[color:var(--muted)]">варианты, которые гость выбирает у блюда: размер, соус, гарнир. к блюду их привязывают в карточке блюда</p>
      {active.map((g) => (
        <button key={g.id} type="button" onClick={() => setEdit(g)} className="block text-left">
          <Card>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[15px] font-semibold text-[color:var(--text)]">{g.name}</span>
              <span className="text-[16px] text-[color:var(--muted)]" aria-hidden>›</span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {g.values.filter((v) => v.isActive).map((v) => (
                <span key={v.id} className="rounded-full bg-[color:var(--bg)] px-3 py-1 text-[13px] text-[color:var(--text)]">{v.name}</span>
              ))}
              {!g.values.some((v) => v.isActive) ? <span className="text-[13px] text-[color:var(--muted)]">значений пока нет</span> : null}
            </div>
          </Card>
        </button>
      ))}
      <Btn variant="secondary" full onClick={() => setEdit('new')}>
        + группа опций
      </Btn>
      {edit ? <GroupSheet group={edit} onClose={() => setEdit(null)} onSaved={onChanged} /> : null}
    </div>
  )
}

function GroupSheet({ group, onClose, onSaved }: { group: OptGroup | 'new'; onClose: () => void; onSaved: () => void }) {
  const isNew = group === 'new'
  const [name, setName] = useState(isNew ? '' : group.name)
  const [values, setValues] = useState<OptValue[]>(isNew ? [] : group.values.filter((v) => v.isActive))
  const [newValue, setNewValue] = useState('')
  const [draftValues, setDraftValues] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  const addValue = async () => {
    const v = newValue.trim()
    if (!v) return
    setNewValue('')
    if (isNew) return setDraftValues((prev) => [...prev, v])
    const r = await call('PUT', { groupId: group.id, valueName: v })
    if (!r.ok || r.data?.ok === false) return void toast.error(r.data?.error || 'не добавилось')
    const created = r.data?.value
    setValues((prev) => [...prev, { id: String(created?.id ?? v), name: v, isActive: true }])
    onSaved()
  }

  const hideValue = async (v: OptValue) => {
    const r = await call('DELETE', undefined, `?${new URLSearchParams({ valueId: v.id })}`)
    if (!r.ok) return void toast.error('не получилось')
    setValues((prev) => prev.filter((x) => x.id !== v.id))
    onSaved()
  }

  const save = async () => {
    if (!name.trim()) return
    setBusy(true)
    const r = isNew
      ? await call('POST', { name: name.trim(), values: draftValues.map((n) => ({ name: n })) })
      : await call('PATCH', { kind: 'group', groupId: group.id, name: name.trim() })
    setBusy(false)
    if (!r.ok || r.data?.ok === false) return void toast.error(r.data?.error || 'не сохранилось')
    toast.success(isNew ? 'группа добавлена' : 'сохранено')
    onSaved()
    onClose()
  }

  const hideGroup = async () => {
    if (isNew || !window.confirm(`Убрать группу «${group.name}»? У блюд она перестанет показываться.`)) return
    const r = await call('DELETE', undefined, `?${new URLSearchParams({ groupId: group.id })}`)
    if (!r.ok) return void toast.error('не получилось')
    toast.success('группа убрана')
    onSaved()
    onClose()
  }

  const shown = isNew ? draftValues.map((n) => ({ id: n, name: n, isActive: true })) : values

  return (
    <Sheet
      open
      onClose={onClose}
      title={isNew ? 'новая группа опций' : 'группа опций'}
      footer={
        <div className="flex gap-2">
          {!isNew ? (
            <Btn variant="danger" onClick={hideGroup}>
              убрать
            </Btn>
          ) : null}
          <Btn className="flex-1" disabled={!name.trim() || busy} onClick={save}>
            {busy ? 'сохраняем…' : 'сохранить'}
          </Btn>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="block">
          <span className="mb-1 block text-[12.5px] font-semibold text-[color:var(--muted)]">название группы</span>
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus={isNew} placeholder="например, размер" className={inp} />
        </label>
        <div>
          <span className="mb-1 block text-[12.5px] font-semibold text-[color:var(--muted)]">значения</span>
          <div className="flex flex-wrap gap-1.5">
            {shown.map((v) => (
              <span key={v.id} className="inline-flex h-9 items-center gap-1 rounded-full bg-[color:var(--surface)] pl-3.5 pr-1 text-[14px] text-[color:var(--text)]">
                {v.name}
                <button
                  type="button"
                  aria-label={`убрать ${v.name}`}
                  onClick={() => (isNew ? setDraftValues((prev) => prev.filter((x) => x !== v.name)) : void hideValue(v))}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-[color:var(--muted)]"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void addValue()}
              placeholder="новое значение"
              className={inp}
            />
            <Btn variant="secondary" onClick={() => void addValue()} disabled={!newValue.trim()}>
              добавить
            </Btn>
          </div>
        </div>
      </div>
    </Sheet>
  )
}

const inp = 'h-11 w-full min-w-0 rounded-[14px] border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] px-3.5 text-[14px] text-[color:var(--text)] placeholder:text-[color:var(--muted)] focus:outline-none'
