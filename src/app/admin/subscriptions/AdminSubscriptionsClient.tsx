'use client'

import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { DEFAULT_SUBSCRIPTION_PLANS, getDefaultPlanBySlug } from '@/lib/subscription-plans'
import { subscriptionPlanPresetGradient } from '@/lib/subscription-plan-visual'

type MenuCategory = { id: string; name: string; slug: string }
import { formatPrice } from '@/lib/utils'
import { EmptyStatePlaceholder } from '@/components/ui/EmptyStatePlaceholder'
import { IconPencil, IconHome, IconTrash } from '@/components/ui/icons'
import Link from 'next/link'
import { AdminSubscriptionCatalog } from '@/app/admin/subscriptions/AdminSubscriptionCatalog'
import { GuestClientCard, guestClientFromSubscriptionUser } from '@/components/ui/GuestClientCard'

export type ClientSubscription = {
  id: string
  name: string
  status: string
  statusLabel: string
  price: number
  plan: string
  personCount?: number
  periodDays?: number
  deliveryDays: number[]
  deliveryTime: string | null
  nextDelivery: string | null
  createdAt: string
  user: {
    id: string
    name: string
    telegramUsername?: string | null
    telegramId?: string | null
    telegramPhotoUrl?: string | null
    avatar?: string | null
  } | null
  items: { id: string; quantity: number; dish: { id: string; name: string; price: number } }[]
  deliveries?: { id: string; scheduledDate: string; status: string }[]
}

type Plan = {
  id: string
  name: string
  description?: string | null
  coverImageUrl?: string | null
  price: number
  plan: string
  presetSlug?: string | null
  allowedCategoryIds?: string[]
  categoryLimits?: Record<string, number> | null
  minDishesPerDelivery?: number | null
  maxDishesPerDelivery?: number | null
  minDaysPerWeek?: number | null
  maxDaysPerWeek?: number | null
  order: number
  isActive: boolean
}

type Preset = {
  slug: string
  name: string
  description: string
  targetAudience: string
}

const PLAN_LABEL: Record<string, string> = {
  WEEKLY: 'неделя',
  BIWEEKLY: '2 недели',
  MONTHLY: 'месяц',
}

async function uploadMenuImageFile(file: File): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch('/api/admin/uploads/menu-image', { method: 'POST', credentials: 'include', body: form })
  const data = await res.json().catch(() => null)
  if (!res.ok || !data?.ok || typeof data.url !== 'string') {
    return { ok: false, error: typeof data?.error === 'string' ? data.error : 'Не удалось загрузить фото' }
  }
  return { ok: true, url: data.url }
}

const WEEKDAYS_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

function buildTodayTodo(subs: ClientSubscription[]) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const toSend: { subName: string; date: string; dayShort: string }[] = []
  const inPrep: { subName: string; date: string; dayShort: string }[] = []
  for (const s of subs) {
    const dels = s.deliveries ?? []
    for (const d of dels) {
      if (d.status === 'CANCELLED' || d.status === 'DELIVERED') continue
      const dDate = new Date(d.scheduledDate)
      dDate.setHours(0, 0, 0, 0)
      if (dDate.getTime() !== today.getTime()) continue
      const label = { subName: s.name, date: d.scheduledDate, dayShort: WEEKDAYS_SHORT[dDate.getDay()] }
      if (d.status === 'SCHEDULED') toSend.push(label)
      else inPrep.push(label)
    }
  }
  return { toSend, inPrep }
}

