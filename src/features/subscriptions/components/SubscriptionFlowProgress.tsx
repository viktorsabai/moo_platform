'use client'

import { cn } from '@/lib/utils'

export type SubscriptionFlowStep = 'schedule' | 'fill' | 'pay'

type Props = {
  step: SubscriptionFlowStep
}

const STEPS: { id: SubscriptionFlowStep; label: string }[] = [
  { id: 'schedule', label: 'дни' },
  { id: 'fill', label: 'меню' },
  { id: 'pay', label: 'оплата' },
]

export function SubscriptionFlowProgress({ step }: Props) {
  const idx = STEPS.findIndex((s) => s.id === step)
  return (
    <div className="mb-4 flex items-center gap-1">
      {STEPS.map((s, i) => {
        const done = i < idx
        const current = i === idx
        return (
          <div key={s.id} className="flex min-w-0 flex-1 items-center gap-1">
            <div
              className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold',
                current
                  ? 'bg-[color:var(--text)] text-[color:var(--surface)]'
                  : done
                    ? 'bg-[color:var(--primary)] text-white'
                    : 'border border-[color:var(--stroke)] text-[color:var(--muted)]'
              )}
            >
              {done ? '✓' : i + 1}
            </div>
            <span
              className={cn(
                'truncate text-[10px] font-bold uppercase tracking-wide',
                current ? 'text-[color:var(--text)]' : 'text-[color:var(--muted)]'
              )}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 ? (
              <div className={cn('mx-0.5 h-px min-w-[8px] flex-1', done ? 'bg-[color:var(--primary)]' : 'bg-[color:var(--stroke)]')} />
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
