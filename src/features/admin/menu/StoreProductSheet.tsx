'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Btn, Chip, Sheet, Toggle } from '@/components/kit'
import { OptimizedImage } from '@/components/ui/OptimizedImage'
import { cn } from '@/lib/utils'

/*
 * Товар магазина: название, фото, категория, видимость и варианты (цена + остаток).
 * Варианты сохраняются сразу по одному — так же, как это делает API.
 */

export type StoreVariant = { id: string; name: string; price: number; qty: number; isActive: boolean }
export type StoreProduct = { id: string; name: string; description: string; image: string | null; categoryId: string; isActive: boolean; variants: StoreVariant[] }
export type StoreCat = { id: string; name: string }

const json = (url: string, method: string, body?: unknown) =>
  fetch(url, {
    method,
    credentials: 'include',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (r) => ({ ok: r.ok, data: await r.json().catch(() => null) }))

export function StoreProductSheet({ product, cats, onClose, onSaved }: { product: StoreProduct | 'new'; cats: StoreCat[]; onClose: () => void; onSaved: () => void }) {
  const isNew = product === 'new'
  const p = isNew ? null : product
  const [name, setName] = useState(p?.name ?? '')
  const [desc, setDesc] = useState(p?.description ?? '')
  const [image, setImage] = useState<string | null>(p?.image ?? null)
  const [catId, setCatId] = useState(p?.categoryId ?? cats[0]?.id ?? '')
  const [active, setActive] = useState(p?.isActive ?? true)
  const [variants, setVariants] = useState<StoreVariant[]>(p?.variants ?? [])
  // для нового товара — первый вариант задаём здесь же
  const [firstPrice, setFirstPrice] = useState('')
  const [firstQty, setFirstQty] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => setVariants(p?.variants ?? []), [p])

  const upload = async (file: File) => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch('/api/admin/uploads/menu-image', { method: 'POST', body: form, credentials: 'include' })
    const d = await res.json().catch(() => null)
    if (res.ok && d?.url) setImage(String(d.url))
    else toast.error(d?.error || 'фото не загрузилось')
  }

  const valid = name.trim() && catId && (!isNew || Number(firstPrice) > 0)

  const save = async () => {
    if (!valid) return
    setBusy(true)
    const base = { name: name.trim(), description: desc.trim(), image: image ?? '', categoryId: catId, isActive: active }
    const r = isNew
      ? await json('/api/admin/store/products', 'POST', { ...base, variants: [{ name: 'по умолчанию', price: Number(firstPrice), qty: Math.max(0, Math.trunc(Number(firstQty) || 0)) }] })
      : await json('/api/admin/store/products', 'PATCH', { id: p!.id, ...base })
    setBusy(false)
    if (!r.ok || r.data?.ok === false) return void toast.error(r.data?.error || 'не сохранилось')
    toast.success(isNew ? 'товар добавлен' : 'сохранено')
    onSaved()
    onClose()
  }

  const patchVariant = async (v: StoreVariant, patch: Partial<StoreVariant>) => {
    setVariants((prev) => prev.map((x) => (x.id === v.id ? { ...x, ...patch } : x)))
    const r = await json('/api/admin/store/variants', 'PATCH', { id: v.id, ...patch })
    if (!r.ok) {
      toast.error('вариант не сохранился')
      setVariants((prev) => prev.map((x) => (x.id === v.id ? v : x)))
    } else onSaved()
  }

  const addVariant = async () => {
    if (!p) return
    const r = await json('/api/admin/store/variants', 'POST', { productId: p.id, name: 'новый вариант', price: variants.at(-1)?.price ?? 0, qty: 0 })
    if (!r.ok || r.data?.ok === false) return void toast.error(r.data?.error || 'не добавилось')
    const v = r.data?.variant
    if (v?.id) setVariants((prev) => [...prev, { id: v.id, name: v.name ?? 'новый вариант', price: Number(v.price ?? 0), qty: Number(v.qty ?? 0), isActive: v.isActive !== false }])
    onSaved()
  }

  const removeVariant = async (v: StoreVariant) => {
    if (variants.length <= 1) return void toast.error('у товара должен остаться хотя бы один вариант')
    const r = await json(`/api/admin/store/variants?id=${encodeURIComponent(v.id)}`, 'DELETE')
    if (!r.ok) return void toast.error('не удалилось')
    setVariants((prev) => prev.filter((x) => x.id !== v.id))
    onSaved()
  }

  const remove = async () => {
    if (!p || !window.confirm(`Удалить товар «${p.name}»?`)) return
    const r = await json(`/api/admin/store/products?id=${encodeURIComponent(p.id)}`, 'DELETE')
    if (!r.ok) return void toast.error('не удалился')
    toast.success('удалено')
    onSaved()
    onClose()
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={isNew ? 'новый товар' : 'товар'}
      footer={
        <div className="flex gap-2">
          {!isNew ? (
            <Btn variant="danger" onClick={remove}>
              удалить
            </Btn>
          ) : null}
          <Btn className="flex-1" disabled={!valid || busy} onClick={save}>
            {busy ? 'сохраняем…' : 'сохранить'}
          </Btn>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="relative block aspect-[4/3] w-full cursor-pointer overflow-hidden rounded-[16px] bg-[color:var(--surface)]">
          {image ? <OptimizedImage src={image} alt="" sizes="420px" className="object-cover" /> : null}
          <span className="absolute inset-x-0 bottom-0 bg-black/45 px-3 py-2 text-center text-[13px] font-semibold text-white">{image ? 'заменить фото' : 'добавить фото'}</span>
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f) }} />
        </label>
        <Field label="название"><input value={name} onChange={(e) => setName(e.target.value)} className={inp} autoFocus={isNew} /></Field>
        <Field label="описание"><textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} className={cn(inp, 'h-auto py-2.5')} /></Field>
        {cats.length ? (
          <div>
            <span className="mb-1 block text-[12.5px] font-semibold text-[color:var(--muted)]">категория магазина</span>
            <div className="flex flex-wrap gap-1.5">
              {cats.map((c) => (
                <Chip key={c.id} active={catId === c.id} onClick={() => setCatId(c.id)}>{c.name}</Chip>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-[13px] text-[color:var(--warn)]">сначала заведите категорию магазина во вкладке «категории»</p>
        )}
        <div className="flex items-center justify-between rounded-[14px] bg-[color:var(--surface)] px-3 py-2.5">
          <div>
            <div className="text-[14px] font-semibold text-[color:var(--text)]">показывать гостям</div>
            <div className="text-[12.5px] text-[color:var(--muted)]">без остатка вариант всё равно скрывается сам</div>
          </div>
          <Toggle checked={active} onChange={setActive} label="показывать гостям" />
        </div>

        {isNew ? (
          <div className="grid grid-cols-2 gap-2">
            <Field label="цена, ฿"><input value={firstPrice} onChange={(e) => setFirstPrice(e.target.value)} inputMode="decimal" className={inp} /></Field>
            <Field label="остаток, шт"><input value={firstQty} onChange={(e) => setFirstQty(e.target.value)} inputMode="numeric" className={inp} /></Field>
          </div>
        ) : (
          <div>
            <span className="mb-1 block text-[12.5px] font-semibold text-[color:var(--muted)]">варианты · цена и остаток сохраняются сразу</span>
            <div className="rounded-[14px] bg-[color:var(--surface)] px-3 py-1">
              {variants.map((v, i) => (
                <VariantRow key={v.id} v={v} first={i === 0} onPatch={(patch) => void patchVariant(v, patch)} onRemove={() => void removeVariant(v)} />
              ))}
            </div>
            <Btn variant="secondary" full className="mt-2" onClick={() => void addVariant()}>
              + вариант
            </Btn>
          </div>
        )}
      </div>
    </Sheet>
  )
}

function VariantRow({ v, first, onPatch, onRemove }: { v: StoreVariant; first: boolean; onPatch: (p: Partial<StoreVariant>) => void; onRemove: () => void }) {
  const [name, setName] = useState(v.name)
  const [price, setPrice] = useState(String(v.price))
  const [qty, setQty] = useState(String(v.qty))
  return (
    <div className={cn('flex flex-col gap-1.5 py-2', !first && 'border-t border-[color:var(--stroke)]')}>
      <div className="flex items-center gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() !== v.name && onPatch({ name: name.trim() })} placeholder="вариант, например 500 г" aria-label="название варианта" className={cn(inp, 'h-10 flex-1')} />
        <button type="button" onClick={onRemove} aria-label={`удалить вариант ${v.name}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[color:var(--muted)]">×</button>
      </div>
      <div className="flex items-center gap-2 text-[13px] text-[color:var(--muted)]">
        <input value={price} inputMode="decimal" aria-label="цена" onChange={(e) => setPrice(e.target.value)} onBlur={() => Number(price) !== v.price && Number.isFinite(Number(price)) && onPatch({ price: Number(price) })} className={cn(inp, 'h-10 w-24 text-right')} />
        ฿
        <input value={qty} inputMode="numeric" aria-label="остаток" onChange={(e) => setQty(e.target.value)} onBlur={() => Number(qty) !== v.qty && Number.isFinite(Number(qty)) && onPatch({ qty: Math.max(0, Math.trunc(Number(qty))) })} className={cn(inp, 'ml-2 h-10 w-20 text-right')} />
        шт
        <span className="ml-auto">
          <Toggle checked={v.isActive} onChange={(on) => onPatch({ isActive: on })} label={`вариант ${v.name} в продаже`} />
        </span>
      </div>
    </div>
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

const inp = 'h-11 w-full min-w-0 rounded-[14px] border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] px-3.5 text-[14px] text-[color:var(--text)] placeholder:text-[color:var(--muted)] focus:outline-none'
