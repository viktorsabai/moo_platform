'use client'

import Link from 'next/link'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { Badge, Btn, Card, Empty, Screen, Segmented, Toggle, fmtThb } from '@/components/kit'
import { cn } from '@/lib/utils'

type Tab = 'requests' | 'pricing'
type Sub = {
  id: string
  name: string
  status: string
  price: number
  periodDays: number
  personCount: number
  deliveryDays: number[]
  nextDelivery: string | null
  createdAt: string
  user: { displayName: string; telegramUsername: string | null } | null
  items: { quantity: number; dayOfWeek: number | null; dish: { name: string; price: number } | null }[]
  deliveries: { id: string; scheduledDate: string; status: string; orderId: string | null }[]
}
type Commerce = { minMarginPercent: number; minGuestDiscountPercent: number; targetMarginPercent: number; subscriptionDiscountPercent: number; priceRoundTo: number }
type Config = { commerce: Commerce; periodDiscounts?: Record<number, number>; availablePeriods: number[]; defaultPeriodDays: number; minDaysPerWeek: number }
type Dish = { id: string; name: string; price: number; costPrice: number | null }
type Quote = { periodRetail: number; recommendedPrice: number; floorPrice: number; ceilingPrice: number; ownerMarginPercent: number; guestSavingsPercent: number; deliveriesInPeriod: number; offerable: boolean; blockReason?: string; perDeliveryCost: number }

const DOW = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' })

export default function AdminRationsPage() {
  return (
    <Suspense fallback={<Screen title="рационы"><div className="h-40 animate-pulse rounded-[20px] bg-[color:var(--surface)]" /></Screen>}>
      <Rations />
    </Suspense>
  )
}

function Rations() {
  const sp = useSearchParams()
  const router = useRouter()
  const rawTab = sp.get('tab')
  const tab: Tab = rawTab === 'pricing' ? 'pricing' : 'requests'
  const setTab = (t: Tab) => router.replace(`/admin/rations?tab=${t}`)
  const [enabled, setEnabled] = useState<boolean | null>(null)

  // кухня переехала во вкладку «кухня» кабинета
  useEffect(() => {
    if (rawTab === 'kitchen') router.replace('/admin/kitchen')
  }, [rawTab, router])

  useEffect(() => {
    fetch('/api/admin/settings', { cache: 'no-store', credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setEnabled(Boolean(d?.settings?.subscriptionEnabled)))
      .catch(() => setEnabled(false))
  }, [])

  const toggleEnabled = async (v: boolean) => {
    setEnabled(v)
    const res = await fetch('/api/admin/settings', { method: 'PATCH', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ subscriptionEnabled: v }) })
    if (!res.ok) {
      setEnabled(!v)
      toast.error('не сохранилось')
    } else toast.success(v ? 'рационы включены у гостей' : 'рационы скрыты у гостей')
  }

  return (
    <Screen title="рационы" back="/admin/more" right={enabled === null ? null : <Toggle checked={enabled} onChange={toggleEnabled} label="рационы включены у гостей" />}>
      <div className="mb-3">
        <Segmented value={tab} onChange={setTab} options={[{ value: 'requests', label: 'подписчики' }, { value: 'pricing', label: 'цены' }]} />
      </div>
      {enabled === false ? <div className="mb-3 rounded-[14px] bg-[color:var(--warn-bg)] px-3 py-2 text-[13px] text-[color:var(--warn)]">рационы выключены — гости их не видят. включите переключателем сверху.</div> : null}
      {tab === 'requests' ? <Requests highlightId={sp.get('id')} /> : <Pricing />}
    </Screen>
  )
}

/* ---------- подписчики и заявки ---------- */

