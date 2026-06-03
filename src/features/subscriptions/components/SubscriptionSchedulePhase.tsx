'use client'

import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { SubscriptionFlowProgress } from '@/features/subscriptions/components/SubscriptionFlowProgress'
import { WEEKDAYS } from '@/features/subscriptions/lib/subscription-checkout-utils'
import { IconChevronUp } from '@/components/ui/icons'

type Props = {
  selectedDays: number[]
  minDays: number
  maxDays: number
  onToggleDay: (wizardDay: number) => void
  onContinue: () => void
}

export function SubscriptionSchedulePhase({ selectedDays, minDays, maxDays, onToggleDay, onContinue }: Props) {
  const canContinue = selectedDays.length >= minDays

  return (
    <main className="ui-container ui-screen pb-[calc(var(--ufo-bottomnav-h,72px)+env(safe-area-inset-bottom)+96px)]">
      <PageHeader backHref="/subscriptions" title="новая подписка" subtitle="шаг 1 · дни доставки" />

      <SubscriptionFlowProgress step="schedule" />

      <p className="mb-4 rounded-[var(--radius-large)] border border-[color:var(--stroke)] bg-[color:var(--surface)] px-3 py-3 text-[13px] leading-snug text-[color:var(--text)]">
        Выберите <span className="font-bold">дни недели</span>, когда нужна доставка. На следующем шаге для{' '}
        <span className="font-bold">каждого дня</span> соберёте завтрак, обед или ужин — можно по-разному.
      </p>

      <section className="mb-4">
        <h2 className="mb-3 text-[15px] font-extrabold">дни доставки</h2>
        <div className="grid grid-cols-7 gap-2">
          {WEEKDAYS.map((label, idx) => {
            const on = selectedDays.includes(idx)
            return (
              <button
                key={label}
                type="button"
                onClick={() => onToggleDay(idx)}
                className={cn(
                  'flex aspect-square max-h-12 items-center justify-center rounded-full text-[13px] font-bold transition active:scale-[0.96]',
                  on ? 'bg-[color:var(--text)] text-[color:var(--surface)]' : 'border-2 border-[color:var(--stroke)]'
                )}
              >
                {label}
              </button>
            )
          })}
        </div>
        <p className="mt-3 text-[12px] text-[color:var(--muted)]">
          выбрано {selectedDays.length} · нужно от {minDays} до {maxDays}
        </p>
      </section>

      <div
        className="fixed left-0 right-0 z-[110] px-3"
        style={{ bottom: 'calc(var(--ufo-bottomnav-h, 72px) + env(safe-area-inset-bottom) + 8px)' }}
      >
        <div className="ui-sticky-sheet flex items-center gap-3 p-3">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-extrabold">
              {canContinue ? `${selectedDays.length} дн. в неделю` : `ещё ${Math.max(0, minDays - selectedDays.length)} дн.`}
            </p>
            <p className="text-[11px] font-semibold text-[color:var(--muted)]">далее — меню на каждый день</p>
          </div>
          <button
            type="button"
            onClick={onContinue}
            disabled={!canContinue}
            className="btn btn-primary inline-flex h-11 shrink-0 items-center gap-1 rounded-full px-5 text-[14px] font-bold disabled:opacity-40"
          >
            меню по дням
            <IconChevronUp className="h-4 w-4 rotate-90" />
          </button>
        </div>
      </div>
    </main>
  )
}
