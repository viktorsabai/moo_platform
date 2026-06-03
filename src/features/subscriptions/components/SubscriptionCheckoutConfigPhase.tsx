'use client'

import type { Dish } from '@/types'
import { cn, formatPrice } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { periodLabel, periodLabelAccusative, type SubscriptionConfig } from '@/lib/subscription-config'
import { formatQuoteSavingsBadge } from '@/lib/subscription-offer-labels'
import { SubscriptionFlowProgress } from '@/features/subscriptions/components/SubscriptionFlowProgress'
import { SubscriptionPeriodCards } from '@/features/subscriptions/components/SubscriptionPeriodCards'
import { SubscriptionRationByDay } from '@/features/subscriptions/components/SubscriptionRationByDay'
import {
  WEEKDAYS,
  type PeriodQuote,
  type SelectedLine,
  formatFirstDeliveryMessage,
  formatWeeklyRationHint,
} from '@/features/subscriptions/lib/subscription-checkout-utils'
import { IconChevronLeft } from '@/components/ui/icons'

type Props = {
  resumeId: string
  lines: SelectedLine[]
  dishes: Dish[]
  selectedDays: number[]
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
  minDays: number
  maxDays: number
  /** Дни уже выбраны на шаге 1 — только просмотр */
  daysLocked?: boolean
  onBack: () => void
  onGoBuild?: () => void
  onToggleDay: (day: number) => void
  onPeriodDays: (days: number) => void
  onPersonCount: (delta: number) => void
  onStartDate: (date: Date) => void
  onDeliveryTime: (time: string) => void
  onName: (name: string) => void
  onRemoveLine: (line: SelectedLine) => void
  onUpdateQty: (line: SelectedLine, delta: number) => void
  onLineModifiers: (line: SelectedLine, ids: string[]) => void
  onAddMore: () => void
  onSubmit: () => void
}

