'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { cn, formatPrice } from '@/lib/utils'
import { periodLabel, type SubscriptionConfig } from '@/lib/subscription-config'
import { formatGuestPeriodBadge } from '@/lib/subscription-offer-labels'
import { PillTabToggle } from '@/components/ui/PillTabToggle'
import type { CatalogProduct } from './AdminSubscriptionDashboard'
import {
  discountForTargetGuestPrice,
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
}

const MODES = [
  { id: 'discount', label: 'скидка %' },
  { id: 'price', label: 'своя цена' },
] as const

type Mode = (typeof MODES)[number]['id']

export function AdminSubscriptionPricingSimple({ config, exampleDish, missingCostCount, onPatchConfig }: Props) {
  const [mode, setMode] = useState<Mode>('discount')
  const [customPrice, setCustomPrice] = useState('')

  const preview = useMemo(() => {
    if (!exampleDish) return null
    return previewOneDeliveryPrice(exampleDish.price, exampleDish.costPrice, config.commerce)
  }, [exampleDish, config.commerce])

  const customPreview = useMemo(() => {
    if (!exampleDish || mode !== 'price') return null
    const target = Number(customPrice.replace(/\s/g, ''))
    if (!Number.isFinite(target) || target <= 0) return null
    return discountForTargetGuestPrice(exampleDish.price, exampleDish.costPrice, target, config.commerce)
  }, [exampleDish, customPrice, config.commerce, mode])

  const monthBonus = monthBonusFromPeriodDiscounts(config.periodDiscounts)
  const styles = preview ? verdictStyles(preview.verdict) : verdictStyles('unknown')

  function patchCommerce(patch: Partial<SubscriptionConfig['commerce']>) {
    onPatchConfig({ ...config, commerce: { ...config.commerce, ...patch } })
  }

  function applyCustomPrice() {
    if (!customPreview) return
    onPatchConfig({
      ...config,
      commerce: { ...config.commerce, subscriptionDiscountPercent: customPreview.discountPercent },
    })
    setMode('discount')
  }

  if (!exampleDish) {
    return (
      <section className="mb-4 rounded-2xl border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] p-4">
        <p className="text-[13px] font-bold">цена подписки</p>
        <p className="ui-muted mt-2 text-[12px]">Добавьте блюда в слот — покажем пример расчёта.</p>
      </section>
    )
  }

  return (
    <section className="mb-4 rounded-2xl border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] p-4">
      <p className="text-[13px] font-bold">цена подписки</p>
      <p className="ui-muted mt-1 text-[12px]">Пример на «{exampleDish.name}». У каждого гостя сумма своя.</p>

      {preview ? (
        <div className="mt-3 rounded-xl border border-[color:var(--stroke)] bg-[color:var(--surface)] p-3">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <p className="text-[11px] text-[color:var(--muted)]">меню</p>
              <p className="text-[15px] font-bold tabular-nums line-through text-[color:var(--muted)]">
                {formatPrice(preview.retail)}
              </p>
            </div>
            <div className="text-[20px] text-[color:var(--muted)]">→</div>
            <div className="text-right">
              <p className="text-[11px] text-[color:var(--muted)]">подписка / доставка</p>
              <p className="text-[26px] font-extrabold tabular-nums text-[color:var(--primary)]">
                {formatPrice(preview.guest)}
              </p>
            </div>
          </div>
          {preview.profit != null ? (
            <p className="mt-2 text-[12px] font-semibold tabular-nums">
              ваш заработок {formatPrice(preview.profit)}
              {preview.marginPercent != null ? ` · ${Math.round(preview.marginPercent)}%` : ''}
            </p>
          ) : null}
          <div className={cn('mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-[12px] font-medium', styles.wrap)}>
            <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', styles.dot)} />
            <span>{preview.verdictLabel}</span>
          </div>
        </div>
      ) : null}

      {missingCostCount > 0 ? (
        <p className="mt-2 text-[12px] text-amber-700">
          {missingCostCount} блюд без себестоимости —{' '}
          <Link href="/admin/menu" className="font-semibold underline">
            заполнить в меню
          </Link>
        </p>
      ) : null}

      <div className="mt-4">
        <PillTabToggle
          className="w-full"
          options={MODES.map((m) => ({ id: m.id, label: m.label }))}
          value={mode}
          onChange={(v) => setMode(v as Mode)}
        />
      </div>

      {mode === 'discount' ? (
        <label className="mt-4 block">
          <div className="mb-2 flex justify-between text-[13px] font-semibold">
            <span>скидка подписчикам</span>
            <span className="tabular-nums text-[color:var(--primary)]">−{config.commerce.subscriptionDiscountPercent}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={30}
            step={1}
            value={config.commerce.subscriptionDiscountPercent}
            onChange={(e) => patchCommerce({ subscriptionDiscountPercent: Number(e.target.value) })}
            className="h-2 w-full accent-[color:var(--primary)]"
          />
          <p className="ui-muted mt-2 text-[11px]">Двигаете ползунок — сразу видите цену и «норм / нет».</p>
        </label>
      ) : (
        <div className="mt-4">
          <label className="block text-[13px] font-semibold">хочу ~за одну доставку</label>
          <div className="mt-2 flex gap-2">
            <input
              type="number"
              inputMode="numeric"
              placeholder={preview ? String(preview.guest) : '380'}
              value={customPrice}
              onChange={(e) => setCustomPrice(e.target.value)}
              className="h-11 flex-1 rounded-[var(--radius-medium)] border border-[color:var(--stroke)] bg-transparent px-3 text-[16px] font-bold tabular-nums"
            />
          </div>
          {customPreview ? (
            <div className="mt-3 space-y-2 text-[12px]">
              <p>
                Это примерно <span className="font-bold">−{customPreview.discountPercent}%</span> от меню →{' '}
                <span className="font-bold tabular-nums">{formatPrice(customPreview.preview.guest)}</span>
              </p>
              {customPreview.preview.minGuest != null && Number(customPrice) < customPreview.preview.minGuest ? (
                <p className="text-amber-800">
                  Минимум по себестоимости: {formatPrice(customPreview.preview.minGuest)}
                </p>
              ) : null}
              <button
                type="button"
                onClick={applyCustomPrice}
                className="btn btn-soft h-10 w-full rounded-full text-[13px] font-bold"
              >
                применить скидку −{customPreview.discountPercent}%
              </button>
            </div>
          ) : (
            <p className="ui-muted mt-2 text-[11px]">Введите сумму — подскажем, нормальная ли цена.</p>
          )}
        </div>
      )}

      <label className="mt-5 block">
        <div className="mb-2 flex justify-between text-[13px] font-semibold">
          <span>бонус за месяц</span>
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
          className="h-2 w-full accent-[color:var(--primary)]"
        />
        <p className="ui-muted mt-2 text-[11px]">
          Гость видит бейдж{' '}
          {formatGuestPeriodBadge(config.commerce, config.periodDiscounts, 28)
            ? formatGuestPeriodBadge(config.commerce, config.periodDiscounts, 28)
            : '−X%'}{' '}
          на карточке «{periodLabel(28)}».
        </p>
      </label>
    </section>
  )
}
