'use client'

import { useRef, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { IconChevronDown } from './icons'

export interface CustomSelectOption {
  value: string
  label: string
}

export interface CustomSelectProps {
  value: string
  onChange: (value: string) => void
  options: CustomSelectOption[]
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = '— выбрать —',
  className,
  disabled = false,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedLabel = value ? options.find((o) => o.value === value)?.label ?? value : placeholder

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        className={cn(
          'input input--pill flex w-full items-center justify-between gap-2 text-left',
          !value && 'text-[color:var(--muted)]',
          disabled && 'cursor-not-allowed opacity-60'
        )}
        style={{ borderRadius: 'var(--radius-pill)' }}
      >
        <span className="min-w-0 truncate">{selectedLabel}</span>
        <IconChevronDown
          className={cn('h-4 w-4 shrink-0 text-black/45 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 top-full z-[9999] mt-1 max-h-56 overflow-auto rounded-[var(--radius-large)] border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] py-1 shadow-[var(--shadow-card)]"
          role="listbox"
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={opt.value === value}
              onClick={() => {
                onChange(opt.value)
                setOpen(false)
              }}
              className={cn(
                'block w-full px-4 py-2.5 text-left text-[14px] font-medium transition',
                opt.value === value
                  ? 'bg-black/[0.06] text-[color:var(--text)]'
                  : 'text-[color:var(--text)] hover:bg-black/[0.04] active:bg-black/[0.06]'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
