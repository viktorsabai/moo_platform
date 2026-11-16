'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Badge, Btn, Chip, Empty, Screen, Segmented, Sheet, Toggle, fmtThb } from '@/components/kit'
import { IMAGE_SIZES, OptimizedImage } from '@/components/ui/OptimizedImage'
import { cn } from '@/lib/utils'

type Cat = { key: string; id: string; name: string; kind: 'dish' | 'store' }
type Item = {
  key: string
  kind: 'dish' | 'store'
  id: string
  name: string
  description: string
  price: number
  cost: number | null
  image: string | null
  categoryId: string
  available: boolean
  eligible: boolean
}
type Filter = 'all' | 'stop' | 'nocost'

const marginOf = (it: Item) => (it.cost && it.price > 0 ? Math.round((1 - it.cost / it.price) * 100) : null)

export default function AdminMenuPage() {
  const [items, setItems] = useState<Item[] | null>(null)
  const [cats, setCats] = useState<Cat[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [cat, setCat] = useState<string>('all')
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState<Item | 'new' | null>(null)

  const load = useCallback(async () => {
    const get = (u: string) => fetch(u, { cache: 'no-store', credentials: 'include' }).then((r) => r.json()).catch(() => null)
    const [c, d, sc, sp] = await Promise.all([get('/api/admin/menu/categories'), get('/api/admin/menu/dishes'), get('/api/admin/store/categories'), get('/api/admin/store/products')])
    const nextCats: Cat[] = [
      ...((c?.categories ?? []) as any[]).map((x) => ({ key: `d:${x.id}`, id: x.id, name: x.name, kind: 'dish' as const })),
      ...((sc?.categories ?? []) as any[]).map((x) => ({ key: `s:${x.id}`, id: x.id, name: x.name, kind: 'store' as const })),
    ]
    const next: Item[] = [
      ...((d?.dishes ?? []) as any[]).map((x) => ({
        key: `d:${x.id}`,
        kind: 'dish' as const,
        id: x.id,
        name: x.name,
        description: x.description ?? '',
        price: Number(x.price ?? 0),
        cost: x.costPrice == null ? null : Number(x.costPrice),
        image: x.image ?? null,
        categoryId: x.categoryId,
        available: x.isAvailable !== false,
        eligible: x.subscriptionEligible !== false,
      })),
      ...((sp?.products ?? []) as any[]).map((x) => ({
        key: `s:${x.id}`,
        kind: 'store' as const,
        id: x.id,
        name: x.name,
        description: x.description ?? '',
        price: Number(x.variants?.[0]?.price ?? 0),
        cost: null,
        image: x.image ?? null,
        categoryId: x.categoryId,
        available: x.isActive !== false,
        eligible: false,
      })),
    ]
    setCats(nextCats)
    setItems(next)
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const toggle = async (it: Item, on: boolean) => {
    setItems((prev) => prev?.map((x) => (x.key === it.key ? { ...x, available: on } : x)) ?? prev)
    const url = it.kind === 'dish' ? '/api/admin/menu/dishes' : '/api/admin/store/products'
    const body = it.kind === 'dish' ? { id: it.id, isAvailable: on } : { id: it.id, isActive: on }
    const res = await fetch(url, { method: 'PATCH', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    if (!res.ok) {
      toast.error('не сохранилось')
      setItems((prev) => prev?.map((x) => (x.key === it.key ? { ...x, available: !on } : x)) ?? prev)
    }
  }

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (items ?? []).filter(
      (it) =>
        (cat === 'all' || `${it.kind === 'dish' ? 'd' : 's'}:${it.categoryId}` === cat) &&
        (filter === 'all' ? true : filter === 'stop' ? !it.available : it.kind === 'dish' && !it.cost) &&
        (!needle || it.name.toLowerCase().includes(needle))
    )
  }, [items, cat, filter, q])

  const stopCount = (items ?? []).filter((x) => !x.available).length
  const noCostCount = (items ?? []).filter((x) => x.kind === 'dish' && !x.cost).length

  return (
    <Screen
      title="меню"
      right={
        <Btn onClick={() => setEdit('new')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4" aria-hidden><path d="M12 5v14M5 12h14" /></svg>
          блюдо
        </Btn>
      }
    >
      <div className="mb-2">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: `все${items ? ` · ${items.length}` : ''}` },
            { value: 'stop', label: `в стопе${stopCount ? ` · ${stopCount}` : ''}` },
            { value: 'nocost', label: `без себест.${noCostCount ? ` · ${noCostCount}` : ''}` },
          ]}
        />
      </div>
      <div className="mb-2 flex items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="найти" className="h-10 min-w-0 flex-1 rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] px-4 text-[14px] text-[color:var(--text)] placeholder:text-[color:var(--muted)] focus:outline-none" />
        <Link href="/admin/store/full" prefetch={false} className="shrink-0 text-[13px] font-semibold text-[color:var(--muted)] underline underline-offset-4">категории и опции</Link>
      </div>
      {cats.length > 1 ? (
        <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          <Chip active={cat === 'all'} onClick={() => setCat('all')}>все</Chip>
          {cats.map((c) => (
            <Chip key={c.key} active={cat === c.key} onClick={() => setCat(cat === c.key ? 'all' : c.key)}>{c.name}</Chip>
          ))}
        </div>
      ) : null}

      {items === null ? (
        <div className="flex flex-col gap-2" aria-busy>{[0, 1, 2, 3].map((i) => <div key={i} className="h-[76px] animate-pulse rounded-[18px] bg-[color:var(--surface)]" />)}</div>
      ) : !list.length ? (
        <Empty title={items.length ? 'ничего не нашли' : 'меню пустое'} hint={items.length ? undefined : 'добавьте первое блюдо — оно сразу появится у гостей'} action={!items.length ? <Btn onClick={() => setEdit('new')}>добавить блюдо</Btn> : undefined} />
      ) : (
        <div className="flex flex-col gap-2">
          {list.map((it) => {
            const m = marginOf(it)
            return (
              <div key={it.key} className={cn('flex items-center gap-3 rounded-[18px] border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] p-2.5', !it.available && 'opacity-70')}>
                <button type="button" onClick={() => setEdit(it)} className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[14px] bg-[color:var(--surface)]" aria-label={`изменить ${it.name}`}>
                  {it.image ? <OptimizedImage src={it.image} alt="" sizes={IMAGE_SIZES.menuGrid} className="object-cover" /> : null}
                </button>
                <button type="button" onClick={() => setEdit(it)} className="min-w-0 flex-1 text-left">
                  <div className="truncate text-[15px] font-semibold text-[color:var(--text)]">{it.name}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[13px] text-[color:var(--text)]">
                    {fmtThb(it.price)}
                    {it.kind === 'store' ? <Badge tone="muted">товар</Badge> : m === null ? <Badge tone="warn">нет себестоимости</Badge> : <Badge tone={m < 20 ? 'danger' : 'ok'}>маржа {m}%</Badge>}
                    {!it.available ? <Badge tone="danger">в стопе</Badge> : null}
                  </div>
                </button>
                <Toggle checked={it.available} onChange={(v) => toggle(it, v)} label={`${it.name} в наличии`} />
              </div>
            )
          })}
        </div>
      )}

      <DishSheet item={edit} cats={cats.filter((c) => c.kind === 'dish')} onClose={() => setEdit(null)} onSaved={load} />
    </Screen>
  )
}