export function SubscriptionCheckoutConfigPhase({
  resumeId,
  lines,
  dishes,
  selectedDays,
  periodDays,
  personCount,
  startDate,
  deliveryTime,
  name,
  telegramContact,
  subConfig,
  quotesByPeriod,
  activeQuote,
  submitting,
  minDays,
  maxDays,
  daysLocked = false,
  onBack,
  onGoBuild,
  onToggleDay,
  onPeriodDays,
  onPersonCount,
  onStartDate,
  onDeliveryTime,
  onName,
  onRemoveLine,
  onUpdateQty,
  onLineModifiers,
  onAddMore,
  onSubmit,
}: Props) {
  const totalPrice = activeQuote?.guestPrice ?? 0
  const retailPrice = activeQuote?.periodRetail ?? 0
  const deliveryCount = activeQuote?.deliveriesInPeriod ?? 0
  const savingsBadge = activeQuote ? formatQuoteSavingsBadge(activeQuote) : null
  const canSubmit = Boolean(name.trim()) && lines.length > 0 && selectedDays.length >= minDays

  const deliveryDaysLabel = selectedDays.map((d) => WEEKDAYS[d]).join(', ')
  const periods = subConfig.availablePeriods ?? [7, 14, 28]
  const scheduleHint = formatWeeklyRationHint(lines, selectedDays)

  return (
    <main className="ui-container ui-screen pb-[calc(var(--ufo-bottomnav-h,72px)+env(safe-area-inset-bottom)+200px)]">
      <div className="flex items-start gap-2">
        <button type="button" onClick={onBack} className="ui-back-button mt-1 shrink-0" aria-label="назад">
          <IconChevronLeft className="h-5 w-5" />
        </button>
        <PageHeader title="оформление подписки" subtitle="период и оплата" compact className="min-w-0 flex-1" />
      </div>

      <SubscriptionFlowProgress step="pay" onStep={(s) => s === 'build' && onGoBuild?.()} payEnabled />

      {scheduleHint ? (
        <p className="mb-4 rounded-[var(--radius-medium)] border border-[color:var(--stroke)] bg-[color:var(--surface)] px-3 py-2.5 text-[12px] leading-snug text-[color:var(--muted)]">
          {scheduleHint}
        </p>
      ) : null}

      <div
        className="mb-4 flex items-center justify-between gap-3 rounded-[var(--radius-large)] border border-[color:var(--stroke)] bg-[color:var(--surface)] px-4 py-3 shadow-[var(--shadow-soft)]"
      >
        <div>
          <p className="text-[15px] font-extrabold leading-tight">
            {deliveryCount > 0 ? `${deliveryCount} доставок` : 'рассчитываем…'}
          </p>
          <p className="mt-0.5 text-[12px] text-[color:var(--muted)]">{periodLabel(periodDays)} · {personCount} перс.</p>
        </div>
        <span className="rounded-full bg-[color:var(--text)] px-2.5 py-1 text-[11px] font-bold text-[color:var(--surface)]">
          {lines.length} блюд
        </span>
      </div>

      <SubscriptionRationByDay
        lines={lines}
        dishes={dishes}
        selectedDays={selectedDays}
        subConfig={subConfig}
        onRemoveLine={onRemoveLine}
        onUpdateQty={onUpdateQty}
        onLineModifiers={onLineModifiers}
        onAddMore={onAddMore}
      />

      <section className="mb-5">
        <h3 className="mb-3 text-[14px] font-extrabold">дни доставки</h3>
        {daysLocked ? (
          <p className="rounded-[var(--radius-medium)] border border-[color:var(--stroke)] bg-[color:var(--surface)] px-3 py-2.5 text-[14px] font-semibold">
            {deliveryDaysLabel}
            <button type="button" onClick={onGoBuild} className="mt-1 block text-[11px] font-bold text-[color:var(--muted)] underline-offset-2 hover:underline">
              изменить дни и блюда
            </button>
          </p>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-1.5">
              {WEEKDAYS.map((label, idx) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => onToggleDay(idx)}
                  className={cn(
                    'flex aspect-square max-h-11 items-center justify-center rounded-full text-[12px] font-semibold transition active:scale-[0.96]',
                    selectedDays.includes(idx)
                      ? 'bg-[color:var(--text)] text-[color:var(--surface)]'
                      : 'border border-[color:var(--stroke)]'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-[color:var(--muted)]">
              от {minDays} до {maxDays} дней в неделю
            </p>
          </>
        )}

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-[color:var(--stroke)] pt-3">
          <span className="text-[13px] font-semibold text-[color:var(--muted)]">время</span>
          <select
            value={deliveryTime}
            onChange={(e) => onDeliveryTime(e.target.value)}
            className="rounded-[var(--radius-medium)] border border-[color:var(--stroke)] bg-transparent px-3 py-2 text-[13px] font-semibold"
          >
            <option value="13:00">13:00 – 14:00</option>
            <option value="18:00">18:00 – 19:00</option>
          </select>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-[13px] font-semibold text-[color:var(--muted)]">старт</span>
          <input
            type="date"
            value={startDate.toISOString().slice(0, 10)}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => {
              const d = new Date(`${e.target.value}T12:00:00`)
              if (!Number.isNaN(d.getTime())) onStartDate(d)
            }}
            className="rounded-[var(--radius-medium)] border border-[color:var(--stroke)] bg-transparent px-2 py-1.5 text-[13px] font-semibold tabular-nums"
          />
        </div>

        <div
          className="mt-3 rounded-[var(--radius-medium)] border border-[color:var(--stroke)] bg-[color:var(--surface)] px-3 py-2.5 text-[13px] font-medium text-[color:var(--text)]"
        >
          {formatFirstDeliveryMessage(startDate, selectedDays, deliveryTime)}
        </div>
      </section>

      <section className="mb-5 overflow-visible">
        <h3 className="mb-3 text-[14px] font-extrabold">период подписки</h3>
        <SubscriptionPeriodCards
          config={subConfig}
          periods={periods}
          quotesByPeriod={quotesByPeriod}
          selectedPeriodDays={periodDays}
          onSelect={onPeriodDays}
        />
        {deliveryCount > 0 ? (
          <p className="mt-2 text-[11px] leading-snug text-[color:var(--muted)]">
            {deliveryCount} {deliveryCount === 1 ? 'доставка' : deliveryCount < 5 ? 'доставки' : 'доставок'} за{' '}
            {periodLabelAccusative(periodDays)} — в каждую тот же рацион
          </p>
        ) : null}
      </section>

      <section className="mb-5">
        <h3 className="mb-3 text-[14px] font-extrabold">персоны</h3>
        <div className="inline-flex items-center gap-3 rounded-[var(--radius-large)] border border-[color:var(--stroke)] px-4 py-2.5">
          <button type="button" className="btn btn-soft h-9 w-9 rounded-full text-[18px]" onClick={() => onPersonCount(-1)}>
            −
          </button>
          <span className="min-w-[2ch] text-center text-[18px] font-extrabold tabular-nums">{personCount}</span>
          <button type="button" className="btn btn-soft h-9 w-9 rounded-full text-[18px]" onClick={() => onPersonCount(1)}>
            +
          </button>
        </div>
      </section>

      <section className="mb-5 rounded-[var(--radius-large)] border border-[color:var(--stroke)] bg-[color:var(--surface)] px-4 py-3">
        <ul className="space-y-2 text-[13px]">
          <li className="flex justify-between gap-3">
            <span className="text-[color:var(--muted)]">блюда</span>
            <span className="font-semibold">{lines.length} поз.</span>
          </li>
          <li className="flex justify-between gap-3">
            <span className="text-[color:var(--muted)]">дни</span>
            <span className="text-right font-semibold">{deliveryDaysLabel || '—'}</span>
          </li>
          <li className="flex justify-between gap-3">
            <span className="text-[color:var(--muted)]">время</span>
            <span className="font-semibold">{deliveryTime}</span>
          </li>
          <li className="flex justify-between gap-3">
            <span className="text-[color:var(--muted)]">период</span>
            <span className="font-semibold">
              {periodLabel(periodDays)} ({deliveryCount} доставок)
            </span>
          </li>
          <li className="flex justify-between gap-3">
            <span className="text-[color:var(--muted)]">персоны</span>
            <span className="font-semibold">{personCount}</span>
          </li>
        </ul>
      </section>

      <section className="mb-4 border-b border-[color:var(--stroke)] pb-3">
        <div className="flex items-center justify-between border-b border-[color:var(--stroke)] py-2.5">
          <span className="ui-muted shrink-0">имя</span>
          <input
            type="text"
            value={name}
            onChange={(e) => onName(e.target.value)}
            placeholder="как к вам обращаться"
            className="ui-body ml-3 w-[65%] border-none bg-transparent p-0 text-right outline-none placeholder:text-[color:var(--muted)]"
          />
        </div>
        <div className="flex items-center justify-between py-2.5">
          <span className="ui-muted shrink-0">telegram</span>
          <span className="ui-body ml-3 text-right text-[14px] font-semibold">{telegramContact || 'из mini app'}</span>
        </div>
      </section>

      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">итого за период</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-2">
            <span className="text-[28px] font-extrabold tabular-nums leading-none">{formatPrice(totalPrice)}</span>
            {retailPrice > totalPrice ? (
              <span className="text-[14px] line-through text-[color:var(--muted)] tabular-nums">{formatPrice(retailPrice)}</span>
            ) : null}
            {savingsBadge ? (
              <span className="rounded-full bg-[color:var(--accent)]/15 px-2 py-0.5 text-[11px] font-bold text-[color:var(--text)]">
                {savingsBadge}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <p className="text-[12px] text-[color:var(--muted)]">Доставка включена в стоимость подписки.</p>
      <p className="mt-2 text-[12px] text-[color:var(--muted)]">
        Заведение проверит рацион и подтвердит подписку в Telegram.
      </p>

      <div aria-hidden className="h-4 shrink-0" />

      <div
        className="fixed left-0 right-0 z-[115] border-t border-[color:var(--stroke)] bg-[color:var(--surface-strong)]/98 px-4 pt-3 shadow-[0_-8px_24px_rgba(0,0,0,0.06)] backdrop-blur-md"
        style={{
          bottom: 'calc(var(--ufo-bottomnav-h, 72px) + env(safe-area-inset-bottom))',
          paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        }}
      >
        <button
          type="button"
          disabled={!canSubmit || submitting}
          onClick={onSubmit}
          className="btn btn-primary h-12 w-full text-[16px] font-bold disabled:opacity-50"
          style={{ borderRadius: 'var(--radius-pill)' }}
        >
          {submitting ? '…' : resumeId ? `сохранить · ${formatPrice(totalPrice)}` : `оформить · ${formatPrice(totalPrice)}`}
        </button>
        <p className="mt-2 text-center text-[11px] text-[color:var(--muted)]">🔒 без скрытых платежей</p>
      </div>
    </main>
  )
}
