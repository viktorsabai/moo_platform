import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function InlineReveal({
  open,
  children,
  className,
}: {
  open: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'overflow-hidden transition-[max-height,opacity] duration-200 ease-out',
        open ? 'max-h-[520px] opacity-100' : 'max-h-0 opacity-0',
        className
      )}
    >
      {children}
    </div>
  )
}

