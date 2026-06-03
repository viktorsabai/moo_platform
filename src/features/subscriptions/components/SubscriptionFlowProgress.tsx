'use client'

import { cn } from '@/lib/utils'

export type SubscriptionFlowStep = 'build' | 'pay'

type Props = {
  step: SubscriptionFlowStep
  onStep?: (step: SubscriptionFlowStep) => void
  payEnabled?: boolean
}

const STEPS: { id: SubscriptionFlowStep; label: string }[] = [
  { id: 'build', label: 'рацион' },
  { id: 'pay', label: 'оплата' },
]

export function SubscriptionFlowProgress({ step, onStep, payEnabled = true }: Props) {
  const idx = STEPS.findIndex((s) => s.id === step)
  return (
    <div className="mb-3 flex rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface)] p-1">
      {STEPS.map((s, i) => {
        const done = i < idx
        const current = i === idx
        const disabled = s.id === 'pay' && !payEnabled
        const clickable = Boolean(onStep) && !disabled && (done || s.id === 'pay' || current)
        return (
          <button
            key={s.id}
            type="button"
            disabled={!clickable}
            onClick={() => {
              if (!onStep || disabled) return
              if (s.id === 'build' || (s.id === 'pay' && payEnabled)) onStep(s.id)
            }}
            className={cn(
              'flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-[12px] font-bold transition',
              current ? 'bg-[color:var(--text)] text-[color:var(--surface)]' : 'text-[color:var(--muted)]',
              disabled && !current && 'opacity-40',
              clickable && !current && 'active:opacity-80'
            )}
          >
            <span
              className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold',
                current
                  ? 'bg-[color:var(--surface)] text-[color:var(--text)]'
                  : done
                    ? 'bg-[color:var(--primary)] text-white'
                    : 'border border-[color:var(--stroke)]'
              )}
            >
              {done ? '✓' : i + 1}
            </span>
            <span className="capitalize">{s.label}</span>
          </button>
        )
      })}
    </div>
  )
}
