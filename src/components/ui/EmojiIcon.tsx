import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function EmojiIcon({
  emoji,
  active = false,
  subtle = true,
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  emoji: string
  active?: boolean
  subtle?: boolean
}) {
  return (
    <span
      className={cn(
        'ufo-emoji',
        subtle ? 'ufo-emoji--subtle' : '',
        active ? 'ufo-emoji--active' : '',
        className
      )}
      aria-hidden="true"
      {...props}
    >
      {emoji}
    </span>
  )
}

