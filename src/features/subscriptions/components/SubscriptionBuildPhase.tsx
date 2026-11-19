'use client'

import { useMemo, useState } from 'react'
import type { Dish } from '@/types'
import { Badge, Btn, Card, Chip, Segmented, Sheet, fmtThb } from '@/components/kit'
import { OptimizedImage } from '@/components/ui/OptimizedImage'
import { MEAL_SLOT_LABEL, type MealSlot } from '@/lib/subscription-meal-slots'
import type { SubscriptionConfig } from '@/lib/subscription-config'
import type { MenuCategory, PeriodQuote, SelectedLine } from '@/features/subscriptions/lib/subscription-checkout-utils'
import {
  dishHasConfigurableOptions,
  groupDishesForPicker,
  nextMissingMealHint,
  slotsForWizardDay,
  summarizeLineModifiers,
  WEEKDAYS,
  wizardDayToJs,
} from '@/features/subscriptions/lib/subscription-checkout-utils'
import { cn } from '@/lib/utils'

/*
 * Конструктор рациона — один экран, как в макете Ration.dc.html:
 * период со скидкой → вся неделя строками (день · блюда · «+») → «повторить на все дни» →
 * цена с зачёркнутой «по меню». Блюда дня выбираются в шторке.
 * Вся логика (цены, слоты, лимиты, черновик) — в SubscriptionCheckoutFlow; здесь только вид.
 */

type Props = {
  selectedDays: number[]
  activeWizardDay: number
  activeSlot: MealSlot
  slotsForActiveDay: MealSlot[]
  slotsByWizardDay: Record<number, MealSlot[]>
  enabledSlots: MealSlot[]
  /** все блюда рациона — для названий в строках дней */
  dishes: Dish[]
  /** блюда, доступные в активном приёме пищи */
  pickerDishes: Dish[]
  lines: SelectedLine[]
  menuCategories: MenuCategory[]
  subConfig: SubscriptionConfig
  minDays: number
  maxDays: number
  quotesByPeriod: Record<number, PeriodQuote | undefined>
  periodDays: number
  onPeriodDays: (days: number) => void
  onDayCell: (wizardDay: number) => void
  onRemoveDayDelivery: (wizardDay: number) => void
  onToggleMealSlot: (slot: MealSlot) => void
  onActiveSlot: (s: MealSlot) => void
  onAddDish: (dishId: string) => void
  onEditLine: (line: SelectedLine) => void
  onRemoveLine: (line: SelectedLine) => void
  onCopyDayToAll: (wizardDay: number) => void
  onContinue: () => void
}

const DAY_FULL = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье']
const DAY_ACC = ['понедельник', 'вторник', 'среду', 'четверг', 'пятницу', 'субботу', 'воскресенье']

function periodShort(days: number) {
  if (days === 7) return 'неделя'
  if (days === 14) return '2 недели'
  if (days === 28) return '4 недели'
  return `${days} дн.`
}

function plural(n: number, one: string, few: string, many: string) {
  const a = n % 10
  const b = n % 100
  if (a === 1 && b !== 11) return one
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few
  return many
}

function dayComplete(lines: SelectedLine[], wizardDay: number, slots: MealSlot[]) {
  const js = wizardDayToJs(wizardDay)
  if (!slots.length) return false
  return slots.every((slot) => lines.some((l) => l.dayOfWeek === js && l.mealSlot === slot))
}

