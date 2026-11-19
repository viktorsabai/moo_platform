'use client'

import type { Dish } from '@/types'
import { Badge, Btn, Card, Segmented, Stepper, fmtThb } from '@/components/kit'
import type { SubscriptionConfig } from '@/lib/subscription-config'
import { MEAL_SLOT_LABEL, type MealSlot } from '@/lib/subscription-meal-slots'
import {
  WEEKDAYS,
  formatFirstDeliveryMessage,
  wizardDayToJs,
  type PeriodQuote,
  type SelectedLine,
} from '@/features/subscriptions/lib/subscription-checkout-utils'
import { cn } from '@/lib/utils'

/*
 * Второй шаг рациона: доставка, контакты, отправка заявки.
 * Период и блюда уже выбраны на первом экране — здесь только итог и «изменить».
 */

type Props = {
  resumeId: string
  lines: SelectedLine[]
  dishes: Dish[]
  selectedDays: number[]
  slotsByWizardDay: Record<number, MealSlot[]>
  enabledSlots: MealSlot[]
  periodDays: number
  personCount: number
  startDate: Date
  deliveryTime: string
  name: string
  telegramContact: string | null
  subConfig: SubscriptionConfig
  quotesByPeriod: Record<number, PeriodQuote | undefined>
  activeQuote: PeriodQuote | null
  submitting: boolean
  submitError?: string | null
  minDays: number
  daysLocked?: boolean
  onBack: () => void
  onGoBuild?: () => void
  onPeriodDays: (days: number) => void
  onPersonCount: (delta: number) => void
  onStartDate: (date: Date) => void
  onDeliveryTime: (time: string) => void
  onName: (name: string) => void
  onEditRation: () => void
  onSubmit: () => void
}

const DELIVERY_TIMES = [
  { value: '13:00', label: '13:00 – 14:00' },
  { value: '18:00', label: '18:00 – 19:00' },
]

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

