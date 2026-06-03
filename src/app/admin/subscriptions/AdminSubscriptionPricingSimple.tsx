'use client'

import { useMemo } from 'react'
import { cn, formatPrice } from '@/lib/utils'
import { periodLabel, type SubscriptionConfig } from '@/lib/subscription-config'
import { formatGuestPeriodBadge } from '@/lib/subscription-offer-labels'
import type { CatalogProduct } from './AdminSubscriptionDashboard'
import {
  monthBonusFromPeriodDiscounts,
  periodDiscountsFromMonthBonus,
  previewOneDeliveryPrice,
  verdictStyles,
} from '@/lib/subscription-commerce-preview'

type Props = {
  config: SubscriptionConfig
  exampleDish: CatalogProduct | null
  missingCostCount: number
  onPatchConfig: (next: SubscriptionConfig) => void
  onOpenCostSheet?: () => void
}

export function AdminSubscriptionPricingSimple({
  config,
  exampleDish,
  missingCostCount,
  onPatchConfig,
  onOpenCostSheet,
}: Props) {
  const preview = useMemo(() => {
    if (!exampleDish) return null
    return previewOneDeliveryPrice(exampleDish.price, exampleDish.costPrice, config.commerce)
  }, [exampleDish, config.commerce])

  const monthBonus = monthBonusFromPeriodDiscounts(config.periodDiscounts)
  const styles = preview ? verdictStyles(preview.verdict) : verdictStyles('unknown')
  const baseDiscount = config.commerce.subscriptionDiscountPercent
  const monthBadge = formatGuestPeriodBadge(config.commerce, config.periodDiscounts, 28)

  function patchCommerce(patch: Partial<SubscriptionConfig['commerce']>) {
    onPatchConfig({ ...config, commerce: { ...config.commerce, ...patch } })
  }

  if (!exampleDish) {
    return (
      <section className="mb-4 rounded-2xl border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] p-4">
        <p className="text-[15px] font-bold">скидка подписчикам</p>
        <p className="ui-muted mt-2 text-[13px] leading-snug">
          Сначала добавьте блюда в слот выше — покажем пример на одном блюде.
        </p>
      </section>
    )
  }

  return (
    <section className="mb-4 rounded-2xl border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] p-4">
      <p className="text-[15px] font-bold">скидка подписчикам</p>
      <p className="ui-muted mt-2 text-[13px] leading-snug">
        Вы задаёте только <span className="font-semibold text-[color:var(--text)]">процент скидки от цены в меню</span>.
        Полную сумму подписки гость увидит сам — когда соберёт рацион и выберет дни.
      </p>

      <div className="mt-4 rounded-xl border border-[color:var(--stroke)] bg-[color:var(--surface)] p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">пример · {exampleDish.name}</p>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-[14px] text-[color:var(--muted)] line-through tabular-nums">{formatPrice(preview?.retail ?? exampleDish.price)}</span>
          <span className="text-[color:var(--muted)]">→</span>
          <span className="text-[22px] font-extrabold tabular-nums text-[color:var(--primary)]">
            {formatPrice(preview?.guest ?? exampleDish.price)}
          </span>
          <span className="text-[12px] font-semibold text-[color:var(--muted)]">в подписке за это блюдо</span>
        </div>

        {preview?.hasCost && preview.profit != null ? (
          <p className="mt-2 text-[12px] text-[color:var(--muted)]">
            Себестоимость учтена: на этом блюде вы примерно{' '}
            <span className="font-semibold text-[color:var(--text)]">+{formatPrice(preview.profit)}</span>
          </p>
        ) : null}

        <div className={cn('mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-[12px] leading-snug', styles.wrap)}>
          <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', styles.dot)} />
          {preview?.verdict === 'unknown' && missingCostCount > 0 && onOpenCostSheet ? (
            <button type="button" onClick={onOpenCostSheet} className="text-left underline decoration-dotted underline-offset-2">
              {preview.verdictLabel}
            </button>
          ) : (
            <span>{preview?.verdictLabel ?? '—'}</span>
          )}
        </div>
      </div>

      {missingCostCount > 0 ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] leading-snug text-amber-900">
          <p>
            {missingCostCount} блюд в каталоге без себестоимости — подсказка «норм / мало» неполная.
          </p>
          {onOpenCostSheet ? (
            <button
              type="button"
              onClick={onOpenCostSheet}
              className="mt-2 w-full rounded-full bg-amber-900 px-4 py-2 text-[13px] font-semibold text-white active:opacity-90"
            >
              добавить себестоимость
            </button>
          ) : null}
          <p className="mt-2 text-[11px] text-amber-800/90">Необязательно — подписка работает и без этого.</p>
        </div>
      ) : null}

      <label className="mt-5 block">
        <div className="mb-2 flex justify-between text-[14px] font-bold">
          <span>дешевле меню на</span>
          <span className="tabular-nums text-[color:var(--primary)]">−{baseDiscount}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={30}
          step={1}
          value={baseDiscount}
          onChange={(e) => patchCommerce({ subscriptionDiscountPercent: Number(e.target.value) })}
          className="h-2.5 w-full accent-[color:var(--primary)]"
        />
      </label>

      <label className="mt-5 block">
        <div className="mb-2 flex justify-between text-[14px] font-bold">
          <span>ещё дешевле за {periodLabel(28).toLowerCase()}</span>
          <span className="tabular-nums text-[color:var(--primary)]">+{monthBonus}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={15}
          step={1}
          value={monthBonus}
          onChange={(e) =>
            onPatchConfig({ ...config, periodDiscounts: periodDiscountsFromMonthBonus(Number(e.target.value)) })
          }
          className="h-2.5 w-full accent-[color:var(--primary)]"
        />
        {monthBonus > 0 ? (
          <p className="ui-muted mt-2 text-[12px] leading-snug">
            Бонус за длину периода: <span className="font-bold">2 нед.</span> ≈ −{Math.round(monthBonus * 0.5)}%,{' '}
            <span className="font-bold">1 мес.</span> ≈ −{monthBonus}% (плюс база −{baseDiscount}%).
          </p>
        ) : null}
      </label>

      <details className="mt-4 text-[12px] text-[color:var(--muted)]">
        <summary className="cursor-pointer font-semibold text-[color:var(--text)]">как это работает</summary>
        <ul className="mt-2 list-disc space-y-1.5 pl-4 leading-snug">
          <li>Скидка считается от цены блюда в обычном меню.</li>
          <li>Итог подписки = выбранные блюда × дни доставки × период. У каждого гостя своя сумма.</li>
          <li>Себестоимость в меню нужна только для подсказки «не продавать в убыток».</li>
        </ul>
      </details>
    </section>
  )
}