export function SubscriptionBuildPhase(props: Props) {
  const {
    selectedDays,
    activeWizardDay,
    activeSlot,
    slotsByWizardDay,
    enabledSlots,
    dishes,
    lines,
    subConfig,
    minDays,
    quotesByPeriod,
    periodDays,
    onPeriodDays,
    onDayCell,
    onCopyDayToAll,
    onContinue,
  } = props
  const [sheetDay, setSheetDay] = useState<number | null>(null)

  const dishById = useMemo(() => new Map(dishes.map((d) => [d.id, d])), [dishes])
  const daysOk = selectedDays.length >= minDays
  const allComplete = daysOk && selectedDays.every((d) => dayComplete(lines, d, slotsForWizardDay(slotsByWizardDay, d, enabledSlots)))
  const missingHint = daysOk && !allComplete ? nextMissingMealHint(lines, selectedDays, slotsByWizardDay, enabledSlots) : null
  const multiSlot = enabledSlots.length > 1

  const periods = subConfig.availablePeriods?.length ? subConfig.availablePeriods : [7, 14, 28]
  const quote = quotesByPeriod[periodDays]

  /** день-образец для «повторить на все дни»: активный, если он заполнен, иначе первый заполненный */
  const templateDay = useMemo(() => {
    const filled = (d: number) => lines.some((l) => l.dayOfWeek === wizardDayToJs(d))
    if (selectedDays.includes(activeWizardDay) && filled(activeWizardDay)) return activeWizardDay
    return selectedDays.find(filled) ?? null
  }, [lines, selectedDays, activeWizardDay])

  const openDay = (d: number) => {
    onDayCell(d)
    setSheetDay(d)
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md px-4 pb-[calc(var(--ufo-bottomnav-h,72px)+env(safe-area-inset-bottom)+92px)] pt-3">
      <header className="mb-3">
        <h1 className="text-[22px] font-bold tracking-tight text-[color:var(--text)]">рацион</h1>
        <p className="mt-0.5 text-[13px] text-[color:var(--muted)]">соберите неделю — цена всегда ниже меню</p>
      </header>

      <div className="flex flex-col gap-2.5">
        {periods.length > 1 ? (
          <Segmented
            value={String(periodDays)}
            onChange={(v) => onPeriodDays(Number(v))}
            options={[...periods]
              .sort((a, b) => b - a)
              .map((p) => {
                const pct = quotesByPeriod[p]?.guestSavingsPercent ?? 0
                return { value: String(p), label: pct > 0 ? `${periodShort(p)} · −${pct}%` : periodShort(p) }
              })}
          />
        ) : null}

        <Card className="!px-3.5 !py-1.5">
          {WEEKDAYS.map((_, d) => {
            const on = selectedDays.includes(d)
            const js = wizardDayToJs(d)
            const dayLines = lines.filter((l) => l.dayOfWeek === js)
            const done = on && dayComplete(lines, d, slotsForWizardDay(slotsByWizardDay, d, enabledSlots))
            return (
              <div key={d} className={cn('flex min-h-[56px] items-center gap-2.5 py-1.5', d > 0 && 'border-t border-[color:var(--stroke)]')}>
                <button type="button" onClick={() => openDay(d)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                  <span className={cn('w-8 shrink-0 text-[13px] font-semibold', on ? 'text-[color:var(--text)]' : 'text-[color:var(--muted)]')}>
                    {WEEKDAYS[d].toLowerCase()}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                    {!on ? (
                      <span className="text-[13px] text-[color:var(--muted)]">без доставки</span>
                    ) : dayLines.length ? (
                      dayLines.map((l) => (
                        <span key={`${l.mealSlot}:${l.dishId}:${l.modifierIds.join('|')}`} className="max-w-full truncate rounded-full bg-[color:var(--bg)] px-3 py-1.5 text-[13px] text-[color:var(--text)]">
                          {multiSlot && l.mealSlot ? <span className="text-[color:var(--muted)]">{MEAL_SLOT_LABEL[l.mealSlot]} · </span> : null}
                          {dishById.get(l.dishId)?.name ?? 'блюдо'}
                          {l.quantity > 1 ? ` ×${l.quantity}` : ''}
                        </span>
                      ))
                    ) : (
                      <span className="text-[13px] font-medium text-[color:var(--warn)]">выберите блюда</span>
                    )}
                    {on && dayLines.length && !done ? <span className="text-[12px] font-medium text-[color:var(--warn)]">не все приёмы</span> : null}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => openDay(d)}
                  aria-label={`добавить блюдо: ${DAY_FULL[d]}`}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-dashed border-[color:var(--stroke-strong)] text-[20px] text-[color:var(--muted)]"
                >
                  +
                </button>
              </div>
            )
          })}
        </Card>

        {templateDay !== null && selectedDays.length > 1 ? (
          <Btn variant="secondary" full onClick={() => onCopyDayToAll(templateDay)}>
            повторить {DAY_ACC[templateDay]} на все дни
          </Btn>
        ) : null}

        <Card>
          {quote && quote.guestPrice > 0 ? (
            <>
              <div className="flex items-baseline justify-between gap-2">
                <div className="text-[13px] text-[color:var(--muted)]">
                  по меню <span className="line-through">{fmtThb(quote.periodRetail)}</span>
                </div>
                {quote.guestSavingsPercent > 0 ? <Badge tone="ok">−{quote.guestSavingsPercent}% к меню</Badge> : null}
              </div>
              <div className="mt-1 text-[26px] font-bold tracking-tight text-[color:var(--text)]">{fmtThb(quote.guestPrice)}</div>
              <div className="mt-0.5 text-[12.5px] text-[color:var(--muted)]">
                {periodShort(periodDays)} · {quote.deliveriesInPeriod} {plural(quote.deliveriesInPeriod, 'доставка', 'доставки', 'доставок')}
                {quote.deliveriesInPeriod > 0 ? ` · ≈ ${fmtThb(quote.guestPrice / quote.deliveriesInPeriod)} за доставку` : ''}
              </div>
            </>
          ) : (
            <div className="text-[13px] text-[color:var(--muted)]">
              {daysOk ? 'добавьте блюда — посчитаем цену' : `выберите минимум ${minDays} ${plural(minDays, 'день', 'дня', 'дней')} доставки`}
            </div>
          )}
        </Card>
      </div>

      <div
        className="fixed inset-x-0 z-[110] mx-auto w-full max-w-md border-t border-[color:var(--stroke)] bg-[color:var(--surface-strong)] px-4 pb-3 pt-2.5 backdrop-blur-md"
        style={{ bottom: 'calc(var(--ufo-bottomnav-h, 72px) + env(safe-area-inset-bottom))' }}
      >
        {!allComplete ? (
          <p className="mb-1.5 text-center text-[12.5px] font-medium text-[color:var(--muted)]">
            {!daysOk ? `ещё ${minDays - selectedDays.length} ${plural(minDays - selectedDays.length, 'день', 'дня', 'дней')} доставки` : `добавьте: ${missingHint}`}
          </p>
        ) : null}
        <Btn size="lg" full disabled={!allComplete} onClick={onContinue}>
          оформить рацион
        </Btn>
      </div>

      {sheetDay !== null ? <DaySheet {...props} day={sheetDay} onClose={() => setSheetDay(null)} /> : null}
    </main>
  )
}

