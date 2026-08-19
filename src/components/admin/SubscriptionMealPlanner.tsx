'use client'

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { cn, formatPrice } from '@/lib/utils'
import { MEAL_SLOT_IDS, MEAL_SLOT_LABEL, type MealSlot } from '@/lib/subscription-meal-slots'
import type { SubscriptionConfig } from '@/lib/subscription-config'

type PlannerDish = { id: string; name: string; price: number; emoji?: string | null }
type PlannerDraft = Record<string, Partial<Record<MealSlot, string[]>>>

const DAYS = [
  { id: 1, label: 'Пн' }, { id: 2, label: 'Вт' }, { id: 3, label: 'Ср' },
  { id: 4, label: 'Чт' }, { id: 5, label: 'Пт' }, { id: 6, label: 'Сб' }, { id: 0, label: 'Вс' },
]

function buildInitialDraft(config: SubscriptionConfig): PlannerDraft {
  const draft: PlannerDraft = {}
  for (const day of DAYS) {
    draft[String(day.id)] = {}
    for (const slot of MEAL_SLOT_IDS) {
      const slotConfig = config.mealSlots[slot]
      if (!slotConfig?.enabled) continue
      draft[String(day.id)][slot] = slotConfig.defaultDishIds.slice(0, slotConfig.maxItemsPerDelivery)
    }
  }
  return draft
}

