'use client'

import { useEffect, useState } from 'react'
import { formatPrice } from '@/lib/utils'

type CampaignReport = {
  campaignId: string
  name: string
  code: string | null
  applied: number
  reversed: number
  discountAmount: number
  netRevenue: number
  estimatedCost: number
  contribution: number
  contributionMarginPercent: number | null
}

export function AdminCampaignContributionPanel() {
  const [rows, setRows] = useState<CampaignReport[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let disposed = false
    fetch('/api/admin/campaigns/report?days=30', { cache: 'no-store', credentials: 'include' })
      .then(async (response) => {
        const data = await response.json().catch(() => null)
        if (disposed) return
        if (response.ok && data?.ok) setRows(Array.isArray(data.campaigns) ? data.campaigns : [])
        else setFailed(true)
      })
      .catch(() => {
        if (!disposed) setFailed(true)
      })
      .finally(() => {
        if (!disposed) setLoading(false)
      })
    return () => {
      disposed = true
    }
  }, [])

  if (failed || loading || rows.length === 0) return null
  return (
    <section className="mb-4 rounded-[24px] border border-[color:var(--stroke)] bg-[color:var(--surface)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--muted)]">экономика · 30 дней</p>
          <h2 className="mt-1 text-[17px] font-extrabold text-[color:var(--text)]">какие акции дают вклад</h2>
        </div>
        <span className="text-[11px] font-semibold text-[color:var(--muted)]">после скидки</span>
      </div>
      <div className="mt-3 space-y-2">
        {rows.slice(0, 5).map((row) => (
          <div key={row.campaignId} className="rounded-[16px] bg-[color:var(--surface-strong)] px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 truncate text-[13px] font-bold">{row.name}</div>
              <div className="shrink-0 text-[13px] font-extrabold tabular-nums">{formatPrice(row.contribution)}</div>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-semibold text-[color:var(--muted)]">
              <span>{row.applied} применений</span><span>скидка {formatPrice(row.discountAmount)}</span><span>маржа {row.contributionMarginPercent == null ? '—' : `${row.contributionMarginPercent}%`}</span>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[10px] leading-snug text-[color:var(--muted)]">Contribution = неотменённая выручка после скидки минус заполненная себестоимость позиций. Если costPrice не задан, оценка завышает вклад.</p>
    </section>
  )
}
