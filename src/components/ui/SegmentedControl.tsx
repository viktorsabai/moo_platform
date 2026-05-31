'use client'

import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

export interface SegmentedControlOption {
  value: string
  label: ReactNode
  icon?: ReactNode
}

export interface SegmentedControlProps {
  options: SegmentedControlOption[]
  value: string
  onChange: (value: string) => void
  className?: string
}

export function SegmentedControl({ options, value, onChange, className }: SegmentedControlProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border border-black/10 bg-white/60 p-1',
        className
      )}
    >
      {options.map((option) => {
        const isActive = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex h-9 items-center gap-2 rounded-full px-3 text-[13px] font-semibold transition',
              isActive
                ? 'bg-white text-black/85 shadow-[0_2px_8px_rgba(0,0,0,0.08)]'
                : 'text-black/45 active:opacity-80'
            )}
            aria-pressed={isActive}
          >
            {option.icon ? <span className="h-4 w-4">{option.icon}</span> : null}
            <span>{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
