'use client'

import { cn, formatPrice } from '@/lib/utils'
import { SubscriptionWizardStep } from '@/lib/subscription-rules'

type Props = {
  step: SubscriptionWizardStep
  selectedDaysCount: number
  deliveriesPerMonth: number
  perDelivery: number
  perWeek: number
  /** Оценка «в розницу» за месяц (сумма цен блюд × доставок) */
  retailPerMonth?: number
  /** Цена по подписке в месяц (план или расчёт) */
  subscriptionPerMonth?: number
  hasTemplate: boolean
  dishCount: number
}

/**
 * Липкая «стеклянная» панель итогов конструктора подписки (над нижней навигацией).
 */
export function SubscriptionConstructorSummaryBar({
  step,
  selectedDaysCount,
  deliveriesPerMonth,
  perDelivery,
  perWeek,
  retailPerMonth = 0,
  subscriptionPerMonth = 0,
  hasTemplate,
  dishCount,
}: Props) {
  const showOnSteps =
    step === SubscriptionWizardStep.SelectDays || step === SubscriptionWizardStep.AdjustDishesWithinLimits
  if (!showOnSteps) return null

  const savingsPercent =
    retailPerMonth > 0 && subscriptionPerMonth > 0 && retailPerMonth > subscriptionPerMonth
      ? Math.round(((retailPerMonth - subscriptionPerMonth) / retailPerMonth) * 100)
      : 0

  return (
    <div
      className="fixed left-0 right-0 z-40 px-3"
      style={{
        bottom: 'calc(var(--ufo-bottomnav-h, 72px) + env(safe-area-inset-bottom))',
        paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
      }}
      role="region"
      aria-label="итог рациона"
    >
      <div className={cn('ui-sticky-sheet px-3 py-2.5')}>
      {step === SubscriptionWizardStep.SelectDays ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
          <span className="text-[color:var(--muted)]">
            дней: <span className="font-semibold tabular-nums text-[color:var(--text)]">{selectedDaysCount}</span>
          </span>
          <span className="text-[color:var(--muted)]">
            ~доставок/мес:{' '}
            <span className="font-semibold tabular-nums text-[color:var(--text)]">{deliveriesPerMonth}</span>
          </span>
          {hasTemplate ? (
            <span className="text-[color:var(--muted)]">
              по плану:{' '}
              <span className="font-semibold tabular-nums text-[color:var(--text)]">{formatPrice(subscriptionPerMonth)}</span>
              <span className="font-medium">/мес</span>
            </span>
          ) : null}
        </div>
      ) : (
        <div className="space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
            <span className="text-[color:var(--muted)]">
              за доставку:{' '}
              <span className="font-semibold tabular-nums text-[color:var(--text)]">
                {dishCount > 0 ? formatPrice(perDelivery) : '—'}
              </span>
            </span>
            <span className="text-[color:var(--muted)]">
              ~в неделю:{' '}
              <span className="font-semibold tabular-nums text-[color:var(--text)]">
                {dishCount > 0 ? formatPrice(perWeek) : '—'}
              </span>
            </span>
            {savingsPercent > 0 && hasTemplate ? (
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{
                  background: 'color-mix(in srgb, var(--accent) 14%, transparent)',
                  color: 'var(--text)',
                  borderRadius: 'var(--radius-pill)',
                }}
              >
                −{savingsPercent}% к рознице
              </span>
            ) : null}
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
