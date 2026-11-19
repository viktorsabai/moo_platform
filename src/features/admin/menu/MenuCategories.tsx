'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { Btn, Card, Sheet } from '@/components/kit'

/*
 * Категории блюд: добавить, переименовать, поменять порядок, удалить пустую.
 * Удаление непустой категории в API удаляет и её блюда — поэтому здесь его нет:
 * сначала блюда переносятся в другую категорию.
 */

const dishWord = (n: number) => (n % 10 === 1 && n % 100 !== 11 ? 'блюдо' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'блюда' : 'блюд')

export type MenuCat = { id: string; name: string; order: number; dishCount: number }

const api = (method: string, body?: unknown, query = '') =>
  fetch(`/api/admin/menu/categories${query}`, {
    method,
    credentials: 'include',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (r) => ({ ok: r.ok, data: await r.json().catch(() => null) }))

export function MenuCategories({ cats, onChanged }: { cats: MenuCat[]; onChanged: () => void }) {
  const [edit, setEdit] = useState<MenuCat | 'new' | null>(null)
  const sorted = [...cats].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))

  const move = async (i: number, dir: -1 | 1) => {
    const a = sorted.at(i)
    const b = sorted.at(i + dir)
    if (!a || !b) return
    // меняем местами порядок двух соседей; если порядок совпадал — раздаём по индексу
    const oa = a.order === b.order ? i : a.order
    const ob = a.order === b.order ? i + dir : b.order
    const [r1, r2] = await Promise.all([api('PATCH', { id: a.id, order: ob }), api('PATCH', { id: b.id, order: oa })])
    if (!r1.ok || !r2.ok) toast.error('порядок не сохранился')
    onChanged()
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="px-1 text-[13px] text-[color:var(--muted)]">в таком порядке категории идут у гостей на главной</p>
      {sorted.length ? (
        <Card className="!py-1">
          {sorted.map((c, i) => (
            <div key={c.id} className={i > 0 ? 'flex min-h-[56px] items-center gap-2 border-t border-[color:var(--stroke)]' : 'flex min-h-[56px] items-center gap-2'}>
              <button type="button" onClick={() => setEdit(c)} className="min-w-0 flex-1 py-2 text-left">
                <span className="block truncate text-[15px] font-semibold text-[color:var(--text)]">{c.name}</span>
                <span className="block text-[12.5px] text-[color:var(--muted)]">{c.dishCount ? `${c.dishCount} ${dishWord(c.dishCount)}` : 'пустая'}</span>
              </button>
              <button type="button" aria-label={`выше: ${c.name}`} disabled={i === 0} onClick={() => void move(i, -1)} className="flex h-10 w-10 items-center justify-center rounded-full text-[color:var(--muted)] disabled:opacity-30">
                ↑
              </button>
              <button type="button" aria-label={`ниже: ${c.name}`} disabled={i === sorted.length - 1} onClick={() => void move(i, 1)} className="flex h-10 w-10 items-center justify-center rounded-full text-[color:var(--muted)] disabled:opacity-30">
                ↓
              </button>
            </div>
          ))}
        </Card>
      ) : null}
      <Btn variant="secondary" full onClick={() => setEdit('new')}>
        + категория
      </Btn>
      {edit ? <CategorySheet cat={edit} count={sorted.length} onClose={() => setEdit(null)} onSaved={onChanged} /> : null}
    </div>
  )
}

function CategorySheet({ cat, count, onClose, onSaved }: { cat: MenuCat | 'new'; count: number; onClose: () => void; onSaved: () => void }) {
  const isNew = cat === 'new'
  const [name, setName] = useState(isNew ? '' : cat.name)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    if (!name.trim()) return
    setBusy(true)
    const r = isNew ? await api('POST', { name: name.trim(), order: count }) : await api('PATCH', { id: cat.id, name: name.trim() })
    setBusy(false)
    if (!r.ok || r.data?.ok === false) return void toast.error(r.data?.error || 'не сохранилось')
    toast.success(isNew ? 'категория добавлена' : 'сохранено')
    onSaved()
    onClose()
  }

  const remove = async () => {
    if (isNew || cat.dishCount > 0) return
    if (!window.confirm(`Удалить категорию «${cat.name}»?`)) return
    setBusy(true)
    const r = await api('DELETE', undefined, `?id=${encodeURIComponent(cat.id)}`)
    setBusy(false)
    if (!r.ok) return void toast.error('не удалилась')
    toast.success('удалено')
    onSaved()
    onClose()
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={isNew ? 'новая категория' : 'категория'}
      footer={
        <div className="flex gap-2">
          {!isNew && cat.dishCount === 0 ? (
            <Btn variant="danger" onClick={remove} disabled={busy}>
              удалить
            </Btn>
          ) : null}
          <Btn className="flex-1" disabled={!name.trim() || busy} onClick={save}>
            {busy ? 'сохраняем…' : 'сохранить'}
          </Btn>
        </div>
      }
    >
      <label className="block">
        <span className="mb-1 block text-[12.5px] font-semibold text-[color:var(--muted)]">название</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          placeholder="например, супы"
          className="h-11 w-full rounded-[14px] border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] px-3.5 text-[14px] text-[color:var(--text)] focus:outline-none"
        />
      </label>
      {!isNew && cat.dishCount > 0 ? (
        <p className="mt-3 text-[13px] text-[color:var(--muted)]">
          в категории {cat.dishCount} {dishWord(cat.dishCount)}. чтобы удалить её, сначала перенесите блюда в другую категорию — в карточке блюда.
        </p>
      ) : null}
    </Sheet>
  )
}
