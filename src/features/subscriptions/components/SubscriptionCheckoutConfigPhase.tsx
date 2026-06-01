'use client'

import type { Dish } from '@/types'
import { cn, formatPrice } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { InlineCounter } from '@/components/ui/InlineCounter'
import { IMAGE_SIZES, OptimizedImage } from '@/components/ui/OptimizedImage'
import { periodLabel, type SubscriptionConfig } from '@/lib/subscription-config'
import { formatGuestPeriodBadge } from '@/lib/subscription-offer-labels'
import { SubscriptionDishOptionsPanel } from '@/features/subscriptions/components/SubscriptionDishOptionsPanel'
import {
  WEEKDAYS,
  allowedOptionIdsForLine,
  type PeriodQuote,
  type SelectedLine,
  formatFirstDeliveryMessage,
  lineKey,
  mealSlotShort,
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
  onBack: () => void
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
  onBack,
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
  const savingsPct = activeQuote?.guestSavingsPercent ?? 0
  const deliveryCount = activeQuote?.deliveriesInPeriod ?? 0
  const canSubmit = Boolean(name.trim()) && lines.length > 0 && selectedDays.length >= minDays

  const deliveryDaysLabel = selectedDays.map((d) => WEEKDAYS[d]).join(', ')
  const periods = subConfig.availablePeriods ?? [7, 14, 28]

  return (
    <main className="ui-container ui-screen pb-[calc(var(--ufo-bottomnav-h,72px)+env(safe-area-inset-bottom)+120px)]">
      <div className="flex items-start gap-2">
        <button type="button" onClick={onBack} className="ui-back-button mt-1 shrink-0" aria-label="назад">
          <IconChevronLeft className="h-5 w-5" />
        </button>
        <PageHeader title="оформление подписки" subtitle="настройте доставку и период" compact className="min-w-0 flex-1" />
      </div>

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

      <section className="mb-5">
        <h3 className="mb-3 text-[14px] font-extrabold">ваш рацион</h3>
        <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {lines.map((l) => {
            const dish = dishes.find((d) => d.id === l.dishId)
            if (!dish) return null
            return (
              <div
                key={lineKey(l)}
                className="relative w-[88px] shrink-0 overflow-hidden rounded-[var(--radius-medium)] border border-[color:var(--stroke)] bg-[color:var(--surface)]"
              >
                <div className="relative aspect-square w-full bg-black/[0.04]">
                  {dish.image ? (
                    <OptimizedImage src={dish.image} alt="" className="object-cover" sizes={IMAGE_SIZES.checkoutThumb} />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onRemoveLine(l)}
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-[11px] font-bold text-white"
                    aria-label="убрать"
                  >
                    ×
                  </button>
                  {l.quantity > 1 ? (
                    <span className="absolute bottom-1 right-1 rounded-full bg-[color:var(--text)] px-1.5 py-0.5 text-[10px] font-bold text-[color:var(--surface)]">
                      ×{l.quantity}
                    </span>
                  ) : null}
                </div>
                <p className="truncate px-1.5 py-1.5 text-[10px] font-semibold">{dish.name}</p>
              </div>
            )
          })}
          <button
            type="button"
            onClick={onAddMore}
            className="flex w-[88px] shrink-0 flex-col items-center justify-center rounded-[var(--radius-medium)] border border-dashed border-[color:var(--stroke)] bg-[color:var(--surface)] text-[color:var(--muted)]"
          >
            <span className="text-[24px] font-light leading-none">+</span>
            <span className="mt-1 text-[10px] font-semibold">ещё</span>
          </button>
        </div>

        <ul className="mt-3 space-y-0 divide-y divide-[color:var(--stroke)] rounded-[var(--radius-medium)] border border-[color:var(--stroke)]">
          {lines.map((l) => {
            const dish = dishes.find((d) => d.id === l.dishId)
            if (!dish) return null
            return (
              <li key={lineKey(l)} className="px-3 py-3">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold">{dish.name}</p>
                    <p className="text-[11px] text-[color:var(--muted)]">{mealSlotShort(l.mealSlot)}</p>
                  </div>
                  <InlineCounter value={l.quantity} onDec={() => onUpdateQty(l, -1)} onInc={() => onUpdateQty(l, 1)} />
                </div>
                <SubscriptionDishOptionsPanel
                  dish={dish}
                  modifierIds={l.modifierIds ?? []}
                  allowedOptionIds={allowedOptionIdsForLine(subConfig, l.mealSlot)}
                  onChange={(ids) => onLineModifiers(l, ids)}
                />
              </li>
            )
          })}
        </ul>
      </section>

      <section className="mb-5">
        <h3 className="mb-3 text-[14px] font-extrabold">дни доставки</h3>
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

      <section className="mb-5">
        <h3 className="mb-3 text-[14px] font-extrabold">период подписки</h3>
        <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {periods.map((d) => {
            const q = quotesByPeriod[d]
            const badge = formatGuestPeriodBadge(subConfig.commerce, subConfig.periodDiscounts, d)
            const sel = periodDays === d
            return (
              <button
                key={d}
                type="button"
                onClick={() => onPeriodDays(d)}
                className={cn(
                  'relative flex w-[120px] shrink-0 flex-col rounded-[var(--radius-large)] border px-3 py-3 text-left transition',
                  sel ? 'border-[color:var(--text)] bg-[color:var(--text)] text-[color:var(--surface)]' : 'border-[color:var(--stroke)] bg-[color:var(--surface)]'
                )}
              >
                {badge ? (
                  <span className="absolute -right-1 -top-1 rounded-full bg-[color:var(--accent)] px-1.5 py-0.5 text-[9px] font-bold text-white">
                    {badge}
                  </span>
                ) : null}
                <span className="text-[14px] font-extrabold">{periodLabel(d)}</span>
                <span className="mt-1 text-[11px] opacity-80">{d} дн.</span>
                {q ? (
                  <div className="mt-2">
                    <span className="text-[15px] font-extrabold tabular-nums">{formatPrice(q.guestPrice)}</span>
                    {q.periodRetail > q.guestPrice ? (
                      <span className="ml-1 text-[11px] line-through opacity-60 tabular-nums">{formatPrice(q.periodRetail)}</span>
                    ) : null}
                  </div>
                ) : (
                  <span className="mt-2 text-[11px] opacity-60">…</span>
                )}
              </button>
            )
          })}
        </div>
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
            {savingsPct > 0 ? (
              <span className="rounded-full bg-[color:var(--accent)]/15 px-2 py-0.5 text-[11px] font-bold text-[color:var(--text)]">
                −{Math.round(savingsPct)}%
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <p className="text-[12px] text-[color:var(--muted)]">Доставка включена в стоимость подписки.</p>
      <p className="mt-2 text-[12px] text-[color:var(--muted)]">
        Заведение проверит рацион и подтвердит подписку в Telegram.
      </p>

      <div
        className="fixed left-0 right-0 z-[115] border-t border-[color:var(--stroke)] bg-[color:var(--surface-strong)]/95 px-4 py-3 backdrop-blur-md"
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
