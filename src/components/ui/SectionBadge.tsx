

'use client'

import * as React from 'react'

type SectionBadgeTone = 'neutral' | 'accent' | 'dark'

export function SectionBadge({
  label,
  icon,
  tone = 'neutral',
  className = '',
}: {
  label: string
  icon?: React.ReactNode
  tone?: SectionBadgeTone
  className?: string
}) {
  const base =
    'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold tracking-tight backdrop-blur'

  const tones: Record<SectionBadgeTone, string> = {
    neutral:
      'border-black/10 bg-white/70 text-black/60 dark:border-[color:var(--stroke)] dark:bg-black/25 dark:text-[color:var(--muted)]',
    accent:
      'border-[color:var(--accent)]/30 bg-[color:var(--accent)]/10 text-[color:var(--accent)] dark:border-[color:var(--accent)]/35 dark:bg-[color:var(--accent)]/16',
    dark:
      'border-black/10 bg-black/70 text-white/90 dark:border-white/10 dark:bg-black/60',
  }

  return (
    <span className={`${base} ${tones[tone]} ${className}`.trim()}>
      {icon ? (
        <span className="grid h-5 w-5 place-items-center rounded-full bg-black/[0.04] text-[12px] dark:bg-white/[0.08]">
          {icon}
        </span>
      ) : null}
      <span>{label}</span>
    </span>
  )
}

export function SectionBadgeEmoji({
  label,
  emoji,
  tone = 'neutral',
  className = '',
}: {
  label: string
  emoji: string
  tone?: SectionBadgeTone
  className?: string
}) {
  return (
    <SectionBadge
      label={label}
      tone={tone}
      className={className}
      icon={<span aria-hidden="true">{emoji}</span>}
    />
  )
}