/** yyyy-mm-dd в локальной зоне (toISOString сдвигает дату по UTC) */
function localYmd(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function SubscriptionCheckoutConfigPhase({
  resumeId,
  lines,
  dishes,
  selectedDays,
  enabledSlots,
  periodDays,
  personCount,
  startDate,
  deliveryTime,
  name,
  telegramContact,
  subConfig,
  activeQuote,
  submitting,
  submitError,
  minDays,
  onBack,
  onGoBuild,
  onPersonCount,
  onStartDate,
  onDeliveryTime,
  onName,
  onEditRation,
  onSubmit,
}: Props) {
  const totalPrice = activeQuote?.guestPrice ?? 0
  const canSubmit = Boolean(name.trim()) && lines.length > 0 && selectedDays.length >= minDays
  const dishName = new Map(dishes.map((d) => [d.id, d.name]))
  const multiSlot = enabledSlots.length > 1
  const edit = onGoBuild ?? onEditRation
  const times = DELIVERY_TIMES.some((t) => t.value === deliveryTime) ? DELIVERY_TIMES : [{ value: deliveryTime, label: deliveryTime }, ...DELIVERY_TIMES]

  return (
    <main className="mx-auto min-h-screen w-full max-w-md px-4 pb-[calc(var(--ufo-bottomnav-h,72px)+env(safe-area-inset-bottom)+120px)] pt-3">
      <header className="mb-3 flex items-center gap-1">
        <button type="button" onClick={onBack} aria-label="назад" className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center text-[color:var(--text)]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden>
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[18px] font-bold tracking-tight text-[color:var(--text)]">оформление</h1>
          <div className="mt-0.5 text-[12.5px] text-[color:var(--muted)]">доставка и контакты</div>
        </div>
      </header>

      <div className="flex flex-col gap-2.5">
        {/* итог: тот же блок цены, что на первом экране */}
        <Card>
          <div className="flex items-baseline justify-between gap-2">
            <div className="text-[13px] text-[color:var(--muted)]">
              {activeQuote && activeQuote.periodRetail > totalPrice ? (
                <>
                  по меню <span className="line-through">{fmtThb(activeQuote.periodRetail)}</span>
                </>
              ) : (
                'рацион'
              )}
            </div>
            {activeQuote && activeQuote.guestSavingsPercent > 0 ? <Badge tone="ok">−{activeQuote.guestSavingsPercent}% к меню</Badge> : null}
          </div>
          <div className="mt-1 text-[26px] font-bold tracking-tight text-[color:var(--text)]">{totalPrice > 0 ? fmtThb(totalPrice) : '—'}</div>
          <div className="mt-0.5 flex items-center justify-between gap-2">
            <span className="text-[12.5px] text-[color:var(--muted)]">
              {periodShort(periodDays)}
              {activeQuote?.deliveriesInPeriod
                ? ` · ${activeQuote.deliveriesInPeriod} ${plural(activeQuote.deliveriesInPeriod, 'доставка', 'доставки', 'доставок')}`
                : ''}
              {personCount > 1 ? ` · ${personCount} персоны` : ''}
            </span>
            <button type="button" onClick={edit} className="text-[13px] font-semibold text-[color:var(--text)]">
              изменить
            </button>
          </div>
        </Card>

        <Card>
          <div className="mb-2 text-[12.5px] font-semibold text-[color:var(--muted)]">доставка</div>
          <div className="mb-1.5 text-[14px] font-semibold text-[color:var(--text)]">{selectedDays.map((d) => WEEKDAYS[d].toLowerCase()).join(', ')}</div>
          <Segmented value={deliveryTime} onChange={onDeliveryTime} options={times} />
          <label className="mt-2.5 flex min-h-[48px] items-center justify-between gap-3 border-t border-[color:var(--stroke)] pt-2">
            <span className="text-[14px] text-[color:var(--text)]">первая доставка с</span>
            <input
              type="date"
              value={localYmd(startDate)}
              min={localYmd(new Date())}
              onChange={(e) => {
                const d = new Date(`${e.target.value}T12:00:00`)
                if (!Number.isNaN(d.getTime())) onStartDate(d)
              }}
              className="h-10 rounded-[12px] bg-[color:var(--surface)] px-3 text-[14px] font-semibold text-[color:var(--text)] outline-none"
              aria-label="дата старта"
            />
          </label>
          <p className="text-[12.5px] text-[color:var(--muted)]">{formatFirstDeliveryMessage(startDate, selectedDays, deliveryTime)}</p>
          {subConfig.maxPersons > subConfig.minPersons ? (
            <div className="mt-2 flex min-h-[48px] items-center justify-between gap-3 border-t border-[color:var(--stroke)] pt-2">
              <span className="text-[14px] text-[color:var(--text)]">персоны</span>
              <div className="w-[128px]">
                <Stepper value={personCount} onChange={(n) => onPersonCount(n - personCount)} min={subConfig.minPersons} max={subConfig.maxPersons} />
              </div>
            </div>
          ) : null}
        </Card>

        <Card className="!py-1.5">
          <div className="flex items-center justify-between py-1.5">
            <span className="text-[12.5px] font-semibold text-[color:var(--muted)]">рацион</span>
            <button type="button" onClick={edit} className="text-[13px] font-semibold text-[color:var(--text)]">
              изменить
            </button>
          </div>
          {selectedDays.map((d) => {
            const js = wizardDayToJs(d)
            const dayLines = lines.filter((l) => l.dayOfWeek === js)
            return (
              <div key={d} className="flex gap-2.5 border-t border-[color:var(--stroke)] py-2">
                <span className="w-7 shrink-0 text-[13px] font-semibold text-[color:var(--muted)]">{WEEKDAYS[d].toLowerCase()}</span>
                <span className="min-w-0 flex-1 text-[13.5px] leading-snug text-[color:var(--text)]">
                  {dayLines.length
                    ? dayLines
                        .map((l) => `${multiSlot && l.mealSlot ? `${MEAL_SLOT_LABEL[l.mealSlot]}: ` : ''}${dishName.get(l.dishId) ?? 'блюдо'}${l.quantity > 1 ? ` ×${l.quantity}` : ''}`)
                        .join(', ')
                    : '—'}
                </span>
              </div>
            )
          })}
        </Card>

        <Card className="!py-1">
          <label className="flex min-h-[48px] items-center justify-between gap-3">
            <span className="text-[14px] text-[color:var(--text)]">имя</span>
            <input
              type="text"
              value={name}
              onChange={(e) => onName(e.target.value)}
              placeholder="как к вам обращаться"
              autoComplete="given-name"
              className={cn(
                'h-10 w-[60%] rounded-[12px] bg-[color:var(--surface)] px-3 text-right text-[14px] font-semibold text-[color:var(--text)] outline-none placeholder:font-normal placeholder:text-[color:var(--muted)]',
                !name.trim() && 'ring-1 ring-[color:var(--warn)]'
              )}
            />
          </label>
          <div className="flex min-h-[48px] items-center justify-between gap-3 border-t border-[color:var(--stroke)]">
            <span className="text-[14px] text-[color:var(--text)]">telegram</span>
            <span className="text-[14px] font-semibold text-[color:var(--text)]">{telegramContact || 'из mini app'}</span>
          </div>
        </Card>
      </div>

      <div
        className="fixed inset-x-0 z-[115] mx-auto w-full max-w-md border-t border-[color:var(--stroke)] bg-[color:var(--surface-strong)] px-4 pb-3 pt-2.5 backdrop-blur-md"
        style={{ bottom: 'calc(var(--ufo-bottomnav-h, 72px) + env(safe-area-inset-bottom))' }}
      >
        {submitError ? (
          <p className="mb-2 rounded-[12px] bg-[color:var(--danger-bg)] px-3 py-2 text-center text-[13px] font-semibold text-[color:var(--danger)]">{submitError}</p>
        ) : !name.trim() ? (
          <p className="mb-1.5 text-center text-[12.5px] font-medium text-[color:var(--muted)]">укажите имя — так кухня подпишет заказ</p>
        ) : null}
        <Btn full size="lg" disabled={!canSubmit || submitting} onClick={onSubmit}>
          {submitting ? 'отправляем…' : `${resumeId ? 'сохранить' : 'отправить заявку'} · ${fmtThb(totalPrice)}`}
        </Btn>
        <p className="mt-1.5 text-center text-[11px] text-[color:var(--muted)]">без скрытых платежей · подтверждение придёт в Telegram</p>
      </div>
    </main>
  )
}
