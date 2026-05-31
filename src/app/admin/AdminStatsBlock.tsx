'use client'

import { useState } from 'react'
import { formatPrice } from '@/lib/utils'

type Props = {
  ordersToday: number
  ordersWeek: number
  revenueToday: number
  revenueWeek: number
}

export function AdminStatsBlock({ ordersToday, ordersWeek, revenueToday, revenueWeek }: Props) {
  const [expanded, setExpanded] = useState(false)

  const todayPct = ordersWeek > 0 ? Math.min(100, (ordersToday / ordersWeek) * 100) : 0

  return (
    <div
      className="mb-4 overflow-hidden border border-black/[0.06] bg-[color:var(--surface-strong)] p-4 shadow-[var(--shadow-soft)]"
      style={{ borderRadius: 'var(--radius-large)' }}
    >
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full text-left"
      >
        <div className="ui-h2 mb-1 text-[12px]">заказы и выручка</div>
        <p className="ui-muted mb-3 text-[11px]">Ниже — быстро открыто/закрыто и карточки. Тап — {expanded ? 'свернуть' : 'подробнее'}.</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="ui-muted text-[12px]">сегодня</div>
            <div className="ui-body mt-0.5 text-[15px] font-semibold tabular-nums">
              {ordersToday} заказов · {formatPrice(revenueToday)}
            </div>
          </div>
          <div>
            <div className="ui-muted text-[12px]">за неделю</div>
            <div className="ui-body mt-0.5 text-[15px] font-semibold tabular-nums">
              {ordersWeek} заказов · {formatPrice(revenueWeek)}
            </div>
          </div>
        </div>
        <div className="mt-3">
          <div
            className="h-2 rounded-full bg-[color:var(--accent)]/30"
            style={{ borderRadius: 'var(--radius-pill)' }}
          >
            <div
              className="h-full rounded-full bg-[color:var(--accent)] transition-[width] duration-300"
              style={{
                borderRadius: 'var(--radius-pill)',
                width: `${todayPct}%`,
              }}
            />
          </div>
          <div className="ui-muted mt-1 text-[10px]">сегодня / неделя · Тап — {expanded ? 'свернуть' : 'подробнее'}</div>
        </div>
      </button>

      {expanded && (
        <div className="mt-4 border-t border-black/[0.06] pt-4">
          <div className="ui-muted mb-2 text-[11px]">сравнение за период</div>
          <div
            className="h-3 rounded-full bg-[color:var(--accent)]/20"
            style={{ borderRadius: 'var(--radius-pill)' }}
          >
            <div
              className="h-full rounded-full bg-[color:var(--accent)] transition-[width] duration-300"
              style={{
                borderRadius: 'var(--radius-pill)',
                width: `${todayPct}%`,
              }}
            />
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-black/50">
            <span>сегодня</span>
            <span>неделя</span>
          </div>
        </div>
      )}
    </div>
  )
}
