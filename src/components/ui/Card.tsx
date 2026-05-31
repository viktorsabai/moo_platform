import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type CardVariant = 'default' | 'surface' | 'surfaceStrong'

export function Card({
  className,
  variant = 'default',
  ...props
}: HTMLAttributes<HTMLDivElement> & { variant?: CardVariant }) {
  const base =
    variant === 'surface'
      ? 'ui-surface'
      : variant === 'surfaceStrong'
        ? 'ui-surface-strong p-5'
        : 'card'
  return <div className={cn(base, className)} {...props} />
}

