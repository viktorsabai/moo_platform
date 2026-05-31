'use client'

import { cn } from '@/lib/utils'

/** Food/category emojis for quick pick */
const FOOD_EMOJIS = [
  '🍔', '🍟', '🌭', '🍕', '🥗', '🥘', '🍜', '🍲', '🍛', '🍝', '🍣', '🍱',
  '🥟', '🍙', '🍚', '🍞', '🥐', '🥖', '🧀', '🥚', '🍳', '🥞', '🥓', '🥩',
  '🍗', '🍖', '🌮', '🌯', '🥙', '🥪', '🍿', '🥡', '🥢', '🍴',
  '☕', '🍵', '🧃', '🥤', '🍶', '🍺', '🍷', '🥂', '🍹', '🥃',
  '🍦', '🍧', '🍨', '🍩', '🍪', '🎂', '🍰', '🧁', '🥧', '🍫', '🍬',
  '🥜', '🍇', '🍈', '🍉', '🍊', '🍋', '🍌', '🍍', '🥭', '🍎', '🍏',
  '🥕', '🌽', '🥒', '🥬', '🥦', '🍅', '🫑', '🌶️', '🥑', '🫒',
]

export interface EmojiCarouselProps {
  value?: string | null
  onChange: (emoji: string) => void
  className?: string
}

export function EmojiCarousel({ value, onChange, className }: EmojiCarouselProps) {
  return (
    <div
      className={cn(
        'overflow-x-auto overflow-y-visible pb-1 pr-2 [scrollbar-width:none] [-webkit-overflow-style:none] [&::-webkit-scrollbar]:hidden',
        className
      )}
    >
      <div className="flex min-w-max gap-1.5 pr-4">
        {FOOD_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onChange(emoji)}
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[18px] transition',
              value === emoji
                ? 'bg-black/15 ring-2 ring-black/20'
                : 'bg-black/[0.06] active:bg-black/10'
            )}
            style={{ borderRadius: 'var(--radius-pill)' }}
            aria-label={emoji}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  )
}