/* ---------- шторка одного дня: приёмы, выбранные блюда, подбор ---------- */

function DaySheet({
  day,
  onClose,
  selectedDays,
  activeSlot,
  slotsForActiveDay,
  enabledSlots,
  dishes,
  pickerDishes,
  lines,
  menuCategories,
  subConfig,
  minDays,
  maxDays,
  onToggleMealSlot,
  onActiveSlot,
  onAddDish,
  onEditLine,
  onRemoveLine,
  onRemoveDayDelivery,
}: Props & { day: number; onClose: () => void }) {
  const [category, setCategory] = useState('all')
  const on = selectedDays.includes(day)
  const js = wizardDayToJs(day)
  const dishById = useMemo(() => new Map(dishes.map((d) => [d.id, d])), [dishes])
  const slotLines = lines.filter((l) => l.dayOfWeek === js && l.mealSlot === activeSlot)

  const pickerCategories = useMemo(
    () => menuCategories.filter((c) => pickerDishes.some((d) => (d.categoryId || 'uncat') === c.id)),
    [menuCategories, pickerDishes]
  )
  const sections = useMemo(() => {
    const all = groupDishesForPicker(pickerDishes, pickerCategories.length ? pickerCategories : menuCategories, 'all')
    return category === 'all' ? all : all.filter((s) => s.category.id === category)
  }, [pickerDishes, pickerCategories, menuCategories, category])

  return (
    <Sheet
      open
      onClose={onClose}
      title={DAY_FULL[day]}
      footer={
        <div className="flex gap-2">
          {on && selectedDays.length > minDays ? (
            <Btn
              variant="secondary"
              onClick={() => {
                onRemoveDayDelivery(day)
                onClose()
              }}
            >
              без доставки
            </Btn>
          ) : null}
          <Btn full onClick={onClose}>
            готово
          </Btn>
        </div>
      }
    >
      {!on ? (
        <p className="py-4 text-[14px] text-[color:var(--muted)]">
          в неделе уже {maxDays} {plural(maxDays, 'день', 'дня', 'дней')} доставки — это максимум. уберите доставку в другой день, чтобы выбрать этот.
        </p>
      ) : (
        <>
          {enabledSlots.length > 1 ? (
            <div className="mb-3">
              <div className="mb-1.5 text-[12.5px] font-semibold text-[color:var(--muted)]">приёмы в этот день</div>
              <div className="flex flex-wrap gap-1.5">
                {enabledSlots.map((s) => (
                  <Chip key={s} active={slotsForActiveDay.includes(s)} onClick={() => onToggleMealSlot(s)}>
                    {MEAL_SLOT_LABEL[s]}
                  </Chip>
                ))}
              </div>
            </div>
          ) : null}

          {slotsForActiveDay.length > 1 ? (
            <div className="mb-3">
              <Segmented value={activeSlot} onChange={(v) => onActiveSlot(v as MealSlot)} options={slotsForActiveDay.map((s) => ({ value: s, label: MEAL_SLOT_LABEL[s] }))} />
            </div>
          ) : null}

          {slotLines.length ? (
            <Card className="mb-3 !py-1">
              {slotLines.map((l, i) => {
                const dish = dishById.get(l.dishId)
                const hasOpts = dish ? dishHasConfigurableOptions(dish, subConfig, activeSlot) : false
                const summary = dish ? summarizeLineModifiers(dish, l.modifierIds) : null
                return (
                  <div key={`${l.dishId}:${l.modifierIds.join('|')}`} className={cn('flex min-h-[52px] items-center gap-2 py-1.5', i > 0 && 'border-t border-[color:var(--stroke)]')}>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-semibold text-[color:var(--text)]">{dish?.name ?? 'блюдо'}</div>
                      {hasOpts ? (
                        <button type="button" onClick={() => onEditLine(l)} className={cn('text-[12.5px] font-medium', summary ? 'text-[color:var(--muted)]' : 'text-[color:var(--warn)]')}>
                          {summary ?? 'выбрать вариант'} ›
                        </button>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveLine(l)}
                      aria-label={`убрать ${dish?.name ?? 'блюдо'}`}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[color:var(--muted)]"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
                    </button>
                  </div>
                )
              })}
            </Card>
          ) : (
            <p className="mb-3 text-[13px] text-[color:var(--muted)]">
              {MEAL_SLOT_LABEL[activeSlot]} пока пустой — добавьте блюда ниже
            </p>
          )}

          {pickerCategories.length > 1 ? (
            <div className="-mx-4 mb-2 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <Chip active={category === 'all'} onClick={() => setCategory('all')}>всё</Chip>
              {pickerCategories.map((c) => (
                <Chip key={c.id} active={category === c.id} onClick={() => setCategory(c.id)}>{c.name}</Chip>
              ))}
            </div>
          ) : null}

          {sections.length ? (
            sections.map(({ category: c, dishes: list }) => (
              <section key={c.id} className="mb-3">
                {category === 'all' && sections.length > 1 ? <h3 className="mb-1 text-[13px] font-semibold text-[color:var(--muted)]">{c.name}</h3> : null}
                {list.map((d) => {
                  const picked = slotLines.some((l) => l.dishId === d.id)
                  return (
                    <button
                      key={d.id}
                      type="button"
                      disabled={picked}
                      onClick={() => onAddDish(d.id)}
                      className="flex w-full items-center gap-3 py-1.5 text-left"
                    >
                      <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[14px] bg-[color:var(--surface)]">
                        {d.image ? <OptimizedImage src={d.image} alt="" sizes="56px" className="object-cover" /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold text-[color:var(--text)]">{d.name}</span>
                        <span className="block text-[12.5px] text-[color:var(--muted)]">
                          {fmtThb(d.price)} в меню{d.weightLabel ? ` · ${d.weightLabel}` : ''}
                        </span>
                      </span>
                      <span
                        className={cn(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[18px] font-semibold',
                          picked ? 'bg-[color:var(--ok-bg)] text-[color:var(--ok)]' : 'border border-[color:var(--stroke-strong)] bg-[color:var(--surface-strong)] text-[color:var(--text)]'
                        )}
                        aria-hidden
                      >
                        {picked ? '✓' : '+'}
                      </span>
                    </button>
                  )
                })}
              </section>
            ))
          ) : (
            <p className="text-[13px] text-[color:var(--muted)]">для этого приёма пока нет блюд</p>
          )}
        </>
      )}
    </Sheet>
  )
}
