'use client'

import { cn } from '@/lib/utils'

export interface PillTabOption {
  id: string
  label: string
}

export interface PillTabToggleProps {
  options: PillTabOption[]
  value: string
  onChange: (value: string) => void
  className?: string
}

/** Pill toggle matching admin ЛК style */
export function PillTabToggle({ options, value, onChange, className }: PillTabToggleProps) {
  if (options.length === 0) return null
  return (
    <div
      className={cn(
        'flex rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface)] p-1',
        className
      )}
      style={{ borderRadius: 'var(--radius-pill)' }}
      role="tablist"
    >
      {options.map((opt) => {
        const isActive = opt.id === value
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(opt.id)}
            className={cn(
              'flex-1 rounded-full py-2.5 text-[13px] font-semibold transition',
              isActive
                ? 'bg-[color:var(--surface-strong)] text-[color:var(--text)] shadow-[var(--shadow-soft)]'
                : 'text-[color:var(--muted)] active:opacity-80'
            )}
            style={isActive ? { borderRadius: 'var(--radius-pill)' } : undefined}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
