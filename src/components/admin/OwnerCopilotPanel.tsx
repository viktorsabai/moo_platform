'use client'

import { useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'

const QUICK_PROMPTS = [
  { label: 'что важно сегодня?', prompt: 'Что сейчас требует внимания?' },
  { label: 'составь план подписки', prompt: 'Составь мне план подписки' },
  { label: 'выгрузи неделю', prompt: 'Выгрузи информацию за последнюю неделю' },
]

type CopilotResponse = {
  ok?: boolean
  answer?: string
  recommendations?: string[]
  downloadUrl?: string
  planDraft?: {
    name: string
    targetAudience: string
    daysPerWeek: string
    dishesPerDelivery: string
    reason: string
  }
  action?: { label: string; href: string }
  mode?: string
}

export function OwnerCopilotPanel() {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CopilotResponse | null>(null)

  async function ask(nextPrompt = prompt) {
    const value = nextPrompt.trim()
    if (!value || loading) return
    setPrompt(value)
    setLoading(true)
    try {
      const response = await fetch('/api/admin/copilot', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: value, days: 7 }),
      })
      const data = (await response.json().catch(() => null)) as CopilotResponse | null
      if (!response.ok || !data?.ok) throw new Error('Не удалось получить ответ')
      setResult(data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось получить ответ')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="mb-4 overflow-hidden rounded-[28px] border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] shadow-[var(--shadow-soft)]" aria-labelledby="owner-copilot-title">
      <div className="relative overflow-hidden bg-[#111827] px-5 py-5 text-white">
        <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-[color:var(--accent)]/30 blur-3xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/55">owner copilot · бесплатно</div>
            <h2 id="owner-copilot-title" className="mt-2 text-[25px] font-extrabold leading-none tracking-[-0.045em]">что сделать дальше?</h2>
            <p className="mt-2 max-w-[34rem] text-[13px] font-medium leading-relaxed text-white/65">Подскажу по данным заведения, соберу черновик плана подписки или подготовлю выгрузку. Ничего не меняю без подтверждения.</p>
          </div>
          <span className="shrink-0 rounded-full bg-white/12 px-2.5 py-1 text-[11px] font-extrabold text-white/75">β</span>
        </div>
        <form className="relative mt-4 flex gap-2" onSubmit={(event) => { event.preventDefault(); void ask() }}>
          <input
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            className="min-w-0 flex-1 rounded-full border border-white/15 bg-white/10 px-4 py-3 text-[13px] font-semibold text-white outline-none placeholder:text-white/42 focus:border-white/35"
            placeholder="например: что просело за неделю?"
            aria-label="Запрос owner copilot"
          />
          <button type="submit" disabled={loading || !prompt.trim()} className="shrink-0 rounded-full bg-white px-4 py-3 text-[13px] font-extrabold text-slate-950 transition active:scale-[0.98] disabled:opacity-45">{loading ? 'думаю…' : 'спросить'}</button>
        </form>
        <div className="relative mt-3 flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {QUICK_PROMPTS.map((item) => <button key={item.label} type="button" onClick={() => { setPrompt(item.prompt); void ask(item.prompt) }} className="shrink-0 rounded-full border border-white/15 bg-white/8 px-3 py-2 text-[11px] font-bold text-white/78 transition hover:bg-white/14 active:scale-[0.98]">{item.label}</button>)}
        </div>
      </div>

      {result ? (
        <div className="space-y-3 p-5">
          <div className="text-[14px] font-bold leading-relaxed text-[color:var(--text)]">{result.answer}</div>
          {result.recommendations?.length ? <div className="space-y-2">{result.recommendations.map((item) => <div key={item} className="rounded-[16px] bg-[color:var(--surface)] px-3 py-2.5 text-[13px] font-semibold leading-snug text-[color:var(--text)]">{item}</div>)}</div> : null}
          {result.planDraft ? (
            <div className="rounded-[20px] border border-[color:var(--stroke)] bg-[color:var(--surface)] p-4">
              <div className="flex items-start justify-between gap-3"><div><div className="text-[16px] font-extrabold">{result.planDraft.name}</div><div className="mt-1 text-[12px] font-semibold text-[color:var(--muted)]">{result.planDraft.targetAudience}</div></div><span className="rounded-full bg-[color:var(--accent)]/12 px-2.5 py-1 text-[10px] font-extrabold text-[color:var(--accent)]">черновик</span></div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[12px] font-bold"><div className="rounded-[14px] bg-[color:var(--surface-strong)] p-3">{result.planDraft.daysPerWeek}<span className="mt-1 block font-medium text-[color:var(--muted)]">доставок в неделю</span></div><div className="rounded-[14px] bg-[color:var(--surface-strong)] p-3">{result.planDraft.dishesPerDelivery}<span className="mt-1 block font-medium text-[color:var(--muted)]">блюда на доставку</span></div></div>
              <p className="mt-3 text-[12px] font-medium leading-relaxed text-[color:var(--muted)]">{result.planDraft.reason}</p>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {result.downloadUrl ? <a href={result.downloadUrl} className="inline-flex rounded-full bg-[color:var(--primary)] px-4 py-2.5 text-[12px] font-extrabold text-white">скачать CSV</a> : null}
            {result.action ? <Link href={result.action.href} className="inline-flex rounded-full border border-[color:var(--stroke)] px-4 py-2.5 text-[12px] font-extrabold text-[color:var(--text)]">{result.action.label}</Link> : null}
          </div>
        </div>
      ) : null}
    </section>
  )
}
