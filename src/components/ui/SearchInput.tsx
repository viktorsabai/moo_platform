'use client'

import { cn } from '@/lib/utils'
import type { InputHTMLAttributes } from 'react'
import { IconSearch } from './icons'

export interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  className?: string
}

export function SearchInput({ className, ...props }: SearchInputProps) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--muted)]">
        <IconSearch className="h-5 w-5" />
      </span>
      <input
        type="search"
        className={cn(
          'input input--pill pl-10',
          className
        )}
        {...props}
      />
    </div>
  )
}
