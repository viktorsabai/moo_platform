'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { DEFAULT_PAYMENT_METHODS, mergePaymentMethodsWithDefaults, type PaymentMethodRow } from '@/lib/payment-methods'

export function AdminPaymentMethods() {
  const [rows, setRows] = useState<PaymentMethodRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/settings', { cache: 'no-store', credentials: 'include' })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast.error(data?.error || 'Не удалось загрузить')
        setRows([...DEFAULT_PAYMENT_METHODS])
        return
      }
      setRows(mergePaymentMethodsWithDefaults(data.settings?.paymentMethodsJson))
    } catch {
      toast.error('Ошибка')
      setRows([...DEFAULT_PAYMENT_METHODS])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function uploadQr(slug: string, file: File | null) {
    if (!file) return
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/uploads/payment-qr', {
        method: 'POST',
        credentials: 'include',
        body: fd,
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok || !data.url) {
        toast.error(data?.error || 'Загрузка не удалась')
        return
      }
      setRows((prev) => prev.map((r) => (r.slug === slug ? { ...r, qrImageUrl: data.url } : r)))
      toast.success('QR сохранён локально — нажмите «сохранить способы оплаты»')
    } catch {
      toast.error('Ошибка загрузки')
    }
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ paymentMethods: rows }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast.error(data?.error || 'Не сохранилось')
        return
      }
      toast.success('Способы оплаты сохранены')
      setRows(mergePaymentMethodsWithDefaults(data.settings?.paymentMethodsJson))
    } catch {
      toast.error('Ошибка')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="ui-surface-card mt-4 p-4 text-[13px] text-[color:var(--muted)]" style={{ borderRadius: 'var(--radius-large)' }}>
        загрузка способов оплаты…
      </div>
    )
  }

  return (
    <div className="ui-surface-card mt-4 overflow-hidden p-4" style={{ borderRadius: 'var(--radius-large)' }}>
      <h2 className="ui-h2 mb-1 text-[14px]">оплата в приложении</h2>
      <p className="ui-muted mb-4 text-[12px] leading-relaxed">
        Включите нужные способы. Для QR загрузите картинку кода. Для рублей укажите курс (₽ за 1 ฿) — в чекауте покажется сумма в ₽.
      </p>
      <div className="mb-4 rounded-xl border border-[color:var(--stroke)] bg-[color:var(--surface)] px-3 py-2 text-[12px] text-[color:var(--muted)]">
        Шаги: включите способ оплаты → (для QR) загрузите QR-картинку → нажмите «сохранить способы оплаты».
      </div>
      <div className="space-y-5">
        {rows.map((row) => (
          <div key={row.slug} className="rounded-xl border border-[color:var(--stroke)] bg-[color:var(--surface)] p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">{row.slug}</span>
              <label className="inline-flex items-center gap-2 text-[12px] font-semibold">
                <input
                  type="checkbox"
                  checked={row.enabled}
                  onChange={(e) => setRows((p) => p.map((r) => (r.slug === row.slug ? { ...r, enabled: e.target.checked } : r)))}
                />
                вкл
              </label>
            </div>
            <div className="mt-2">
              <div className="mb-1 text-[11px] font-semibold text-[color:var(--muted)]">название в чекауте</div>
              <input
                className="input h-9 w-full text-[13px]"
                value={row.title}
                onChange={(e) => setRows((p) => p.map((r) => (r.slug === row.slug ? { ...r, title: e.target.value } : r)))}
              />
            </div>
            {(row.slug === 'QR_THB' || row.slug === 'QR_RUB' || row.slug === 'STRIPE') && (
              <div className="mt-2">
                <div className="mb-1 text-[11px] font-semibold text-[color:var(--muted)]">подсказка клиенту</div>
                <textarea
                  className="input min-h-[4rem] w-full resize-y text-[13px]"
                  value={row.instruction || ''}
                  onChange={(e) =>
                    setRows((p) => p.map((r) => (r.slug === row.slug ? { ...r, instruction: e.target.value || null } : r)))
                  }
                />
              </div>
            )}
            {row.slug === 'QR_RUB' ? (
              <div className="mt-2">
                <div className="mb-1 text-[11px] font-semibold text-[color:var(--muted)]">курс ₽ за 1 ฿</div>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  className="input h-9 w-full text-[13px]"
                  value={row.rubPerThb ?? ''}
                  onChange={(e) => {
                    const v = e.target.value
                    setRows((p) =>
                      p.map((r) =>
                        r.slug === row.slug
                          ? { ...r, rubPerThb: v === '' ? null : Math.max(0, Number(v)) || null }
                          : r
                      )
                    )
                  }}
                />
              </div>
            ) : null}
            {(row.slug === 'QR_THB' || row.slug === 'QR_RUB') && (
              <div className="mt-3">
                <div className="mb-1 text-[11px] font-semibold text-[color:var(--muted)]">QR-картинка</div>
                {row.qrImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.qrImageUrl} alt="" className="mb-2 max-h-40 rounded-lg border border-[color:var(--stroke)] object-contain" />
                ) : null}
                <label className="btn btn-soft inline-flex cursor-pointer rounded-full px-3 py-1.5 text-[12px] font-semibold">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null
                      e.target.value = ''
                      void uploadQr(row.slug, f)
                    }}
                  />
                  загрузить QR
                </label>
              </div>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={saving}
        onClick={() => void save()}
        className="btn btn-primary mt-4 w-full rounded-full text-[13px] font-semibold disabled:opacity-50"
        style={{ borderRadius: 'var(--radius-pill)' }}
      >
        {saving ? 'сохранение…' : 'сохранить способы оплаты'}
      </button>
    </div>
  )
}
