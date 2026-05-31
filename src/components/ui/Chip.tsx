import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Chip({
  accent = false,
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { accent?: boolean }) {
  return <span className={cn('ui-pill', accent ? 'ui-pill--selected' : '', className)} {...props} />
}