function ClientsSubsSection({
  clients,
  formatPrice,
  cn,
  onDeleteSubscription,
}: {
  clients: {
    userId: string
    client: ReturnType<typeof guestClientFromSubscriptionUser>
    subs: ClientSubscription[]
    active: number
    total: number
  }[]
  formatPrice: (n: number) => string
  cn: (...args: any[]) => string
  onDeleteSubscription?: (id: string) => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(clients[0]?.userId ?? null)
  const client = clients.find((c) => c.userId === selectedId) ?? clients[0]
  const todayTodo = client ? buildTodayTodo(client.subs) : { toSend: [], inPrep: [] }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden">
        <p className="ui-muted mb-2 text-[11px] font-semibold uppercase tracking-wide">клиенты</p>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-none">
          {clients.map((c) => (
            <GuestClientCard
              key={c.userId}
              client={c.client}
              variant="tile"
              selected={c.userId === selectedId}
              meta={`${c.active} подписок`}
              onClick={() => setSelectedId(c.userId)}
            />
          ))}
        </div>
      </div>
      {client && (
        <div>
          <GuestClientCard
            client={client.client}
            variant="hero"
            meta={`${client.active} подписок · ${formatPrice(client.total)}/мес`}
          />

          {(todayTodo.toSend.length > 0 || todayTodo.inPrep.length > 0) && (
            <div className="mt-4">
              <p className="ui-muted mb-2 text-[11px] font-semibold uppercase tracking-wide">сегодня</p>
              <div className="flex flex-col gap-2">
                {todayTodo.inPrep.length > 0 && (
                  <div
                    className="flex items-center gap-2 rounded-xl border px-3 py-2"
                    style={{
                      borderRadius: 'var(--radius-large)',
                      borderColor: 'var(--stroke)',
                      background: 'color-mix(in srgb, var(--accent) 6%, transparent)',
                    }}
                  >
                    <span className="text-[11px] font-semibold" style={{ color: 'var(--muted)' }}>в готовке</span>
                    <span className="text-[13px] font-medium">
                      {todayTodo.inPrep.map((t) => t.subName).join(', ')}
                    </span>
                  </div>
                )}
                {todayTodo.toSend.length > 0 && (
                  <div
                    className="flex items-center gap-2 rounded-xl border px-3 py-2"
                    style={{
                      borderRadius: 'var(--radius-large)',
                      borderColor: 'var(--stroke)',
                      background: 'var(--surface)',
                    }}
                  >
                    <span className="text-[11px] font-semibold" style={{ color: 'var(--muted)' }}>к отправке</span>
                    <span className="text-[13px] font-medium">
                      {todayTodo.toSend.map((t) => t.subName).join(', ')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mt-4 space-y-2">
            <p className="ui-muted text-[11px] font-semibold uppercase tracking-wide">подписки</p>
            {client.subs.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3"
                style={{
                  borderRadius: 'var(--radius-large)',
                  borderColor: 'var(--stroke)',
                  background: 'var(--surface-strong)',
                }}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-[14px]" style={{ color: 'var(--text)' }}>{s.name}</span>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={{
                        borderRadius: 'var(--radius-pill)',
                        background: s.status === 'ACTIVE'
                          ? 'color-mix(in srgb, #10b981 18%, transparent)'
                          : 'color-mix(in srgb, var(--text) 10%, transparent)',
                        color: s.status === 'ACTIVE' ? '#047857' : 'var(--muted)',
                      }}
                    >
                      {s.statusLabel}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[12px]" style={{ color: 'var(--muted)' }}>{formatPrice(s.price)}/мес</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <div className="text-right">
                    <p className="text-[11px] font-medium" style={{ color: 'var(--text)' }}>
                      {s.nextDelivery
                        ? new Date(s.nextDelivery).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' })
                        : '—'}
                    </p>
                    {s.items.length > 0 && (
                      <p className="mt-0.5 text-[10px]" style={{ color: 'var(--muted)' }}>
                        {s.items.length} поз.
                      </p>
                    )}
                  </div>
                  {onDeleteSubscription && (
                    <button
                      type="button"
                      onClick={() => onDeleteSubscription(s.id)}
                      title="удалить подписку"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-red-600 transition hover:bg-red-50"
                    >
                      <IconTrash className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function PlanRulesForm({
  plan,
  categories,
  onSave,
  onCancel,
}: {
  plan: Plan
  categories: MenuCategory[]
  onSave: (u: {
    allowedCategoryIds: string[]
    categoryLimits: Record<string, number>
    minDishesPerDelivery?: number
    maxDishesPerDelivery?: number
    minDaysPerWeek: number
    maxDaysPerWeek: number
    coverImageUrl?: string | null
  }) => void
  onCancel: () => void
}) {
  const hasPresetNoOverrides = Boolean(plan.presetSlug) && (!plan.allowedCategoryIds || plan.allowedCategoryIds.length === 0)
  const preset = plan.presetSlug ? getDefaultPlanBySlug(plan.presetSlug) : null
  const initialAllowedIds = (() => {
    if (Array.isArray(plan.allowedCategoryIds) && plan.allowedCategoryIds.length > 0) return new Set(plan.allowedCategoryIds)
    if (preset && categories.length > 0) {
      const ids = new Set<string>()
      preset.rules.allowedCategorySlugs.forEach((slug) => {
        const c = categories.find((cat) => cat.slug === slug)
        if (c) ids.add(c.id)
      })
      return ids
    }
    return new Set<string>()
  })()
  const initialLimits = (() => {
    if (plan.categoryLimits && typeof plan.categoryLimits === 'object' && Object.keys(plan.categoryLimits).length > 0) return { ...plan.categoryLimits }
    if (preset && categories.length > 0) {
      const lim: Record<string, number> = {}
      Object.entries(preset.rules.categoryLimits).forEach(([slug, n]) => {
        const c = categories.find((cat) => cat.slug === slug)
        if (c) lim[c.id] = n
      })
      return lim
    }
    return {} as Record<string, number>
  })()

  const [allowedIds, setAllowedIds] = useState<Set<string>>(initialAllowedIds)
  const [limits, setLimits] = useState<Record<string, number>>(initialLimits)
  const [minDays, setMinDays] = useState(plan.minDaysPerWeek ?? preset?.rules.minDaysPerWeek ?? 3)
  const [maxDays, setMaxDays] = useState(plan.maxDaysPerWeek ?? preset?.rules.maxDaysPerWeek ?? 7)
  const [minDishes, setMinDishes] = useState(plan.minDishesPerDelivery ?? preset?.rules.minDishesPerDelivery ?? 1)
  const [maxDishes, setMaxDishes] = useState(plan.maxDishesPerDelivery ?? preset?.rules.maxDishesPerDelivery ?? 3)
  const [coverUrl, setCoverUrl] = useState(typeof plan.coverImageUrl === 'string' ? plan.coverImageUrl : '')
  const [coverUploading, setCoverUploading] = useState(false)
  const coverFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setCoverUrl(typeof plan.coverImageUrl === 'string' ? plan.coverImageUrl : '')
  }, [plan.id, plan.coverImageUrl])

  useEffect(() => {
    if (!hasPresetNoOverrides || !preset || categories.length === 0) return
    const ids = new Set<string>()
    preset.rules.allowedCategorySlugs.forEach((slug) => {
      const c = categories.find((cat) => cat.slug === slug)
      if (c) ids.add(c.id)
    })
    const lim: Record<string, number> = {}
    Object.entries(preset.rules.categoryLimits).forEach(([slug, n]) => {
      const c = categories.find((cat) => cat.slug === slug)
      if (c) lim[c.id] = n
    })
    setAllowedIds(ids)
    setLimits(lim)
    setMinDays(plan.minDaysPerWeek ?? preset.rules.minDaysPerWeek)
    setMaxDays(plan.maxDaysPerWeek ?? preset.rules.maxDaysPerWeek)
    setMinDishes(plan.minDishesPerDelivery ?? preset.rules.minDishesPerDelivery ?? 1)
    setMaxDishes(plan.maxDishesPerDelivery ?? preset.rules.maxDishesPerDelivery ?? 3)
  }, [plan.id, plan.presetSlug, hasPresetNoOverrides, categories.length])

  const toggleCat = (id: string) => {
    setAllowedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSave = () => {
    const lim: Record<string, number> = {}
    allowedIds.forEach((id) => {
      const v = limits[id]
      if (typeof v === 'number' && v >= 1) lim[id] = v
      else lim[id] = 1
    })
    onSave({
      allowedCategoryIds: Array.from(allowedIds),
      categoryLimits: lim,
      minDishesPerDelivery: Math.max(1, Math.min(10, minDishes)),
      maxDishesPerDelivery: Math.max(1, Math.min(10, maxDishes)),
      minDaysPerWeek: Math.max(1, Math.min(7, minDays)),
      maxDaysPerWeek: Math.max(1, Math.min(7, maxDays)),
      coverImageUrl: coverUrl.trim() || null,
    })
  }

  const categoryNames = Array.from(allowedIds)
    .map((id) => categories.find((c) => c.id === id)?.name ?? id)
    .filter(Boolean)
  const summaryLine = `от ${minDishes} до ${maxDishes} блюд на доставку, от ${minDays} до ${maxDays} дней в неделю${categoryNames.length > 0 ? ` · категории: ${categoryNames.join(', ')}` : ''}`

  return (
    <div
      className="mt-4 border-t pt-4"
      style={{ borderColor: 'var(--stroke)' }}
    >
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
        обложка в приложении
      </p>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="url"
          placeholder="URL или загрузите файл"
          value={coverUrl}
          onChange={(e) => setCoverUrl(e.target.value)}
          className="input min-w-[180px] flex-1 rounded-lg px-3 py-2 text-[13px]"
        />
        <input
          ref={coverFileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f) return
            setCoverUploading(true)
            const r = await uploadMenuImageFile(f)
            setCoverUploading(false)
            if (!r.ok) {
              toast.error(r.error)
              return
            }
            setCoverUrl(r.url)
            toast.success('Обложка загружена')
          }}
        />
        <button
          type="button"
          disabled={coverUploading}
          onClick={() => coverFileRef.current?.click()}
          className="btn btn-soft shrink-0 rounded-full px-3 py-2 text-[12px] font-semibold disabled:opacity-50"
          style={{ borderRadius: 'var(--radius-pill)' }}
        >
          {coverUploading ? '…' : 'загрузить'}
        </button>
      </div>
      <p className="mb-1 text-[13px] font-semibold" style={{ color: 'var(--text)' }}>
        Правила в визарде
      </p>
      <p className="mb-4 text-[12px]" style={{ color: 'var(--muted)' }}>
        {summaryLine}
      </p>
      <div className="space-y-4">
        <details className="rounded-lg border p-3" style={{ borderColor: 'var(--stroke)' }}>
          <summary className="cursor-pointer select-none text-[12px] font-semibold" style={{ color: 'var(--text)' }}>
            Категории и числа <span className="font-normal text-[color:var(--muted)]">(по умолчанию скрыто)</span>
          </summary>
          <div className="mt-3 space-y-4 border-t pt-3" style={{ borderColor: 'var(--stroke)' }}>
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>категории</p>
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => (
                  <label
                    key={c.id}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[13px] transition',
                      allowedIds.has(c.id) ? 'border-[color:var(--primary)] bg-[color:var(--primary)]/8' : ''
                    )}
                    style={{
                      borderRadius: 'var(--radius)',
                      borderColor: allowedIds.has(c.id) ? undefined : 'var(--stroke)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={allowedIds.has(c.id)}
                      onChange={() => toggleCat(c.id)}
                      className="rounded"
                    />
                    <span>{c.name}</span>
                  </label>
                ))}
              </div>
            </div>
            {allowedIds.size > 0 && (
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>лимит на категорию</p>
                <div className="flex flex-wrap gap-2">
                  {Array.from(allowedIds).map((id) => {
                    const cat = categories.find((c) => c.id === id)
                    return (
                      <div
                        key={id}
                        className="flex items-center gap-2 rounded-lg border px-3 py-1.5"
                        style={{ borderRadius: 'var(--radius)', borderColor: 'var(--stroke)' }}
                      >
                        <span className="text-[12px]" style={{ color: 'var(--text)' }}>{cat?.name ?? id}</span>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={limits[id] ?? 1}
                          onChange={(e) =>
                            setLimits((prev) => ({ ...prev, [id]: Math.max(1, Math.min(10, Number(e.target.value) || 1)) }))
                          }
                          className="w-12 rounded border-none bg-transparent px-1 py-0.5 text-right text-[13px] font-semibold outline-none"
                          style={{ color: 'var(--accent)' }}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <label className="text-[12px] font-semibold" style={{ color: 'var(--muted)' }}>мин блюд</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={minDishes}
                  onChange={(e) => setMinDishes(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
                  className="input input--pill w-14 py-1.5 text-center text-[13px]"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[12px] font-semibold" style={{ color: 'var(--muted)' }}>макс блюд</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={maxDishes}
                  onChange={(e) => setMaxDishes(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
                  className="input input--pill w-14 py-1.5 text-center text-[13px]"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[12px] font-semibold" style={{ color: 'var(--muted)' }}>мин дн.</label>
                <input
                  type="number"
                  min={1}
                  max={7}
                  value={minDays}
                  onChange={(e) => setMinDays(Math.max(1, Math.min(7, Number(e.target.value) || 1)))}
                  className="input input--pill w-14 py-1.5 text-center text-[13px]"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[12px] font-semibold" style={{ color: 'var(--muted)' }}>макс дн.</label>
                <input
                  type="number"
                  min={1}
                  max={7}
                  value={maxDays}
                  onChange={(e) => setMaxDays(Math.max(1, Math.min(7, Number(e.target.value) || 1)))}
                  className="input input--pill w-14 py-1.5 text-center text-[13px]"
                />
              </div>
            </div>
          </div>
        </details>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            className="btn btn-primary rounded-full px-4 py-2 text-[13px] font-semibold"
            style={{ borderRadius: 'var(--radius-pill)' }}
          >
            сохранить
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-soft rounded-full px-4 py-2 text-[13px] font-semibold"
            style={{ borderRadius: 'var(--radius-pill)' }}
          >
            отмена
          </button>
        </div>
      </div>
    </div>
  )
}

export type AdminSubscriptionsViewProps = { initialClientSubscriptions?: ClientSubscription[] }

export function AdminSubscriptionsView({ initialClientSubscriptions = [] }: AdminSubscriptionsViewProps) {
  const deletedPlanIdsRef = useRef<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [clientSubsLoading, setClientSubsLoading] = useState(initialClientSubscriptions.length === 0)
  const [plansLoadError, setPlansLoadError] = useState<string | null>(null)
  const [settingsFetchFailed, setSettingsFetchFailed] = useState(false)
  const [createPlanError, setCreatePlanError] = useState<string | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [presets, setPresets] = useState<Preset[]>([])
  const [clientSubscriptions, setClientSubscriptions] = useState<ClientSubscription[]>(initialClientSubscriptions)
  const [subscriptionEnabled, setSubscriptionEnabled] = useState(false)
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null)
  const [addToHomePlanId, setAddToHomePlanId] = useState<string | null>(null)
  const [categories, setCategories] = useState<MenuCategory[]>([])

  const [newPlan, setNewPlan] = useState({
    name: '',
    description: '',
    coverImageUrl: '',
    price: 0,
    plan: 'WEEKLY' as 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY',
  })
  const [newPlanAllowedIds, setNewPlanAllowedIds] = useState<Set<string>>(new Set())
  const [newPlanLimits, setNewPlanLimits] = useState<Record<string, number>>({})
  const [newPlanMinDishes, setNewPlanMinDishes] = useState(1)
  const [newPlanMaxDishes, setNewPlanMaxDishes] = useState(3)
  const [newPlanMinDays, setNewPlanMinDays] = useState(3)
  const [newPlanMaxDays, setNewPlanMaxDays] = useState(7)
  const [newPlanPresetSlug, setNewPlanPresetSlug] = useState<'standard' | 'fit' | 'family' | null>(null)
  const newPlanCoverInputRef = useRef<HTMLInputElement>(null)
  const [newPlanCoverUploading, setNewPlanCoverUploading] = useState(false)

  async function load() {
    setLoading(true)
    setPlansLoadError(null)
    setSettingsFetchFailed(false)
    try {
      const [plansRes, settingsRes, presetsRes] = await Promise.all([
        fetch('/api/admin/subscriptions/plans', { cache: 'no-store', credentials: 'include' }),
        fetch('/api/admin/settings', { cache: 'no-store', credentials: 'include' }),
        fetch('/api/admin/subscriptions/presets', { cache: 'no-store', credentials: 'include' }),
      ])
      const plansData = await plansRes.json().catch(() => null)
      const settingsData = await settingsRes.json().catch(() => null)
      const presetsData = await presetsRes.json().catch(() => null)
      const nextPlans = Array.isArray(plansData?.plans) ? plansData.plans : []
      if (plansRes.ok && plansData?.ok) {
        const withoutDeleted = nextPlans.filter((p: Plan) => !deletedPlanIdsRef.current.has(p.id))
        setPlans(withoutDeleted)
        setPlansLoadError(null)
      } else {
        setPlans([])
        const msg =
          plansRes.status === 401
            ? 'Сессия недействительна. Закройте мини-приложение и откройте снова или обновите страницу.'
            : plansRes.status === 403
              ? 'Нет доступа к этому заведению — в профиле выберите нужную точку.'
              : typeof plansData?.error === 'string'
                ? plansData.error
                : 'Не удалось загрузить шаблоны планов'
        setPlansLoadError(msg)
      }
      if (settingsRes.ok && settingsData?.ok) {
        setSubscriptionEnabled(Boolean(settingsData.settings?.subscriptionEnabled))
      } else {
        setSettingsFetchFailed(true)
      }
      if (presetsRes.ok && presetsData?.ok && Array.isArray(presetsData.presets)) {
        setPresets(presetsData.presets.map((p: Preset) => ({ slug: p.slug, name: p.name, description: p.description, targetAudience: p.targetAudience })))
      }
    } catch {
      setPlans([])
      setPlansLoadError('Проблема сети. Проверьте соединение и нажмите «повторить».')
    } finally {
      setLoading(false)
    }
  }

  async function loadClientSubscriptions() {
    setClientSubsLoading(true)
    try {
      const res = await fetch('/api/admin/subscriptions', { cache: 'no-store', credentials: 'include' })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.ok && Array.isArray(data.subscriptions)) {
        setClientSubscriptions(data.subscriptions)
      } else if (initialClientSubscriptions.length > 0) {
        setClientSubscriptions(initialClientSubscriptions)
      } else {
        setClientSubscriptions([])
      }
    } catch {
      if (initialClientSubscriptions.length > 0) setClientSubscriptions(initialClientSubscriptions)
      else setClientSubscriptions([])
    } finally {
      setClientSubsLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    let c = false
    fetch('/api/categories', { cache: 'no-store', credentials: 'include' })
      .then((r) => r.json())
      .then((arr) => {
        if (!c && Array.isArray(arr)) {
          setCategories(arr.map((x: any) => ({ id: x.id, name: x.name, slug: x.slug ?? x.id })))
        }
      })
      .catch(() => {})
    return () => {
      c = true
    }
  }, [])

  useEffect(() => {
    loadClientSubscriptions()
  }, [])

  const canCreate = Boolean(newPlan.name.trim())

  function applyPreset(slug: 'standard' | 'fit' | 'family') {
    const preset = getDefaultPlanBySlug(slug)
    if (!preset) return
    setNewPlanPresetSlug(slug)
    setNewPlan((p) => ({
      name: preset.name,
      description: preset.description,
      coverImageUrl: p.coverImageUrl,
      price: p.price > 0 ? p.price : 1290,
      plan: 'WEEKLY',
    }))
    const ids = new Set<string>()
    const lim: Record<string, number> = {}
    for (const s of preset.rules.allowedCategorySlugs) {
      const cat = categories.find((x) => x.slug === s)
      if (cat) {
        ids.add(cat.id)
        const n = preset.rules.categoryLimits[s]
        lim[cat.id] = typeof n === 'number' && n >= 1 ? n : 1
      }
    }
    setNewPlanAllowedIds(ids)
    setNewPlanLimits(lim)
    setNewPlanMinDishes(preset.rules.minDishesPerDelivery)
    setNewPlanMaxDishes(preset.rules.maxDishesPerDelivery)
    setNewPlanMinDays(preset.rules.minDaysPerWeek)
    setNewPlanMaxDays(preset.rules.maxDaysPerWeek)
    if (ids.size === 0 && categories.length > 0) {
      toast.error('Нет категорий с slug пресета — проверьте slug в меню или блок «Свои лимиты»')
    } else if (categories.length === 0) {
      toast('Категории загружаются…')
    } else {
      toast.success(`«${preset.name}» — проверьте цену и нажмите «добавить»`)
    }
  }

  async function createPlan() {
    if (!canCreate) return
    setCreatePlanError(null)
    const lim: Record<string, number> = {}
    newPlanAllowedIds.forEach((id) => {
      const v = newPlanLimits[id]
      lim[id] = typeof v === 'number' && v >= 1 ? v : 1
    })
    try {
      const res = await fetch('/api/admin/subscriptions/plans', { credentials: 'include',
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: newPlan.name.trim(),
          description: newPlan.description.trim() || undefined,
          coverImageUrl: newPlan.coverImageUrl.trim() || undefined,
          price: newPlan.price,
          plan: newPlan.plan,
          order: plans.length,
          ...(newPlanPresetSlug ? { presetSlug: newPlanPresetSlug } : {}),
          allowedCategoryIds: Array.from(newPlanAllowedIds),
          categoryLimits: Object.keys(lim).length > 0 ? lim : undefined,
          minDishesPerDelivery: Math.max(1, Math.min(10, newPlanMinDishes)),
          maxDishesPerDelivery: Math.max(1, Math.min(10, newPlanMaxDishes)),
          minDaysPerWeek: Math.max(1, Math.min(7, newPlanMinDays)),
          maxDaysPerWeek: Math.max(1, Math.min(7, newPlanMaxDays)),
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        setCreatePlanError(data?.error || 'не удалось создать')
        return
      }
      setNewPlan({ name: '', description: '', coverImageUrl: '', price: 0, plan: 'WEEKLY' })
      setNewPlanPresetSlug(null)
      setNewPlanAllowedIds(new Set())
      setNewPlanLimits({})
      setNewPlanMinDishes(1)
      setNewPlanMaxDishes(3)
      setNewPlanMinDays(3)
      setNewPlanMaxDays(7)
      await load()
    } catch {
      setCreatePlanError('не удалось создать')
    }
  }

  const cardClass = 'ui-surface-card'
  const cardStyle = { borderRadius: 'var(--radius-large)' as const }

  return (
    <main className="ui-container ui-screen">
      {loading ? (
        <div className={cardClass} style={cardStyle}>
          <span className="ui-muted text-[13px]">загрузка…</span>
        </div>
      ) : (
        <>
          {settingsFetchFailed ? (
            <div className={cn(cardClass, 'mb-4 border-amber-200 bg-amber-50/50')} style={cardStyle}>
              <p className="text-[13px] font-semibold text-amber-900">
                Не удалось загрузить настройки заведения. Откройте{' '}
                <Link href="/admin/venue" className="underline">
                  настройки точки
                </Link>{' '}
                или нажмите «повторить».
              </p>
              <button
                type="button"
                onClick={() => void load()}
                className="btn btn-soft mt-2 rounded-full px-4 py-2 text-[12px] font-semibold"
                style={{ borderRadius: 'var(--radius-pill)' }}
              >
                повторить
              </button>
            </div>
          ) : null}
          {plansLoadError ? (
            <div className={cn(cardClass, 'mb-4')} style={cardStyle}>
              <p className="text-[13px] font-semibold text-red-600">{plansLoadError}</p>
              <p className="ui-muted mt-1 text-[12px]">
                Клиентские подписки и переключатель ниже доступны. Шаблоны планов подгрузятся после исправления.
              </p>
              <button
                type="button"
                onClick={() => void load()}
                className="btn btn-primary mt-3 rounded-full px-4 py-2 text-[12px] font-semibold"
                style={{ borderRadius: 'var(--radius-pill)' }}
              >
                повторить загрузку планов
              </button>
            </div>
          ) : null}
          {!subscriptionEnabled && (
            <EmptyStatePlaceholder
              variant="subscription"
              message={
                <>
                  Включите подписки в{' '}
                  <Link href="/admin/venue" className="font-semibold underline">
                    настройках заведения
                  </Link>
                  .
                </>
              }
            />
          )}
          {subscriptionEnabled && (
            <>
              <div className="mt-6 rounded-2xl border p-4" style={{ borderColor: 'var(--stroke)', borderRadius: 'var(--radius-large)' }}>
                <AdminSubscriptionCatalog />
              </div>
              <details className="mt-8 rounded-2xl border p-4" style={{ borderColor: 'var(--stroke)', borderRadius: 'var(--radius-large)' }}>
                <summary className="cursor-pointer text-[14px] font-extrabold tracking-tight text-black/70">
                  шаблоны планов (устаревший режим)
                </summary>
                <p className="ui-muted mt-2 text-[12px]">
                  Standard/Fit/Family — для визарда «готовый рацион». Основной поток — каталог выше.
                </p>
                <div className="mt-4">
                <div className="mb-4 flex flex-wrap gap-2">
                  {DEFAULT_SUBSCRIPTION_PLANS.map((pr) => (
                    <button
                      key={pr.slug}
                      type="button"
                      onClick={() => applyPreset(pr.slug as 'standard' | 'fit' | 'family')}
                      className="btn btn-soft rounded-full px-3 py-1.5 text-[12px] font-semibold"
                      style={{ borderRadius: 'var(--radius-pill)' }}
                    >
                      {pr.name}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-4 rounded-xl border p-4" style={{ borderColor: 'var(--stroke)', borderRadius: 'var(--radius-large)' }}>
                  <input
                    type="text"
                    placeholder="название вашего плана"
                    value={newPlan.name}
                    onChange={(e) => {
                      setNewPlan((p) => ({ ...p, name: e.target.value }))
                      if (newPlanPresetSlug) setNewPlanPresetSlug(null)
                    }}
                    className="input min-w-[200px] flex-1 rounded-lg px-3 py-2 text-[13px]"
                  />
                  <input
                    type="text"
                    placeholder="описание (что входит)"
                    value={newPlan.description}
                    onChange={(e) => {
                      setNewPlan((p) => ({ ...p, description: e.target.value }))
                      if (newPlanPresetSlug) setNewPlanPresetSlug(null)
                    }}
                    className="input min-w-[200px] flex-1 rounded-lg px-3 py-2 text-[13px]"
                  />
                  <div className="flex min-w-[200px] flex-1 flex-wrap items-center gap-2">
                    <input
                      type="url"
                      placeholder="обложка: URL или файл"
                      value={newPlan.coverImageUrl}
                      onChange={(e) => setNewPlan((p) => ({ ...p, coverImageUrl: e.target.value }))}
                      className="input min-w-[140px] flex-1 rounded-lg px-3 py-2 text-[13px]"
                    />
                    <input
                      ref={newPlanCoverInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={async (e) => {
                        const f = e.target.files?.[0]
                        e.target.value = ''
                        if (!f) return
                        setNewPlanCoverUploading(true)
                        const r = await uploadMenuImageFile(f)
                        setNewPlanCoverUploading(false)
                        if (!r.ok) {
                          toast.error(r.error)
                          return
                        }
                        setNewPlan((p) => ({ ...p, coverImageUrl: r.url }))
                        toast.success('Фото обложки загружено')
                      }}
                    />
                    <button
                      type="button"
                      disabled={newPlanCoverUploading}
                      onClick={() => newPlanCoverInputRef.current?.click()}
                      className="btn btn-soft shrink-0 rounded-full px-3 py-2 text-[12px] font-semibold disabled:opacity-50"
                      style={{ borderRadius: 'var(--radius-pill)' }}
                    >
                      {newPlanCoverUploading ? '…' : 'фото'}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[12px] font-semibold" style={{ color: 'var(--muted)' }}>Цена (₽)</label>
                    <input
                      type="number"
                      min={0}
                      value={newPlan.price || ''}
                      onChange={(e) => setNewPlan((p) => ({ ...p, price: Number(e.target.value) || 0 }))}
                      className="input w-24 rounded-lg px-3 py-2 text-[13px]"
                    />
                  </div>
                  <div className="flex gap-2">
                    {(['WEEKLY', 'BIWEEKLY', 'MONTHLY'] as const).map((plan) => (
                      <button
                        key={plan}
                        type="button"
                        onClick={() => setNewPlan((p) => ({ ...p, plan }))}
                        className={cn(
                          'rounded-full px-3 py-1.5 text-[12px] font-semibold transition',
                          newPlan.plan === plan ? 'bg-[color:var(--primary)] text-white' : 'bg-black/5 text-black/70'
                        )}
                        style={newPlan.plan !== plan ? { borderRadius: 'var(--radius-pill)' } : { borderRadius: 'var(--radius-pill)' }}
                      >
                        {PLAN_LABEL[plan]}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={!canCreate}
                    onClick={createPlan}
                    className="btn btn-primary rounded-full px-4 py-2 text-[13px] font-semibold disabled:opacity-50"
                    style={{ borderRadius: 'var(--radius-pill)' }}
                  >
                    добавить
                  </button>
                  {createPlanError ? (
                    <p className="w-full text-[12px] font-semibold text-red-600">{createPlanError}</p>
                  ) : null}
                </div>
                <details className="mt-4 rounded-xl border p-3" style={{ borderColor: 'var(--stroke)' }}>
                  <summary className="cursor-pointer select-none text-[12px] font-semibold" style={{ color: 'var(--text)' }}>
                    Свои лимиты и категории <span className="font-normal text-[color:var(--muted)]">(если не из пресета)</span>
                  </summary>
                  <div className="mt-3 flex flex-wrap gap-4 border-t pt-3" style={{ borderColor: 'var(--stroke)' }}>
                    <div className="flex items-center gap-2">
                      <label className="text-[12px]" style={{ color: 'var(--muted)' }}>блюд на доставку</label>
                      <input type="number" min={1} max={10} value={newPlanMinDishes} onChange={(e) => setNewPlanMinDishes(Math.max(1, Math.min(10, Number(e.target.value) || 1)))} className="input w-14 rounded-lg py-1.5 text-center text-[13px]" />
                      <span style={{ color: 'var(--muted)' }}>–</span>
                      <input type="number" min={1} max={10} value={newPlanMaxDishes} onChange={(e) => setNewPlanMaxDishes(Math.max(1, Math.min(10, Number(e.target.value) || 1)))} className="input w-14 rounded-lg py-1.5 text-center text-[13px]" />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-[12px]" style={{ color: 'var(--muted)' }}>дней в неделю</label>
                      <input type="number" min={1} max={7} value={newPlanMinDays} onChange={(e) => setNewPlanMinDays(Math.max(1, Math.min(7, Number(e.target.value) || 1)))} className="input w-14 rounded-lg py-1.5 text-center text-[13px]" />
                      <span style={{ color: 'var(--muted)' }}>–</span>
                      <input type="number" min={1} max={7} value={newPlanMaxDays} onChange={(e) => setNewPlanMaxDays(Math.max(1, Math.min(7, Number(e.target.value) || 1)))} className="input w-14 rounded-lg py-1.5 text-center text-[13px]" />
                    </div>
                  </div>
                  {categories.length > 0 && (
                    <div className="mt-3">
                      <p className="mb-1.5 text-[11px] font-semibold uppercase" style={{ color: 'var(--muted)' }}>категории меню</p>
                      <div className="flex flex-wrap gap-2">
                        {categories.map((c) => (
                          <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[12px]" style={{ borderColor: newPlanAllowedIds.has(c.id) ? 'var(--primary)' : 'var(--stroke)', borderRadius: 'var(--radius)' }}>
                            <input type="checkbox" checked={newPlanAllowedIds.has(c.id)} onChange={() => { setNewPlanAllowedIds((prev) => { const n = new Set(prev); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n }) }} className="rounded" />
                            {c.name}
                            {newPlanAllowedIds.has(c.id) && (
                              <input type="number" min={1} max={10} value={newPlanLimits[c.id] ?? 1} onChange={(e) => setNewPlanLimits((p) => ({ ...p, [c.id]: Math.max(1, Math.min(10, Number(e.target.value) || 1)) }))} className="input w-10 rounded py-0.5 text-center text-[12px]" />
                            )}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </details>
              {plans.length > 0 && (
                <div className="mt-4">
                  <div
                    className="flex gap-4 overflow-x-auto pb-2 pr-4"
                    style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
                  >
                    {plans.map((p) => {
                      const cover = typeof p.coverImageUrl === 'string' ? p.coverImageUrl.trim() : ''
                      return (
                      <div
                        key={p.id}
                        className="flex w-[280px] flex-shrink-0 flex-col overflow-hidden rounded-xl border shadow-[var(--shadow-soft)]"
                        style={{
                          scrollSnapAlign: 'start',
                          borderColor: 'var(--stroke)',
                          borderRadius: 'var(--radius-large)',
                          background: 'var(--surface-strong)',
                          minHeight: 140,
                          opacity: p.isActive ? 1 : 0.72,
                        }}
                      >
                        <div
                          className="h-[88px] w-full shrink-0 bg-center bg-cover"
                          style={
                            cover
                              ? { backgroundImage: `url(${cover})` }
                              : { background: subscriptionPlanPresetGradient(p.presetSlug) }
                          }
                        />
                        <div className="px-4 py-3">
                          <span className="font-semibold text-[14px]" style={{ color: 'var(--text)' }}>{p.name}</span>
                          <span className="mt-1 block text-[12px]" style={{ color: 'var(--muted)' }}>{formatPrice(Number(p.price))} / {PLAN_LABEL[p.plan as keyof typeof PLAN_LABEL]}</span>
                          {!p.isActive ? (
                            <span className="mt-1 inline-block rounded-full bg-black/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                              не в приложении
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-2 px-4 pb-4">
                          <button
                            type="button"
                            title={p.isActive ? 'Скрыть с витрины (гость не увидит)' : 'Показать гостю в визарде'}
                            onClick={async () => {
                              const next = !p.isActive
                              const snap = plans.map((x) => ({ ...x }))
                              setPlans((prev) => prev.map((x) => (x.id === p.id ? { ...x, isActive: next } : x)))
                              try {
                                const res = await fetch('/api/admin/subscriptions/plans', {
                                  method: 'PATCH',
                                  credentials: 'include',
                                  headers: { 'content-type': 'application/json' },
                                  body: JSON.stringify({ id: p.id, isActive: next }),
                                })
                                const data = await res.json().catch(() => null)
                                if (!res.ok) {
                                  setPlans(snap)
                                  toast.error(data?.error || 'Не удалось сохранить')
                                } else {
                                  toast.success(next ? 'На витрине' : 'Скрыт с витрины')
                                }
                              } catch {
                                setPlans(snap)
                                toast.error('Ошибка сети')
                              }
                            }}
                            className={cn(
                              'btn rounded-full px-3 py-1.5 text-[11px] font-semibold',
                              p.isActive ? 'btn-soft' : 'border border-amber-200/80 bg-amber-50 text-amber-900'
                            )}
                            style={{ borderRadius: 'var(--radius-pill)' }}
                          >
                            {p.isActive ? 'на витрине' : 'включить'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingPlanId(editingPlanId === p.id ? null : p.id)}
                            className="btn btn-soft rounded-full px-3 py-1.5 text-[12px] font-semibold"
                            style={{ borderRadius: 'var(--radius-pill)' }}
                          >
                            {editingPlanId === p.id ? 'закрыть' : 'правила'}
                          </button>
                          <button
                            type="button"
                          onClick={async () => {
                            if (!confirm(`Удалить план «${p.name}»?`)) return
                            const planToRemove = p
                            const snapshotBefore = plans.map((pl) => pl)
                            deletedPlanIdsRef.current.add(planToRemove.id)
                            setPlans((prev) => prev.filter((plan) => plan.id !== planToRemove.id))
                            try {
                              const res = await fetch(`/api/admin/subscriptions/plans?id=${encodeURIComponent(planToRemove.id)}`, {
                                method: 'DELETE',
                                credentials: 'include',
                                cache: 'no-store',
                              })
                              const data = await res.json().catch(() => null)
                              if (!res.ok) {
                                deletedPlanIdsRef.current.delete(planToRemove.id)
                                setPlans(snapshotBefore)
                                const msg =
                                  res.status === 401
                                    ? 'Войдите в аккаунт в этом браузере и повторите'
                                    : res.status === 403
                                      ? 'Нет прав владельца на это заведение (проверьте выбор ресторана в ЛК)'
                                      : res.status === 404
                                        ? 'План не найден'
                                        : (typeof data?.error === 'string' ? data.error : 'Не удалось удалить')
                                toast.error(msg)
                              } else {
                                deletedPlanIdsRef.current.delete(planToRemove.id)
                                toast.success('План удалён')
                                await load()
                              }
                            } catch {
                              deletedPlanIdsRef.current.delete(planToRemove.id)
                              setPlans(snapshotBefore)
                              toast.error('Ошибка сети')
                            }
                          }}
                            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-red-600 hover:bg-red-50"
                          >
                            <IconTrash className="h-4 w-4" />
                          </button>
                        </div>
                        {editingPlanId === p.id && (
                          <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--stroke)' }}>
                            <PlanRulesForm
                              plan={p}
                              categories={categories}
                              onSave={async (u) => {
                                try {
                                  const res = await fetch('/api/admin/subscriptions/plans', {
                                    method: 'PATCH',
                                    credentials: 'include',
                                    headers: { 'content-type': 'application/json' },
                                    body: JSON.stringify({
                                      id: p.id,
                                      allowedCategoryIds: u.allowedCategoryIds,
                                      categoryLimits: u.categoryLimits,
                                      minDishesPerDelivery: u.minDishesPerDelivery,
                                      maxDishesPerDelivery: u.maxDishesPerDelivery,
                                      minDaysPerWeek: u.minDaysPerWeek,
                                      maxDaysPerWeek: u.maxDaysPerWeek,
                                      coverImageUrl: u.coverImageUrl,
                                    }),
                                  })
                                  const data = await res.json().catch(() => null)
                                  if (res.ok && data?.ok) { setEditingPlanId(null); await load() }
                                  else toast.error(data?.error || 'Не удалось сохранить')
                                } catch { toast.error('Ошибка сети') }
                              }}
                              onCancel={() => setEditingPlanId(null)}
                            />
                          </div>
                        )}
                      </div>
                      )
                    })}
                  </div>
                </div>
              )}
              {plans.length === 0 && (
                <p className="ui-muted mt-2 text-[12px]">Пока нет шаблонов. Добавьте план выше.</p>
              )}
                </div>
              </details>
            </>
          )}
          <div className="mt-8">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[13px] font-extrabold tracking-tight text-black/70">подписки клиентов</div>
                <p className="ui-muted text-[12px]">Сначала выберите клиента, затем смотрите его подписки и статистику.</p>
              </div>
              {clientSubscriptions.length > 0 && (
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm('Удалить все подписки ресторана? Это нельзя отменить.')) return
                    try {
                      const res = await fetch('/api/admin/subscriptions?resetAll=1', { method: 'DELETE', credentials: 'include' })
                      const data = await res.json().catch(() => null)
                      if (res.ok && data?.ok) {
                        toast.success(`Удалено подписок: ${data.deleted ?? 0}`)
                        await loadClientSubscriptions()
                      } else {
                        toast.error(data?.error || 'Не удалось удалить')
                      }
                    } catch {
                      toast.error('Ошибка сети')
                    }
                  }}
                  className="btn btn-soft rounded-full px-3 py-1.5 text-[12px] font-semibold text-red-600 hover:bg-red-50"
                  style={{ borderRadius: 'var(--radius-pill)' }}
                >
                  сбросить все подписки
                </button>
              )}
            </div>
            {clientSubsLoading ? (
              <div className={cardClass} style={cardStyle}>
                <span className="ui-muted text-[13px]">загрузка…</span>
              </div>
            ) : clientSubscriptions.length === 0 ? (
              <div className={cardClass} style={cardStyle}>
                <p className="ui-muted text-[13px]">Пока нет подписок клиентов</p>
              </div>
            ) : (() => {
              const byUser = new Map<string, ClientSubscription[]>()
              for (const s of clientSubscriptions) {
                const uid = s.user?.id ?? `anon-${s.id}`
                if (!byUser.has(uid)) byUser.set(uid, [])
                byUser.get(uid)!.push(s)
              }
              const clients = Array.from(byUser.entries()).map(([userId, subs]) => {
                const u = subs[0]?.user
                const active = subs.filter((x) => x.status === 'ACTIVE').length
                const total = subs.reduce((acc, x) => acc + Number(x.price || 0), 0)
                return {
                  userId,
                  client: guestClientFromSubscriptionUser(u),
                  subs,
                  active,
                  total,
                }
              })
              return (
                <ClientsSubsSection
                  clients={clients}
                  formatPrice={formatPrice}
                  cn={cn}
                  onDeleteSubscription={async (id) => {
                    try {
                      const res = await fetch(`/api/admin/subscriptions?id=${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'include' })
                      const data = await res.json().catch(() => null)
                      if (res.ok && data?.ok) {
                        toast.success('Подписка удалена')
                        await loadClientSubscriptions()
                      } else {
                        toast.error(data?.error || 'Не удалось удалить')
                      }
                    } catch {
                      toast.error('Ошибка сети')
                    }
                  }}
                />
              )
            })()}
          </div>
        </>
      )}
    </main>
  )
}