'use client'

import Link from 'next/link'
import { formatGuestPeriodBadge } from '@/lib/subscription-offer-labels'
import type { SubscriptionConfig } from '@/lib/subscription-config'
import { defaultSubscriptionConfig } from '@/lib/subscription-config'

type Props = {
  config?: SubscriptionConfig | null
  loading?: boolean
}

export function SubscriptionGuestHub({ config, loading }: Props) {
  const cfg = config ?? defaultSubscriptionConfig()
  const badge = formatGuestPeriodBadge(cfg.commerce, cfg.periodDiscounts, cfg.defaultPeriodDays ?? 28)

  return (
    <div className="space-y-4">
      <section
        className="overflow-hidden rounded-[var(--radius-large)] border border-[color:var(--stroke)] p-5"
        style={{
          background:
            'linear-gradient(165deg, color-mix(in srgb, var(--primary) 12%, var(--surface-strong)) 0%, var(--surface-strong) 55%)',
        }}
      >
        <p className="text-[11px] font-bold uppercase tracking-wide text-[color:var(--muted)]">доставка по подписке</p>
        <h2 className="mt-2 text-[22px] font-extrabold leading-tight tracking-tight">готовый рацион на ваши дни</h2>
        <p className="mt-2 text-[14px] leading-snug text-[color:var(--muted)]">
          Выберите дни недели, соберите меню на каждый день — заведение привозит по расписанию. Без ежедневного заказа вручную.
        </p>
        {badge ? (
          <p className="mt-3 inline-flex rounded-full bg-[color:var(--accent)]/15 px-3 py-1 text-[12px] font-bold text-[color:var(--text)]">
            подписка от {badge}
          </p>
        ) : null}
      </section>

      <ul className="grid gap-2 text-[13px]">
        {[
          ['1', 'дни', 'когда привозить (Пн–Пт или свои)'],
          ['2', 'меню', 'на каждый день — завтрак, обед, ужин'],
          ['3', 'оплата', 'период и итог — заведение подтвердит в Telegram'],
        ].map(([n, title, desc]) => (
          <li
            key={n}
            className="flex gap-3 rounded-[var(--radius-medium)] border border-[color:var(--stroke)] bg-[color:var(--surface)] px-3 py-3"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color:var(--text)] text-[12px] font-extrabold text-[color:var(--surface)]">
              {n}
            </span>
            <div>
              <p className="font-bold">{title}</p>
              <p className="text-[12px] text-[color:var(--muted)]">{desc}</p>
            </div>
          </li>
        ))}
      </ul>

      <Link
        href="/subscriptions/new"
        prefetch={false}
        scroll={false}
        className="btn btn-primary flex h-12 w-full items-center justify-center rounded-full text-[15px] font-bold disabled:opacity-50"
        style={{ borderRadius: 'var(--radius-pill)' }}
        aria-disabled={loading}
      >
        {loading ? 'загрузка…' : 'собрать подписку'}
      </Link>

      <p className="text-center text-[11px] text-[color:var(--muted)]">оформление откроется отдельно — здесь останутся ваши подписки</p>
    </div>
  )
}
