'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useVenue } from '@/lib/venue-context'
import { AdminDeliveryConfig } from '@/components/admin/AdminDeliveryConfig'
import { AdminPaymentMethods } from '@/components/admin/AdminPaymentMethods'
import { Btn, Card, Chip, Row, RowGroup, Screen, Toggle } from '@/components/kit'
import { OptimizedImage } from '@/components/ui/OptimizedImage'

type Settings = { openTime: string; closeTime: string; isOpenOverride: boolean | null; deliveryFee: number; freeDeliveryFrom: number; storeEnabled: boolean }

const SECTIONS = [
  { id: 'main', label: 'основное' },
  { id: 'brand', label: 'оформление' },
  { id: 'delivery', label: 'доставка' },
  { id: 'payments', label: 'оплата' },
  { id: 'bot', label: 'бот и команда' },
]

export default function AdminRestaurantPage() {
  const { refetch } = useVenue()
  const [rid, setRid] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [cover, setCover] = useState<string | null>(null)
  const [logo, setLogo] = useState<string | null>(null)
  const [s, setS] = useState<Settings | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const [r, st] = await Promise.all([
      fetch('/api/restaurant', { cache: 'no-store', credentials: 'include' }).then((x) => x.json()).catch(() => null),
      fetch('/api/admin/settings', { cache: 'no-store', credentials: 'include' }).then((x) => x.json()).catch(() => null),
    ])
    if (r?.ok && r.restaurant) {
      setRid(r.restaurant.id)
      setName(r.restaurant.name ?? '')
      setAddress(r.restaurant.address ?? '')
      setCover(r.restaurant.coverImage ?? null)
      setLogo(r.restaurant.logoImage ?? null)
    }
    if (st?.ok) {
      const raw = st.settings ?? {}
      setS({
        openTime: String(raw.openTime ?? '10:00'),
        closeTime: String(raw.closeTime ?? '22:00'),
        isOpenOverride: typeof raw.isOpenOverride === 'boolean' ? raw.isOpenOverride : null,
        deliveryFee: Number(raw.deliveryFee ?? 100),
        freeDeliveryFrom: Number(raw.freeDeliveryFrom ?? 500),
        storeEnabled: raw.storeEnabled !== false,
      })
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const patchSettings = async (body: Partial<Settings>) => {
    const res = await fetch('/api/admin/settings', { method: 'PATCH', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    if (!res.ok) throw new Error('не сохранилось')
  }

  const save = async () => {
    if (!s || !rid) return
    setSaving(true)
    try {
      await Promise.all([
        fetch(`/api/restaurant/${encodeURIComponent(rid)}`, { method: 'PATCH', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: name.trim() || undefined, address: address.trim() || null }) }),
        patchSettings({ openTime: s.openTime, closeTime: s.closeTime, storeEnabled: s.storeEnabled }),
      ])
      toast.success('сохранено')
      setDirty(false)
      void refetch()
    } catch {
      toast.error('не сохранилось')
    } finally {
      setSaving(false)
    }
  }

  /** пауза: isOpenOverride=false закрывает приём; null — по расписанию */
  const setPaused = async (paused: boolean) => {
    if (!s) return
    const prev = s.isOpenOverride
    setS({ ...s, isOpenOverride: paused ? false : null })
    try {
      await patchSettings({ isOpenOverride: paused ? false : null })
      toast.success(paused ? 'приём заказов на паузе' : 'снова по расписанию')
      void refetch()
    } catch {
      setS({ ...s, isOpenOverride: prev })
      toast.error('не сохранилось')
    }
  }

  /** фото сохраняется сразу после загрузки — отдельной кнопки не нужно */
  const saveImage = async (key: 'coverImage' | 'logoImage', url: string | null) => {
    if (!rid) return false
    const res = await fetch(`/api/restaurant/${encodeURIComponent(rid)}`, { method: 'PATCH', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ [key]: url }) })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.ok) {
      toast.error(data?.error || 'не сохранилось')
      return false
    }
    if (key === 'coverImage') setCover(url)
    else setLogo(url)
    toast.success(url ? 'фото обновлено' : 'фото убрано')
    return true
  }

  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  if (!s) return <Screen title="ресторан" back="/admin/more"><div className="h-40 animate-pulse rounded-[20px] bg-[color:var(--surface)]" aria-busy /></Screen>

  return (
    <Screen title="ресторан" back="/admin/more">
      <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {SECTIONS.map((x) => <Chip key={x.id} onClick={() => go(x.id)}>{x.label}</Chip>)}
      </div>

      <div className="flex flex-col gap-3">
        <section id="main" className="scroll-mt-4">
          <Card>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[15px] font-semibold text-[color:var(--text)]">{s.isOpenOverride === false ? 'приём заказов на паузе' : 'принимаем по расписанию'}</div>
                <div className="text-[12.5px] text-[color:var(--muted)]">{s.isOpenOverride === false ? 'гости видят «закрыто»' : `${s.openTime}–${s.closeTime}`}</div>
              </div>
              <Toggle checked={s.isOpenOverride !== false} onChange={(v) => setPaused(!v)} label="принимаем заказы" />
            </div>
          </Card>
          <Card className="mt-3">
            <Field label="название"><input value={name} onChange={(e) => { setName(e.target.value); setDirty(true) }} className={inp} /></Field>
            <Field label="адрес" className="mt-3"><input value={address} onChange={(e) => { setAddress(e.target.value); setDirty(true) }} className={inp} placeholder="район, улица — чтобы гость понимал, откуда везём" /></Field>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Field label="открываемся"><input type="time" value={s.openTime} onChange={(e) => { setS({ ...s, openTime: e.target.value }); setDirty(true) }} className={inp} /></Field>
              <Field label="закрываемся"><input type="time" value={s.closeTime} onChange={(e) => { setS({ ...s, closeTime: e.target.value }); setDirty(true) }} className={inp} /></Field>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-[14px] bg-[color:var(--surface)] px-3 py-2.5">
              <div>
                <div className="text-[14px] font-semibold text-[color:var(--text)]">раздел «магазин» у гостей</div>
                <div className="text-[12.5px] text-[color:var(--muted)]">товары с остатками, отдельно от блюд</div>
              </div>
              <Toggle checked={s.storeEnabled} onChange={(v) => { setS({ ...s, storeEnabled: v }); setDirty(true) }} label="магазин включён" />
            </div>
            <Btn className="mt-3" full disabled={!dirty || saving} onClick={save}>{saving ? 'сохраняем…' : dirty ? 'сохранить' : 'сохранено'}</Btn>
          </Card>
        </section>

        <section id="brand" className="scroll-mt-4">
          <h2 className="mb-2 px-1 text-[12.5px] font-semibold text-[color:var(--muted)]">оформление главной</h2>
          <Card>
            <ImagePicker
              label="обложка"
              hint="широкое фото зала или блюд, 16:9 — гость видит его первым"
              value={cover}
              shape="wide"
              onChange={(url) => saveImage('coverImage', url)}
            />
            <ImagePicker
              className="mt-4"
              label="логотип"
              hint="квадратный, лучше на однотонном фоне"
              value={logo}
              shape="round"
              onChange={(url) => saveImage('logoImage', url)}
            />
          </Card>
        </section>

        <section id="delivery" className="scroll-mt-4">
          <h2 className="mb-2 px-1 text-[12.5px] font-semibold text-[color:var(--muted)]">доставка</h2>
          <Card>
            <AdminDeliveryConfig defaultDeliveryFee={s.deliveryFee} freeDeliveryFrom={s.freeDeliveryFrom} onDefaultsChange={(deliveryFee, freeDeliveryFrom) => setS((p) => (p ? { ...p, deliveryFee, freeDeliveryFrom } : p))} />
          </Card>
        </section>

        <section id="payments" className="scroll-mt-4">
          <h2 className="mb-2 px-1 text-[12.5px] font-semibold text-[color:var(--muted)]">оплата</h2>
          <AdminPaymentMethods />
        </section>

        <section id="bot" className="scroll-mt-4">
          <RowGroup title="бот и команда">
            <Row first href="/admin/qr" label="Telegram-бот и QR на столы" hint="подключение, приветствие, ссылка для гостей" />
            <Row href="/admin/team" label="команда и доступы" hint="кто получает заказы в Telegram" />
            <Row href="/admin/notifications" label="уведомления" hint="какие сообщения уходят гостям" />
          </RowGroup>
        </section>

        <Link href="/" prefetch={false} className="py-2 text-center text-[13px] font-semibold text-[color:var(--muted)]">посмотреть как гость ›</Link>
      </div>
    </Screen>
  )
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className ?? ''}`}>
      <span className="mb-1 block text-[12.5px] font-semibold text-[color:var(--muted)]">{label}</span>
      {children}
    </label>
  )
}

const inp = 'h-11 w-full rounded-[14px] border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] px-3.5 text-[14px] text-[color:var(--text)] placeholder:text-[color:var(--muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--stroke-strong)]'

function ImagePicker({ label, hint, value, shape, onChange, className }: { label: string; hint: string; value: string | null; shape: 'wide' | 'round'; onChange: (url: string | null) => Promise<boolean>; className?: string }) {
  const [busy, setBusy] = useState(false)
  const upload = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/admin/uploads/menu-image', { method: 'POST', credentials: 'include', body: form })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.url) {
        toast.error(data?.error || 'не загрузилось')
        return
      }
      await onChange(String(data.url))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className={className}>
      <div className="mb-1 text-[12.5px] font-semibold text-[color:var(--muted)]">{label}</div>
      <div className={shape === 'wide' ? 'flex flex-col gap-2' : 'flex items-center gap-3'}>
        <div
          className={
            shape === 'wide'
              ? 'relative aspect-[16/9] w-full overflow-hidden rounded-[16px] bg-[color:var(--surface)]'
              : 'relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-[color:var(--surface)]'
          }
        >
          {value ? <OptimizedImage src={value} alt="" sizes={shape === 'wide' ? '420px' : '64px'} className="object-cover" /> : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] text-[color:var(--muted)]">{hint}</div>
          <div className="mt-2 flex gap-2">
            <label className="inline-flex h-10 cursor-pointer items-center rounded-full bg-[color:var(--primary)] px-4 text-[13px] font-semibold text-[color:var(--on-primary)]">
              {busy ? 'загружаем…' : value ? 'заменить' : 'загрузить'}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = '' }} />
            </label>
            {value ? <Btn variant="secondary" onClick={() => void onChange(null)}>убрать</Btn> : null}
          </div>
        </div>
      </div>
    </div>
  )
}
