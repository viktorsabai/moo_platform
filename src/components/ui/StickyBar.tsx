import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function StickyBar({
  left,
  right,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  left?: ReactNode
  right?: ReactNode
}) {
  return (
    <div
      className={cn(
        'fixed bottom-[calc(var(--ufo-bottomnav-h,72px)+env(safe-area-inset-bottom))] left-1/2 z-[90] w-[min(420px,92%)] -translate-x-1/2',
        className
      )}
      {...props}
    >
      <div className="overflow-hidden rounded-[26px] border border-white/10 bg-white/[0.06] shadow-[0_18px_50px_rgba(0,0,0,0.28)] backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-black/35" />
        </div>
        <div className="relative flex items-center justify-between gap-3 p-3">
          <div className="min-w-0">{left}</div>
          <div className="shrink-0">{right}</div>
        </div>
      </div>
    </div>
  )
}