function Requests({ highlightId }: { highlightId: string | null }) {
  const [subs, setSubs] = useState<Sub[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/subscriptions', { cache: 'no-store', credentials: 'include' })
    const d = await res.json().catch(() => null)
    if (res.ok && d?.ok) setSubs(d.subscriptions)
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const act = async (id: string, action: 'approve' | 'reject') => {
    setBusy(id)
    try {
      const res = await fetch(`/api/admin/subscriptions/${id}`, { method: 'PATCH', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action }) })
      const d = await res.json().catch(() => null)
      if (!res.ok || !d?.ok) throw new Error(d?.error || 'не получилось')
      toast.success(action === 'approve' ? 'подтверждено — доставки запланированы' : 'отклонено')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'ошибка')
    } finally {
      setBusy(null)
    }
  }

  if (subs === null) return <div className="flex flex-col gap-2.5" aria-busy>{[0, 1].map((i) => <div key={i} className="h-28 animate-pulse rounded-[20px] bg-[color:var(--surface)]" />)}</div>
  const pending = subs.filter((s) => s.status === 'PENDING')
  const active = subs.filter((s) => s.status === 'ACTIVE' || s.status === 'PAUSED')
  const rest = subs.filter((s) => !['PENDING', 'ACTIVE', 'PAUSED'].includes(s.status))
  if (!subs.length) return <Empty title="подписчиков пока нет" hint="когда гость соберёт рацион, заявка появится здесь и в Telegram" />

  const SubCard = ({ s }: { s: Sub }) => {
    const menuTotal = s.items.reduce((n, it) => n + (it.dish?.price ?? 0) * it.quantity, 0)
    const weeks = Math.max(1, Math.round(s.periodDays / 7))
    const byDay = s.items.some((it) => it.dayOfWeek != null)
    const summary = byDay
      ? `${s.deliveryDays.map((d) => DOW[d]).join(', ')} · меню по дням`
      : s.items.slice(0, 3).map((it) => `${it.quantity}× ${it.dish?.name ?? '—'}`).join(', ') + (s.items.length > 3 ? ` +${s.items.length - 3}` : '')
    const delivered = s.deliveries.filter((d) => d.status === 'DELIVERED').length
    return (
      <Card className={cn(highlightId === s.id && 'ring-2 ring-[color:var(--text)]')}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold text-[color:var(--text)]">{s.user?.displayName ?? 'гость'}{s.user?.telegramUsername ? <span className="font-normal text-[color:var(--muted)]"> · @{s.user.telegramUsername}</span> : null}</div>
            <div className="mt-0.5 text-[13px] text-[color:var(--muted)]">{s.deliveryDays.map((d) => DOW[d]).join('–')} · {weeks} нед. · {s.personCount > 1 ? `${s.personCount} чел. · ` : ''}{s.deliveries.length} доставок</div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[16px] font-bold text-[color:var(--text)]">{fmtThb(s.price)}</div>
            {menuTotal > 0 && !byDay ? <div className="text-[12px] text-[color:var(--muted)]">по меню {fmtThb(menuTotal * s.deliveries.length / Math.max(1, s.deliveries.length))}/дост.</div> : null}
          </div>
        </div>
        <div className="mt-2 truncate text-[13px] text-[color:var(--muted)]">{summary}</div>
        {s.status === 'PENDING' ? (
          <div className="mt-3 flex gap-2">
            <Btn variant="secondary" disabled={busy === s.id} onClick={() => act(s.id, 'reject')}>отклонить</Btn>
            <Btn full disabled={busy === s.id} onClick={() => act(s.id, 'approve')}>подтвердить</Btn>
          </div>
        ) : (
          <div className="mt-2 flex items-center gap-2 text-[12.5px] text-[color:var(--muted)]">
            <Badge tone={s.status === 'ACTIVE' ? 'ok' : 'muted'}>{s.status === 'ACTIVE' ? 'активен' : s.status === 'PAUSED' ? 'пауза' : s.status.toLowerCase()}</Badge>
            {s.deliveries.length ? <span>{delivered} из {s.deliveries.length} доставлено</span> : null}
            {s.nextDelivery && s.status === 'ACTIVE' ? <span>· следующая {fmtDay(s.nextDelivery)}</span> : null}
          </div>
        )}
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {pending.length ? <Group title={`ждут подтверждения · ${pending.length}`}>{pending.map((s) => <SubCard key={s.id} s={s} />)}</Group> : null}
      {active.length ? <Group title={`активные · ${active.length}`}>{active.map((s) => <SubCard key={s.id} s={s} />)}</Group> : null}
      {rest.length ? <Group title="завершённые">{rest.slice(0, 10).map((s) => <SubCard key={s.id} s={s} />)}</Group> : null}
    </div>
  )
}

