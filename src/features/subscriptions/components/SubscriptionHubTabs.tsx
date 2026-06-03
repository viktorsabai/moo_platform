'use client'

import { cn } from '@/lib/utils'

export type SubscriptionHubTab = 'overview' | 'list'

type Props = {
  tab: SubscriptionHubTab
  onTab: (tab: SubscriptionHubTab) => void
  listCount?: number
}

const TABS: { id: SubscriptionHubTab; label: string }[] = [
  { id: 'overview', label: 'обзор' },
  { id: 'list', label: 'мои' },
]

export function SubscriptionHubTabs({ tab, onTab, listCount = 0 }: Props) {
  return (
    <div className="mb-4 flex rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface)] p-1">
      {TABS.map((t) => {
        const current = tab === t.id
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onTab(t.id)}
            className={cn(
              'flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-[12px] font-bold transition',
              current ? 'bg-[color:var(--text)] text-[color:var(--surface)]' : 'text-[color:var(--muted)]'
            )}
          >
            <span>{t.label}</span>
            {t.id === 'list' && listCount > 0 ? (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] font-extrabold tabular-nums',
                  current ? 'bg-[color:var(--surface)]/20 text-[color:var(--surface)]' : 'bg-[color:var(--stroke)] text-[color:var(--text)]'
                )}
              >
                {listCount}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
