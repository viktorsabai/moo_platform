'use client'

import { cn } from '@/lib/utils'

const SIZE_CLASS = {
  xs: 'h-8 w-8 text-[10px]',
  sm: 'h-10 w-10 text-[11px]',
  md: 'h-12 w-12 text-[13px]',
  lg: 'h-16 w-16 text-[18px]',
  xl: 'h-20 w-20 text-[22px]',
} as const

export type UserAvatarProps = {
  name: string
  photoUrl?: string | null
  size?: keyof typeof SIZE_CLASS
  className?: string
}

export function UserAvatar({ name, photoUrl, size = 'md', className }: UserAvatarProps) {
  const initial = String(name || '?').trim().charAt(0).toUpperCase() || '?'
  return (
    <div
      className={cn(
        'relative shrink-0 overflow-hidden rounded-full bg-black/[0.06] ring-1 ring-[color:var(--stroke)]',
        SIZE_CLASS[size],
        className
      )}
    >
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        <span className="flex h-full w-full items-center justify-center font-bold text-[color:var(--muted)]">
          {initial}
        </span>
      )}
    </div>
  )
}
