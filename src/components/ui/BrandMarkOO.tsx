import { cn } from '@/lib/utils'

export function BrandMarkOO({
  variant = 'stroke',
  size = 28,
  className,
}: {
  variant?: 'stroke' | 'solid'
  size?: number
  className?: string
}) {
  const ring = variant === 'solid' ? 'bg-black/85' : 'border-2 border-black/75'
  return (
    <div className={cn('inline-flex items-center gap-2', className)} aria-hidden style={{ height: size }}>
      <span className={cn('rounded-full', ring)} style={{ width: Math.max(10, Math.round(size * 0.34)), height: Math.max(10, Math.round(size * 0.34)) }} />
      <span className={cn('rounded-full', ring)} style={{ width: Math.max(10, Math.round(size * 0.34)), height: Math.max(10, Math.round(size * 0.34)) }} />
    </div>
  )
}

