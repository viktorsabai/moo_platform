'use client'

import { useCallback, useEffect, useState } from 'react'

type Summary = { total: number; pending: number; failed: number; lastError: string | null }

export function AdminKitchenToday() {
  const [s, setS] = useState<Summary | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/subscriptions/kitchen', { cache: 'no-store', credentials: 'include' })
    const d = await res.json().catch(() => null)
    if (res.ok && d?.ok) setS(d as Summary)
  }, [])
  useEffect(() => { void load() }, [load])

  async function run() {
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/admin/subscriptions/kitchen', { method: 'POST', credentials: 'include' })
      const d = await res.json().catch(() => null)
      if (!res.ok || !d?.ok) setMsg('не получилось — попробуйте ещё раз')
      else if (d.failed > 0) setMsg(`создано ${d.created}, не вышло ${d.failed}: ${(d.errors ?? []).join('; ')}`)
      else setMsg(d.created > 0 ? `создано заказов: ${d.created}` : 'всё уже собрано')
      await load()
    } finally {
      setBusy(false)
    }
  }

  if (s && s.total === 0) return null
  const sub = !s
    ? 'считаю…'
    : s.pending === 0
      ? `все ${s.total} заказа на кухне`
      : `${s.pending} из ${s.total} ждут сборки`

  return (
    <section className="mt-3 rounded-[20px] bg-[color:var(--surface)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[15px] font-semibold text-[color:var(--text)]">кухня на сегодня</div>
          <div className="text-[13px] text-[color:var(--muted)]">{sub}</div>
        </div>
        {s && s.pending > 0 ? (
          <button
            type="button"
            onClick={run}
            disabled={busy}
            className="h-11 rounded-[14px] bg-[color:var(--primary)] px-4 text-[14px] font-semibold text-[color:var(--on-primary)] disabled:opacity-60"
          >
            {busy ? '…' : 'собрать'}
          </button>
        ) : null}
      </div>
      {s && s.failed > 0 && !msg ? (
        <div className="mt-2 rounded-[12px] bg-[color:var(--danger-bg)] px-3 py-2 text-[13px] text-[color:var(--danger)]">
          не собралось: {s.failed} — {s.lastError}
        </div>
      ) : null}
      {msg ? <div className="mt-2 text-[13px] text-[color:var(--muted)]" role="status">{msg}</div> : null}
    </section>
  )
}
