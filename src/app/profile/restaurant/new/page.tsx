'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { IconChevronRight } from '@/components/ui/icons'

export default function NewRestaurantPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!name.trim() || !slug.trim()) {
      setError('Укажите название и код (латиница)')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/restaurant/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), slug: slug.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '') }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        setError(data?.error || 'не удалось создать заведение')
        return
      }
      router.push('/admin')
    } catch {
      setError('ошибка сети')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="ui-container ui-screen">
      <PageHeader backHref="/profile/owner" title="новое заведение" subtitle="создайте точку для продаж" />

      <form onSubmit={handleSubmit} className="ui-surface-card space-y-4 p-4" style={{ borderRadius: 'var(--radius-large)' }}>
        <div>
          <label className="mb-1 block text-[12px] font-bold uppercase tracking-wide text-[color:var(--muted)]">название</label>
          <input
            type="text"
            className="input input--pill w-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="например: USSR"
            autoComplete="off"
          />
          <p className="ui-muted mt-1.5 text-[12px]">Так заведение будет видно клиентам.</p>
        </div>
        <div>
          <label className="mb-1 block text-[12px] font-bold uppercase tracking-wide text-[color:var(--muted)]">код точки</label>
          <input
            type="text"
            className="input input--pill w-full"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''))}
            placeholder="ussr-phuket"
            autoComplete="off"
          />
          <p className="ui-muted mt-1.5 text-[12px]">Латиница, цифры и дефисы. Используется в ссылках и настройках.</p>
        </div>

        <div className="rounded-[22px] bg-[color:var(--surface)] px-3 py-3">
          <div className="text-[12px] font-bold uppercase tracking-wide text-[color:var(--muted)]">что будет дальше</div>
          <div className="mt-2 space-y-1.5 text-[13px] font-semibold text-[color:var(--text)]">
            <div className="flex items-center justify-between gap-3"><span>меню и товары</span><IconChevronRight className="h-4 w-4 text-[color:var(--muted)]" /></div>
            <div className="flex items-center justify-between gap-3"><span>часы, доставка и оплата</span><IconChevronRight className="h-4 w-4 text-[color:var(--muted)]" /></div>
            <div className="flex items-center justify-between gap-3"><span>главная, заявки и подписки</span><IconChevronRight className="h-4 w-4 text-[color:var(--muted)]" /></div>
          </div>
        </div>

        {error ? <p className="text-[13px] font-semibold text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={loading || !name.trim() || !slug.trim()}
          className="btn btn-primary w-full rounded-full py-3 text-[14px] font-semibold disabled:opacity-50"
          style={{ borderRadius: 'var(--radius-pill)' }}
        >
          {loading ? 'создаём…' : 'создать заведение'}
        </button>
      </form>

      <Link
        href="/profile/owner"
        prefetch={false}
        className="mt-4 block text-center text-[13px] font-semibold text-[color:var(--muted)] transition active:opacity-80"
      >
        отмена
      </Link>
    </main>
  )
}
