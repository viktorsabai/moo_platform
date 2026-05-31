'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { IconBell, IconCart, IconCopy, IconHome, IconMapPin, IconMenu, IconReceipt, IconTile, IconUserCircle } from '@/components/ui/icons'

export type AdminSectionCardProps = {
  id: string
  title: string
  hint: string
  href: string
  summary: string
  linkLabel?: string
  icon?: 'venue' | 'store' | 'team' | 'orders' | 'banners' | 'leads' | 'subscriptions' | 'platform' | 'analytics'
  badgeCount?: number
  badgeLabel?: string
  badgeTone?: 'alert' | 'info'
  isExpanded: boolean
  onToggle: () => void
  /** Mini-dashboard content when expanded (metrics, quick settings, then link to full page) */
  expandedContent?: ReactNode
}

export function AdminSectionCard({
  title,
  hint,
  href,
  summary,
  linkLabel = 'Перейти к настройкам',
  icon,
  badgeCount = 0,
  badgeLabel,
  badgeTone = 'alert',
  isExpanded,
  onToggle,
  expandedContent,
}: AdminSectionCardProps) {
  const hasHash = href.includes('#')
  const iconNode =
    icon === 'venue' ? <IconMapPin className="h-5 w-5" /> :
    icon === 'store' ? <IconMenu className="h-5 w-5" /> :
    icon === 'team' ? <IconUserCircle className="h-5 w-5" /> :
    icon === 'orders' ? <IconCart className="h-5 w-5" /> :
    icon === 'banners' ? <IconHome className="h-5 w-5" /> :
    icon === 'leads' ? <IconCopy className="h-5 w-5" /> :
    icon === 'subscriptions' ? <IconBell className="h-5 w-5" /> :
    icon === 'platform' ? <IconTile className="h-5 w-5" /> :
    icon === 'analytics' ? <IconReceipt className="h-5 w-5" /> :
    null

  return (
    <details
      open={isExpanded}
      className="overflow-hidden"
    >
      <summary
        onClick={(e) => {
          e.preventDefault()
          onToggle()
        }}
        className="flex cursor-pointer list-none items-center justify-between gap-3 bg-transparent px-1 py-3 transition active:opacity-90 [&::-webkit-details-marker]:hidden"
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {iconNode ? (
            <span
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--surface)] text-[color:var(--text)]"
              aria-hidden
            >
              {iconNode}
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-semibold text-[color:var(--text)]">{title}</div>
            <div className="ui-muted mt-0.5 truncate text-[12px]">{hint}</div>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-2">
          {badgeCount > 0 ? (
            <span
              className={
                badgeTone === 'info'
                  ? 'inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[color:var(--surface)] px-1.5 text-[11px] font-bold text-[color:var(--text)] ring-1 ring-[color:var(--stroke)]'
                  : 'inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-bold text-white'
              }
              aria-label={badgeLabel || `${badgeCount}`}
              title={badgeLabel || `${badgeCount}`}
            >
              {badgeCount > 99 ? '99+' : badgeCount}
            </span>
          ) : null}
          <span className="text-[20px] leading-none text-[color:var(--muted)]">›</span>
        </span>
      </summary>
      <div className="px-1 pb-4 pt-1">
        {expandedContent ?? (
          <>
            <p className="ui-muted mb-3 text-[13px]">{summary}</p>
            <Link
              href={href}
              prefetch={false}
              scroll={hasHash ? true : false}
              className="flex h-10 w-full items-center justify-center rounded-full bg-[color:var(--primary)] px-5 text-[14px] font-semibold text-white transition active:opacity-90"
            >
              {linkLabel}
            </Link>
          </>
        )}
      </div>
    </details>
  )
}
