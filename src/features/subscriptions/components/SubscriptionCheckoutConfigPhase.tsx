'use client'

import type { Dish } from '@/types'
import { formatPrice } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { periodLabel, type SubscriptionConfig } from '@/lib/subscription-config'
import { SubscriptionCheckoutSavingsBar } from '@/features/subscriptions/components/SubscriptionCheckoutSavingsBar'
import { SubscriptionSavingsStrip } from '@/features/subscriptions/components/SubscriptionSavingsStrip'
import type { MealSlot } from '@/lib/subscription-meal-slots'
import { SubscriptionFlowProgress } from '@/features/subscriptions/components/SubscriptionFlowProgress'
import { SubscriptionPeriodCards } from '@/features/subscriptions/components/SubscriptionPeriodCards'
import { SubscriptionRationByDay } from '@/features/subscriptions/components/SubscriptionRationByDay'
import {
  WEEKDAYS,
  formatFirstDeliveryMessage,
  formatRationCheckoutSummary,
  formatStartDateRu,
  type PeriodQuote,
  type SelectedLine,
} from '@/features/subscriptions/lib/subscription-checkout-utils'
import { IconChevronLeft } from '@/components/ui/icons'

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

export function SubscriptionCheckoutConfigPhase({
  resumeId,
  lines,
  dishes,
  selectedDays,
  slotsByWizardDay,
  enabledSlots,
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
  submitError,
  minDays,
  onBack,
  onGoBuild,
  onPeriodDays,
  onPersonCount,
  onStartDate,
  onDeliveryTime,
  onName,
  onEditRation,
  onSubmit,
}: Props) {
  const totalPrice = activeQuote?.guestPrice ?? 0
  const retailPrice = activeQuote?.periodRetail ?? 0
  const deliveryCount = activeQuote?.deliveriesInPeriod ?? 0
  const canSubmit = Boolean(name.trim()) && lines.length > 0 && selectedDays.length >= minDays

  const deliveryDaysLabel = selectedDays.map((d) => WEEKDAYS[d]).join(', ')
  const periods = subConfig.availablePeriods ?? [7, 14, 28]
  const rationSummary = formatRationCheckoutSummary(lines, selectedDays)

  return (
    <main className="ui-container ui-screen pb-[calc(var(--ufo-bottomnav-h,72px)+env(safe-area-inset-bottom)+148px)]">
      <div className="flex items-start gap-2">
        <button type="button" onClick={onBack} className="ui-back-button mt-1 shrink-0" aria-label="назад">
          <IconChevronLeft className="h-5 w-5" />
        </button>
        <PageHeader title="оформление" subtitle="период и доставка" compact className="min-w-0 flex-1" />
      </div>

      <SubscriptionFlowProgress step="pay" onStep={(s) => s === 'build' && onGoBuild?.()} payEnabled />

      <section className="mb-4 overflow-visible">
        <h3 className="mb-2 text-[13px] font-extrabold">период</h3>
        <SubscriptionSavingsStrip quote={activeQuote} periodLabel={periodLabel(periodDays)} />
        <SubscriptionPeriodCards
          config={subConfig}
          periods={periods}
          quotesByPeriod={quotesByPeriod}
          selectedPeriodDays={periodDays}
          onSelect={onPeriodDays}
        />
      </section>

      <section className="mb-4 rounded-[var(--radius-large)] border border-[color:var(--stroke)] bg-[color:var(--surface)] px-3 py-3 shadow-[var(--shadow-soft)]">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[13px] font-extrabold">доставка</h3>
          <button type="button" onClick={onGoBuild ?? onEditRation} className="text-[12px] font-bold text-[color:var(--muted)] underline-offset-2 hover:underline">
            дни и меню
          </button>
        </div>

        <p className="mt-2 text-[14px] font-semibold leading-snug">{deliveryDaysLabel}</p>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="rounded-[var(--radius-medium)] border border-[color:var(--stroke)] px-2.5 py-2">
            <span className="block text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">время</span>
            <select
              value={deliveryTime}
              onChange={(e) => onDeliveryTime(e.target.value)}
              className="mt-0.5 w-full border-none bg-transparent p-0 text-[13px] font-semibold outline-none"
            >
              <option value="13:00">13:00 – 14:00</option>
              <option value="18:00">18:00 – 19:00</option>
            </select>
          </label>
          <label className="rounded-[var(--radius-medium)] border border-[color:var(--stroke)] px-2.5 py-2">
            <span className="block text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">старт</span>
            <p className="mt-0.5 truncate text-[13px] font-semibold">{formatStartDateRu(startDate)}</p>
            <input
              type="date"
              value={startDate.toISOString().slice(0, 10)}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => {
                const d = new Date(`${e.target.value}T12:00:00`)
                if (!Number.isNaN(d.getTime())) onStartDate(d)
              }}
              className="mt-1 w-full border-none bg-transparent p-0 text-[11px] text-[color:var(--muted)] outline-none"
              aria-label="дата старта"
            />
          </label>
        </div>

        <p className="mt-2 text-[12px] text-[color:var(--muted)]">
          {formatFirstDeliveryMessage(startDate, selectedDays, deliveryTime)}
        </p>

        <div className="mt-3 flex items-center justify-between border-t border-[color:var(--stroke)] pt-3">
          <span className="text-[13px] font-semibold">персоны</span>
          <div className="inline-flex items-center gap-2">
            <button type="button" className="btn btn-soft h-8 w-8 rounded-full text-[16px]" onClick={() => onPersonCount(-1)}>
              −
            </button>
            <span className="min-w-[2ch] text-center text-[16px] font-extrabold tabular-nums">{personCount}</span>
            <button type="button" className="btn btn-soft h-8 w-8 rounded-full text-[16px]" onClick={() => onPersonCount(1)}>
              +
            </button>
          </div>
        </div>
      </section>

      <SubscriptionRationByDay
        lines={lines}
        dishes={dishes}
        selectedDays={selectedDays}
        slotsByWizardDay={slotsByWizardDay}
        enabledSlots={enabledSlots}
        summaryLine={rationSummary}
        onEditRation={onEditRation}
      />

      <section className="mb-4 rounded-[var(--radius-large)] border border-[color:var(--stroke)] bg-[color:var(--surface)] px-3 py-1">
        <div className="flex items-center justify-between border-b border-[color:var(--stroke)] py-2.5">
          <span className="text-[13px] text-[color:var(--muted)]">имя</span>
          <input
            type="text"
            value={name}
            onChange={(e) => onName(e.target.value)}
            placeholder="как к вам обращаться"
            className="w-[60%] border-none bg-transparent p-0 text-right text-[14px] font-semibold outline-none placeholder:text-[color:var(--muted)]"
          />
        </div>
        <div className="flex items-center justify-between py-2.5">
          <span className="text-[13px] text-[color:var(--muted)]">telegram</span>
          <span className="text-right text-[14px] font-semibold">{telegramContact || 'из mini app'}</span>
        </div>
      </section>

      <div
        className="fixed inset-x-0 z-[115] border-t border-[color:var(--stroke)] bg-[color:var(--surface-strong)] shadow-[0_-12px_32px_rgba(0,0,0,0.08)]"
        style={{ bottom: 'calc(var(--ufo-bottomnav-h, 72px) + env(safe-area-inset-bottom))' }}
      >
        <div className="px-3 pb-3 pt-2">
          <SubscriptionCheckoutSavingsBar quote={activeQuote} totalPrice={totalPrice} />
          {submitError ? (
            <p className="mb-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-center text-[13px] font-semibold leading-snug text-red-700">
              {submitError}
            </p>
          ) : null}
          {submitting ? (
            <p className="mb-2 text-center text-[12px] font-semibold text-[color:var(--muted)]">отправляем заявку…</p>
          ) : null}
          <button
            type="button"
            disabled={!canSubmit || submitting}
            onClick={onSubmit}
            className="btn btn-primary h-12 w-full text-[16px] font-extrabold disabled:opacity-50"
            style={{ borderRadius: 'var(--radius-pill)' }}
          >
            {submitting ? '…' : resumeId ? `сохранить за ${formatPrice(totalPrice)}` : `оформить за ${formatPrice(totalPrice)}`}
          </button>
          <p className="mt-1.5 text-center text-[10px] text-[color:var(--muted)]">без скрытых платежей · подтверждение в Telegram</p>
        </div>
      </div>
    </main>
  )
}
