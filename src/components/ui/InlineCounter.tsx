import { cn } from '@/lib/utils'

export function InlineCounter({
  value,
  onDec,
  onInc,
  max,
  className,
  disabled,
}: {
  value: number
  onDec: () => void
  onInc: () => void
  max?: number
  className?: string
  disabled?: boolean
}) {
  const v = Math.max(0, Number.isFinite(value) ? value : 0)
  const atMax = typeof max === 'number' && v >= max

  return (
    <div className={cn('ufo-counter', className, disabled ? 'opacity-50 pointer-events-none' : '')}>
      <button type="button" onClick={onDec} className="ufo-counter__btn" aria-label="уменьшить">
        −
      </button>
      <div className="ufo-counter__val" aria-label={`количество ${v}`}>
        {v}
      </div>
      <button
        type="button"
        onClick={onInc}
        className={cn('ufo-counter__btn', atMax && 'opacity-40 cursor-not-allowed')}
        aria-label="увеличить"
        disabled={atMax}
      >
        +
      </button>
    </div>
  )
}