/* ---------- быстрое редактирование блюда ---------- */

function DishSheet({ item, cats, onClose, onSaved }: { item: Item | 'new' | null; cats: Cat[]; onClose: () => void; onSaved: () => void }) {
  const isNew = item === 'new'
  const it = item && item !== 'new' ? item : null
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [cost, setCost] = useState('')
  const [desc, setDesc] = useState('')
  const [catId, setCatId] = useState('')
  const [eligible, setEligible] = useState(true)
  const [image, setImage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!item) return
    setName(it?.name ?? '')
    setPrice(it ? String(it.price) : '')
    setCost(it?.cost != null ? String(it.cost) : '')
    setDesc(it?.description ?? '')
    setCatId(it?.categoryId ?? cats[0]?.id ?? '')
    setEligible(it?.eligible ?? true)
    setImage(it?.image ?? null)
  }, [item, it, cats])

  if (!item) return null
  if (it?.kind === 'store') {
    return (
      <Sheet open onClose={onClose} title={it.name} footer={<Link href="/admin/store/full" prefetch={false} className="flex h-[52px] items-center justify-center rounded-[16px] bg-[color:var(--primary)] text-[16px] font-semibold text-[color:var(--on-primary)]">открыть редактор товаров</Link>}>
        <p className="text-[14px] text-[color:var(--muted)]">Варианты, остатки и цены товара редактируются в полном редакторе.</p>
      </Sheet>
    )
  }

  const p = Number(price)
  const c = cost.trim() ? Number(cost) : null
  const margin = c && p > 0 ? Math.round((1 - c / p) * 100) : null
  const valid = name.trim().length > 0 && Number.isFinite(p) && p > 0 && (c === null || (Number.isFinite(c) && c >= 0)) && Boolean(catId)

  const upload = async (file: File) => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch('/api/admin/uploads/menu-image', { method: 'POST', body: form, credentials: 'include' })
    const d = await res.json().catch(() => null)
    if (res.ok && d?.ok && d.url) setImage(String(d.url))
    else toast.error('фото не загрузилось')
  }

  const save = async () => {
    if (!valid) return
    setBusy(true)
    try {
      const body: Record<string, unknown> = { name: name.trim(), price: p, costPrice: c, description: desc.trim(), categoryId: catId, subscriptionEligible: eligible, image: image ?? '' }
      const res = await fetch('/api/admin/menu/dishes', {
        method: isNew ? 'POST' : 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(isNew ? body : { id: it!.id, ...body }),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok || d?.ok === false) throw new Error(d?.error || 'не сохранилось')
      toast.success(isNew ? 'блюдо добавлено' : 'сохранено')
      onSaved()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'ошибка')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!it || !window.confirm(`Удалить «${it.name}»?`)) return
    setBusy(true)
    const res = await fetch(`/api/admin/menu/dishes?id=${encodeURIComponent(it.id)}`, { method: 'DELETE', credentials: 'include' })
    setBusy(false)
    if (res.ok) {
      toast.success('удалено')
      onSaved()
      onClose()
    } else toast.error('не удалилось')
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={isNew ? 'новое блюдо' : 'блюдо'}
      footer={
        <div className="flex flex-col gap-1">
          <Btn size="lg" full disabled={!valid || busy} onClick={save}>{busy ? 'сохраняем…' : 'сохранить'}</Btn>
          {!isNew ? (
            <div className="flex justify-between">
              <Link href={`/admin/store/full?dish=${it!.id}`} prefetch={false} className="h-9 px-1 text-[13px] font-semibold leading-9 text-[color:var(--muted)]">опции и теги</Link>
              <Btn variant="danger" onClick={remove} disabled={busy}>удалить</Btn>
            </div>
          ) : null}
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="relative block aspect-[4/3] w-full cursor-pointer overflow-hidden rounded-[16px] bg-[color:var(--surface)]">
          {image ? <OptimizedImage src={image} alt="" sizes={IMAGE_SIZES.menuGrid} className="object-cover" /> : null}
          <span className="absolute inset-x-0 bottom-0 bg-black/45 px-3 py-2 text-center text-[13px] font-semibold text-white">{image ? 'заменить фото' : 'добавить фото'}</span>
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f) }} />
        </label>
        <Field label="название"><input value={name} onChange={(e) => setName(e.target.value)} className={inp} autoFocus={isNew} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="цена, ฿"><input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" className={inp} /></Field>
          <Field label="себестоимость, ฿"><input value={cost} onChange={(e) => setCost(e.target.value)} inputMode="decimal" className={inp} placeholder="для рационов" /></Field>
        </div>
        <div className="-mt-1 min-h-[22px] text-[13px]">
          {margin === null ? <span className="text-[color:var(--muted)]">без себестоимости блюдо не попадёт в рацион</span> : <span className={margin < 20 ? 'text-[color:var(--danger)]' : 'text-[color:var(--ok)]'}>маржа {margin}%</span>}
        </div>
        <Field label="категория">
          <div className="flex flex-wrap gap-2">
            {cats.map((c) => (
              <Chip key={c.id} active={catId === c.id} onClick={() => setCatId(c.id)}>{c.name}</Chip>
            ))}
          </div>
        </Field>
        <Field label="описание"><textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} className={cn(inp, 'h-auto py-2.5')} /></Field>
        <div className="flex items-center justify-between rounded-[14px] bg-[color:var(--surface)] px-3 py-2.5">
          <div>
            <div className="text-[14px] font-semibold text-[color:var(--text)]">можно в рацион</div>
            <div className="text-[12.5px] text-[color:var(--muted)]">гость сможет брать блюдо в недельный набор</div>
          </div>
          <Toggle checked={eligible} onChange={setEligible} label="можно в рацион" />
        </div>
      </div>
    </Sheet>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12.5px] font-semibold text-[color:var(--muted)]">{label}</span>
      {children}
    </label>
  )
}

const inp = 'h-11 w-full rounded-[14px] border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] px-3.5 text-[14px] text-[color:var(--text)] placeholder:text-[color:var(--muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--stroke-strong)]'