/* ---------- кухня на сегодня ---------- */

/* ---------- цены: три числа и проверка на примере ---------- */

function Pricing() {
  const [cfg, setCfg] = useState<Config | null>(null)
  const [dishes, setDishes] = useState<Dish[]>([])
  const [quote, setQuote] = useState<Quote | null>(null)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    fetch('/api/admin/subscriptions/config', { cache: 'no-store', credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok) {
          setCfg(d.config)
          setDishes((d.dishes ?? []).map((x: any) => ({ id: x.id, name: x.name, price: Number(x.price), costPrice: x.costPrice == null ? null : Number(x.costPrice) })))
        }
      })
      .catch(() => null)
  }, [])

  const sample = useMemo(() => dishes.filter((d) => d.costPrice).slice(0, 2), [dishes])
  const noCost = useMemo(() => dishes.filter((d) => !d.costPrice).length, [dishes])

  useEffect(() => {
    if (!cfg || !sample.length) return
    const t = setTimeout(async () => {
      const res = await fetch('/api/admin/subscriptions/config', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ commerce: cfg.commerce, items: sample.map((d) => ({ dishId: d.id, quantity: 1 })), deliveryDays: [1, 2, 3, 4, 5], periodDays: 28, personCount: 1 }),
      })
      const d = await res.json().catch(() => null)
      if (d?.ok) setQuote(d.quote)
    }, 250)
    return () => clearTimeout(t)
  }, [cfg, sample])

  const set = (k: keyof Commerce, v: number) => {
    setCfg((c) => (c ? { ...c, commerce: { ...c.commerce, [k]: v } } : c))
    setDirty(true)
  }
  const setPeriod = (days: number, v: number) => {
    setCfg((c) => (c ? { ...c, periodDiscounts: { ...(c.periodDiscounts ?? {}), [days]: v } } : c))
    setDirty(true)
  }

  const save = async () => {
    if (!cfg) return
    setSaving(true)
    const res = await fetch('/api/admin/subscriptions/config', { method: 'PATCH', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ config: cfg }) })
    setSaving(false)
    if (res.ok) {
      toast.success('сохранено')
      setDirty(false)
    } else toast.error('не сохранилось')
  }

  if (!cfg) return <div className="h-40 animate-pulse rounded-[20px] bg-[color:var(--surface)]" aria-busy />
  const c = cfg.commerce
  const pd = cfg.periodDiscounts ?? {}

  return (
    <div className="flex flex-col gap-3">
      <p className="px-1 text-[13px] leading-relaxed text-[color:var(--muted)]">три числа. остальное считает система: гость собирает рацион сам, а цена не уйдёт ниже вашей границы и не станет выше меню.</p>

      <Card className="p-2">
        <NumRow label="минимальная маржа" hint="ниже этой цены не продаём" value={c.minMarginPercent} min={0} max={80} onChange={(v) => set('minMarginPercent', v)} />
        <NumRow label="выгода гостя" hint="минимум дешевле меню" value={c.minGuestDiscountPercent} min={0} max={50} onChange={(v) => set('minGuestDiscountPercent', v)} />
        <NumRow label="целевая маржа" hint="к чему стремится цена" value={c.targetMarginPercent} min={c.minMarginPercent} max={90} onChange={(v) => set('targetMarginPercent', v)} />
      </Card>

      <Card>
        <div className="mb-2 text-[12.5px] font-semibold text-[color:var(--muted)]">скидка за срок</div>
        <div className="flex gap-2">
          {[7, 14, 28].map((days) => (
            <div key={days} className="flex flex-1 flex-col items-center rounded-[14px] bg-[color:var(--surface)] py-2">
              <div className="text-[12px] text-[color:var(--muted)]">{days === 7 ? 'неделя' : days === 14 ? '2 недели' : '4 недели'}</div>
              <div className="mt-1 flex items-center gap-1">
                <button type="button" aria-label="меньше" onClick={() => setPeriod(days, Math.max(0, (pd[days] ?? 0) - 1))} className="h-9 w-9 text-[18px] text-[color:var(--text)]">−</button>
                <span className="min-w-[36px] text-center text-[16px] font-bold text-[color:var(--text)]">{pd[days] ?? 0}%</span>
                <button type="button" aria-label="больше" onClick={() => setPeriod(days, Math.min(40, (pd[days] ?? 0) + 1))} className="h-9 w-9 text-[18px] text-[color:var(--text)]">+</button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {sample.length ? (
        <Card>
          <div className="text-[12.5px] font-semibold text-[color:var(--muted)]">проверка на примере</div>
          <div className="mt-1 text-[13px] text-[color:var(--muted)]">{sample.map((d) => d.name).join(' + ')}, пн–пт, 4 недели</div>
          {quote ? (
            <>
              <Line label="по меню" value={fmtThb(quote.periodRetail)} />
              <Line label="себестоимость" value={fmtThb(quote.perDeliveryCost * quote.deliveriesInPeriod)} />
              <Line label="граница цены" value={quote.floorPrice > 0 ? `${fmtThb(quote.floorPrice)} – ${fmtThb(quote.ceilingPrice)}` : '—'} muted />
              <div className="mt-2 flex items-center justify-between border-t border-[color:var(--stroke)] pt-2">
                <span className="text-[14px] font-semibold text-[color:var(--text)]">гость заплатит</span>
                <span className="text-[20px] font-bold text-[color:var(--text)]">{quote.offerable ? fmtThb(quote.recommendedPrice) : '—'}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {quote.offerable ? (
                  <>
                    <Badge tone="ok">−{quote.guestSavingsPercent}% к меню</Badge>
                    <Badge tone={quote.ownerMarginPercent < c.minMarginPercent ? 'danger' : 'ok'}>ваша маржа {quote.ownerMarginPercent}%</Badge>
                  </>
                ) : (
                  <Badge tone="danger">{quote.blockReason === 'no_guest_benefit' ? 'при таких числах рацион не выходит дешевле меню — снизьте мин. маржу или повысьте выгоду' : 'нет себестоимости'}</Badge>
                )}
              </div>
            </>
          ) : <div className="mt-2 h-20 animate-pulse rounded-[12px] bg-[color:var(--surface)]" />}
        </Card>
      ) : null}

      {noCost > 0 ? (
        <Link href="/admin/store?filter=nocost" prefetch={false} className="flex items-center justify-between rounded-[16px] bg-[color:var(--warn-bg)] px-4 py-3 text-[13px] text-[color:var(--warn)]">
          <span>{noCost} {noCost === 1 ? 'блюдо' : noCost < 5 ? 'блюда' : 'блюд'} без себестоимости — гость их в рацион не добавит</span>
          <span className="shrink-0 font-bold">заполнить ›</span>
        </Link>
      ) : null}

      <Btn size="lg" full disabled={!dirty || saving} onClick={save}>{saving ? 'сохраняем…' : dirty ? 'сохранить' : 'сохранено'}</Btn>
    </div>
  )
}

function NumRow({ label, hint, value, min, max, onChange }: { label: string; hint: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 px-2 py-2 [&+&]:border-t [&+&]:border-[color:var(--stroke)]">
      <div>
        <div className="text-[14px] font-semibold text-[color:var(--text)]">{label}</div>
        <div className="text-[12.5px] text-[color:var(--muted)]">{hint}</div>
      </div>
      <div className="flex h-10 items-center rounded-[14px] bg-[color:var(--surface)]">
        <button type="button" aria-label="меньше" onClick={() => onChange(Math.max(min, value - 1))} className="h-10 w-10 text-[20px] text-[color:var(--text)]">−</button>
        <span className="min-w-[48px] text-center text-[14px] font-semibold text-[color:var(--text)]">{value}%</span>
        <button type="button" aria-label="больше" onClick={() => onChange(Math.min(max, value + 1))} className="h-10 w-10 text-[20px] text-[color:var(--text)]">+</button>
      </div>
    </div>
  )
}

function Line({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={cn('mt-1.5 flex justify-between text-[14px]', muted ? 'text-[color:var(--muted)]' : 'text-[color:var(--text)]')}>
      <span>{label}</span><span>{value}</span>
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-[12.5px] font-semibold text-[color:var(--muted)]">{title}</h2>
      <div className="flex flex-col gap-2.5">{children}</div>
    </section>
  )
}
