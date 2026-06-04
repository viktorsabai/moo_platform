'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { telegramUserUrl } from '@/lib/telegram-contact'
import { UserAvatar } from '@/components/ui/UserAvatar'

export type GuestClientInfo = {
  userId?: string
  displayName: string
  contactLabel?: string | null
  telegramId?: string | null
  photoUrl?: string | null
}

export function guestClientFromSubscriptionUser(
  user: {
    id?: string
    displayName?: string
    name?: string
    contactLabel?: string
    telegramUsername?: string | null
    telegramId?: string | null
    telegramPhotoUrl?: string | null
    avatar?: string | null
  } | null | undefined,
  fallbackName = 'Гость'
): GuestClientInfo {
  if (!user) {
    return { displayName: fallbackName, contactLabel: null, photoUrl: null }
  }
  const displayName = String(user.displayName || user.name || fallbackName).trim() || fallbackName
  const contactLabel =
    user.contactLabel ??
    (user.telegramUsername ? `@${String(user.telegramUsername).replace(/^@/, '')}` : null)
  return {
    userId: user.id,
    displayName,
    contactLabel,
    telegramId: user.telegramId ?? null,
    photoUrl: user.telegramPhotoUrl ?? user.avatar ?? null,
  }
}

export type GuestClientCardProps = {
  client: GuestClientInfo
  variant?: 'row' | 'tile' | 'hero'
  selected?: boolean
  onClick?: () => void
  meta?: string
  badge?: string
  className?: string
  children?: ReactNode
}

export function GuestClientCard({
  client,
  variant = 'row',
  selected = false,
  onClick,
  meta,
  badge,
  className,
  children,
}: GuestClientCardProps) {
  const tgUrl = telegramUserUrl(client.telegramId)
  const avatarSize = variant === 'hero' ? 'lg' : variant === 'tile' ? 'md' : 'sm'

  const inner = (
    <>
      <UserAvatar name={client.displayName} photoUrl={client.photoUrl} size={avatarSize} />
      <div className="min-w-0 flex-1">
        <p className={cn('truncate font-semibold text-[color:var(--text)]', variant === 'hero' ? 'text-[16px]' : 'text-[13px]')}>
          {client.displayName}
        </p>
        {client.contactLabel ? (
          tgUrl ? (
            <Link
              href={tgUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="mt-0.5 block truncate text-[12px] font-semibold text-[color:var(--primary)]"
            >
              {client.contactLabel}
            </Link>
          ) : (
            <p className="mt-0.5 truncate text-[12px] text-[color:var(--muted)]">{client.contactLabel}</p>
          )
        ) : null}
        {meta ? <p className="mt-1 truncate text-[11px] text-[color:var(--muted)]">{meta}</p> : null}
        {children}
      </div>
      {badge ? (
        <span className="shrink-0 rounded-full bg-black/[0.06] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--muted)]">
          {badge}
        </span>
      ) : null}
    </>
  )

  const shellClass = cn(
    'transition',
    variant === 'tile' && 'flex w-[108px] shrink-0 flex-col items-center gap-2 rounded-xl border-2 p-3 text-center',
    variant === 'row' && 'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left',
    variant === 'hero' && 'flex w-full items-start gap-3 rounded-2xl border p-4',
    selected ? 'border-[color:var(--primary)] bg-[color:var(--primary)]/5' : 'border-[color:var(--stroke)] bg-[color:var(--surface-strong)]',
    onClick && 'cursor-pointer active:opacity-90',
    className
  )

  if (variant === 'tile') {
    return (
      <button type="button" onClick={onClick} className={shellClass}>
        <UserAvatar name={client.displayName} photoUrl={client.photoUrl} size="md" />
        <span className="max-w-full truncate text-[11px] font-medium">{client.displayName}</span>
        {meta ? <span className="text-[10px] text-[color:var(--muted)]">{meta}</span> : null}
      </button>
    )
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={shellClass}>
        {inner}
      </button>
    )
  }

  return <div className={shellClass}>{inner}</div>
}
