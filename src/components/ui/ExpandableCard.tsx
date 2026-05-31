'use client'

import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { IconChevronUp } from './icons'

export interface ExpandableCardProps {
  collapsed: ReactNode
  expanded: ReactNode
  defaultExpanded?: boolean
  onToggle?: (expanded: boolean) => void
  className?: string
  showChevron?: boolean
}

export function ExpandableCard({
  collapsed,
  expanded,
  defaultExpanded = false,
  onToggle,
  className,
  showChevron = true,
}: ExpandableCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  const handleToggle = () => {
    const next = !isExpanded
    setIsExpanded(next)
    onToggle?.(next)
  }

  return (
    <div className={cn('ui-surface-strong overflow-hidden transition', className)}>
      <button
        type="button"
        onClick={handleToggle}
        className="block w-full text-left transition active:opacity-90"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center justify-between gap-3 p-4">
          <div className="flex-1 min-w-0">{collapsed}</div>
          {showChevron && (
            <div
              className={cn(
                'shrink-0 text-black/25 transition-transform',
                isExpanded && 'rotate-180'
              )}
            >
              <IconChevronUp className="h-5 w-5" />
            </div>
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-black/10 px-4 pb-4 pt-3">
          {expanded}
        </div>
      )}
    </div>
  )
}