export function SubscriptionMealPlanner({ config, dishes, onClose }: { config: SubscriptionConfig; dishes: PlannerDish[]; onClose: () => void }) {
  const draftKey = 'moo:subscription-meal-plan:draft:v1'
  const [activeDay, setActiveDay] = useState(1)
  const [draft, setDraft] = useState<PlannerDraft>(() => buildInitialDraft(config))
  const [restored, setRestored] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [draftId, setDraftId] = useState<string | null>(null)
  const [serverReady, setServerReady] = useState(false)
  const [serverSaving, setServerSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/subscriptions/meal-plan-drafts', { cache: 'no-store', credentials: 'include' })
      .then((res) => res.json().catch(() => null))
      .then((data) => {
        if (cancelled) return
        const remote = Array.isArray(data?.drafts) ? data.drafts[0] : null
        if (remote?.id && remote?.payload && typeof remote.payload === 'object') {
          setDraftId(String(remote.id))
          setDraft(remote.payload as PlannerDraft)
          setRestored(true)
        } else {
          try {
            const raw = window.localStorage.getItem(draftKey)
            if (raw) {
              const parsed = JSON.parse(raw) as PlannerDraft
              if (parsed && typeof parsed === 'object') {
                setDraft(parsed)
                setRestored(true)
              }
            }
          } catch {
            // local draft is optional; the planner remains usable
          }
        }
        setServerReady(true)
      })
      .catch(() => {
        if (!cancelled) {
          setServerError('Серверный черновик недоступен — сохраняем локально')
          setServerReady(true)
        }
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        window.localStorage.setItem(draftKey, JSON.stringify(draft))
        setSavedAt(new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }))
      } catch {
        // private mode or blocked storage: server draft remains the source of truth
      }
      if (!serverReady) return
      setServerSaving(true)
      setServerError(null)
      try {
        const response = await fetch('/api/admin/subscriptions/meal-plan-drafts', {
          method: draftId ? 'PATCH' : 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(draftId ? { id: draftId, payload: draft } : { name: 'Новый рацион', payload: draft, periodDays: config.defaultPeriodDays, personCount: config.maxPersons }),
        })
        const data = await response.json().catch(() => null)
        if (!response.ok || !data?.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Не удалось сохранить черновик')
        if (!draftId && data.draft?.id) setDraftId(String(data.draft.id))
      } catch (error) {
        setServerError(error instanceof Error ? error.message : 'Не удалось сохранить серверный черновик')
      } finally {
        setServerSaving(false)
      }
    }, 800)
    return () => window.clearTimeout(timer)
  }, [draft, draftId, serverReady, config.defaultPeriodDays, config.maxPersons])

  const activeDayDraft = draft[String(activeDay)] ?? {}
  const eligibleById = useMemo(() => new Map(dishes.map((dish) => [dish.id, dish])), [dishes])
  const enabledSlots = MEAL_SLOT_IDS.filter((slot) => config.mealSlots[slot]?.enabled)
  const selectedCount = Object.values(draft).reduce((total, day) => total + Object.values(day).reduce((count, ids) => count + (ids?.length ?? 0), 0), 0)
  const selectedPrice = Object.values(draft).reduce((total, day) => total + Object.values(day).reduce((sum, ids) => sum + (ids ?? []).reduce((s, id) => s + Number(eligibleById.get(id)?.price ?? 0), 0), 0), 0)

  function toggleDish(slot: MealSlot, dishId: string) {
    setDraft((previous) => {
      const day = previous[String(activeDay)] ?? {}
      const current = day[slot] ?? []
      const max = config.mealSlots[slot]?.maxItemsPerDelivery ?? 1
      const next = current.includes(dishId) ? current.filter((id) => id !== dishId) : current.length < max ? [...current, dishId] : current
      return { ...previous, [String(activeDay)]: { ...day, [slot]: next } }
    })
  }

  async function resetDraft() {
    const previousId = draftId
    setDraft(buildInitialDraft(config))
    setDraftId(null)
    try { window.localStorage.removeItem(draftKey) } catch {}
    if (previousId) {
      await fetch(`/api/admin/subscriptions/meal-plan-drafts?id=${encodeURIComponent(previousId)}`, { method: 'DELETE', credentials: 'include' }).catch(() => null)
    }
    setRestored(false)
    toast.success('Рацион сброшен к настройкам подписки')
  }

  return (
    <section id="subscription-meal-planner" className="scroll-mt-24 rounded-[28px] border border-[color:var(--primary)]/20 bg-[color:var(--surface-strong)] p-5 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[color:var(--muted)]">конструктор рациона</p>
          <h3 className="mt-1 text-[22px] font-black tracking-[-0.04em] text-[color:var(--text)]">Соберите меню по дням</h3>
          <p className="mt-1 max-w-xl text-[13px] font-medium leading-relaxed text-[color:var(--muted)]">Настройки подписки ограничивают выбор. Здесь вы собираете конкретный рацион — и можете вернуться к нему позже.</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-full border border-[color:var(--stroke)] px-3 py-1.5 text-[12px] font-extrabold text-[color:var(--muted)]">закрыть</button>
      </div>
      {restored ? <div className="mt-3 rounded-2xl bg-[color:var(--primary)]/[0.08] px-3 py-2 text-[12px] font-bold text-[color:var(--text)]">восстановлен серверный черновик рациона</div> : null}
      {serverError ? <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-950">{serverError}</div> : null}
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {DAYS.map((day) => {
            const active = day.id === activeDay
            const count = Object.values(draft[String(day.id)] ?? {}).reduce((sum, ids) => sum + (ids?.length ?? 0), 0)
            return <button key={day.id} type="button" onClick={() => setActiveDay(day.id)} className={cn('min-w-14 rounded-2xl border px-3 py-2 text-left transition', active ? 'border-[color:var(--primary)] bg-[color:var(--primary)] text-white' : 'border-[color:var(--stroke)] bg-[color:var(--surface)]')}><span className="block text-[12px] font-extrabold">{day.label}</span><span className={cn('mt-0.5 block text-[10px] font-semibold', active ? 'text-white/75' : 'text-[color:var(--muted)]')}>{count ? `${count} блюд` : 'пусто'}</span></button>
          })}
        </div>
        <div className="text-left sm:text-right"><p className="text-[11px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">черновик</p><p className="mt-1 text-[13px] font-extrabold text-[color:var(--text)]">{serverSaving ? 'сохраняем на сервере…' : savedAt ? `сохранён в ${savedAt}` : 'сохраняется автоматически'}</p></div>
      </div>
      {enabledSlots.length === 0 ? <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-[13px] font-semibold text-amber-950">Сначала включите хотя бы один слот питания в настройках подписки.</div> : <div className="mt-5 space-y-3">{enabledSlots.map((slot) => { const ids = activeDayDraft[slot] ?? []; const slotConfig = config.mealSlots[slot]; return <div key={slot} className="rounded-2xl border border-[color:var(--stroke)] bg-[color:var(--surface)] p-3"><div className="flex items-center justify-between gap-3"><div><p className="text-[14px] font-extrabold text-[color:var(--text)]">{MEAL_SLOT_LABEL[slot]}</p><p className="mt-0.5 text-[11px] text-[color:var(--muted)]">до {slotConfig.maxItemsPerDelivery} блюд</p></div><span className="rounded-full bg-[color:var(--primary)]/[0.08] px-2.5 py-1 text-[11px] font-extrabold text-[color:var(--text)]">{ids.length}/{slotConfig.maxItemsPerDelivery}</span></div><div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-none">{dishes.map((dish) => { const selected = ids.includes(dish.id); const allowed = slotConfig.dishIds.length === 0 || slotConfig.dishIds.includes(dish.id); return <button key={dish.id} type="button" disabled={!allowed} onClick={() => toggleDish(slot, dish.id)} className={cn('min-w-[150px] rounded-2xl border p-3 text-left transition active:scale-[0.98]', selected ? 'border-[color:var(--primary)] bg-[color:var(--primary)] text-white' : 'border-[color:var(--stroke)] bg-[color:var(--surface-strong)]', !allowed && 'cursor-not-allowed opacity-35')}><span className="block text-[18px]">{dish.emoji ?? '🍽️'}</span><span className="mt-1 block line-clamp-2 text-[12px] font-extrabold">{dish.name}</span><span className={cn('mt-1 block text-[11px] font-semibold', selected ? 'text-white/75' : 'text-[color:var(--muted)]')}>{formatPrice(dish.price)}</span></button> })}</div></div> })}</div>}
      <div className="mt-5 flex flex-wrap items-end justify-between gap-3 border-t border-[color:var(--stroke)] pt-4"><div><p className="text-[11px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">итог рациона</p><p className="mt-1 text-[15px] font-black text-[color:var(--text)]">{selectedCount} блюд · {formatPrice(selectedPrice)} за полный цикл</p><p className="mt-1 text-[11px] text-[color:var(--muted)]">Финальная цена проверяется в коммерческом preview.</p></div><div className="flex gap-2"><button type="button" onClick={resetDraft} className="btn btn-soft rounded-full px-3 py-2 text-[12px] font-extrabold">сбросить</button><button type="button" onClick={() => { try { window.localStorage.setItem(draftKey, JSON.stringify(draft)) } catch {}; setSavedAt(new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })); toast.success(draftId ? 'Черновик рациона сохранён' : 'Черновик сохранится на сервере автоматически') }} className="btn btn-primary rounded-full px-3 py-2 text-[12px] font-extrabold">сохранить рацион</button></div></div>
    </section>
  )
}
