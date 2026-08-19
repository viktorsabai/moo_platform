'use client'

import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { useVenue } from '@/lib/venue-context'

const USE_CASES = [
  { label: 'офис', text: 'фуршет или регулярные обеды для команды', mark: '01' },
  { label: 'событие', text: 'презентация, день рождения или частный ужин', mark: '02' },
  { label: 'банкет', text: 'меню, объём и доставка под ваш формат', mark: '03' },
]

export default function CateringPage() {
  const { settings } = useVenue()
  const venueName = String((settings as any)?.restaurantName || 'ваше заведение').trim()

  return (
    <main className="ui-container ui-screen max-w-full overflow-x-hidden !pb-32">
      <PageHeader backHref="/" title="кейтеринг" subtitle="еда для событий без лишних согласований" />

      <section className="relative isolate overflow-hidden rounded-[32px] bg-[#111827] px-5 py-6 text-white shadow-[0_22px_55px_rgba(15,23,42,0.20)] sm:px-8 sm:py-9">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[color:var(--accent)]/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -left-16 h-64 w-64 rounded-full bg-orange-300/20 blur-3xl" />
        <div className="relative max-w-[34rem]">
          <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-white/60">
            <span className="h-2 w-2 rounded-full bg-emerald-300" /> {venueName}
          </div>
          <h1 className="mt-5 text-[38px] font-black leading-[0.9] tracking-[-0.065em] sm:text-[56px]">
            еда, которая<br />держит событие
          </h1>
          <p className="mt-5 max-w-[27rem] text-[15px] font-medium leading-relaxed text-white/70">
            Скажите дату, формат и количество гостей. Мы быстро соберём предложение по меню, объёму и доставке.
          </p>
          <Link
            href="/requests/new?type=catering"
            prefetch={false}
            className="mt-7 inline-flex min-h-13 items-center justify-center rounded-full bg-white px-6 py-3.5 text-[14px] font-extrabold text-slate-950 shadow-[0_10px_24px_rgba(0,0,0,0.16)] transition active:scale-[0.98]"
          >
            получить предложение <span className="ml-2 text-[18px]">↗</span>
          </Link>
          <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-bold text-white/55">
            <span>ответим в Telegram</span><span>без обязательств</span><span>от 1 сообщения</span>
          </div>
        </div>
      </section>

      <section className="mt-5" aria-labelledby="catering-use-cases">
        <div className="mb-3 flex items-end justify-between gap-3 px-1">
          <h2 id="catering-use-cases" className="text-[20px] font-extrabold tracking-[-0.04em]">под какой повод?</h2>
          <span className="text-[11px] font-bold text-[color:var(--muted)]">выберите любой</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {USE_CASES.map((item) => (
            <Link key={item.label} href={`/requests/new?type=${item.label === 'офис' ? 'corporate' : item.label}`} prefetch={false} className="group rounded-[24px] border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] p-4 shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 active:scale-[0.99]">
              <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-[0.14em] text-[color:var(--accent)]"><span>{item.mark}</span><span className="text-[18px] text-[color:var(--muted)] transition group-hover:translate-x-0.5">↗</span></div>
              <div className="mt-6 text-[17px] font-extrabold">{item.label}</div>
              <p className="mt-1 text-[12px] font-medium leading-relaxed text-[color:var(--muted)]">{item.text}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-5 rounded-[28px] border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] p-5 shadow-[var(--shadow-soft)]">
        <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[color:var(--muted)]">как это работает</div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {[
            ['01', 'оставляете вводные', 'Дата, формат, гости и пожелания.'],
            ['02', 'получаете решение', 'Команда уточняет детали и считает объём.'],
            ['03', 'подтверждаете', 'Меню, время и доставка — в одном чате.'],
          ].map(([number, title, text]) => (
            <div key={number} className="border-t border-[color:var(--stroke)] pt-3">
              <div className="text-[12px] font-black text-[color:var(--accent)]">{number}</div>
              <div className="mt-1 text-[15px] font-extrabold">{title}</div>
              <p className="mt-1 text-[12px] font-medium leading-relaxed text-[color:var(--muted)]">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <Link href="/requests/new?type=catering" prefetch={false} className="mt-5 flex min-h-13 w-full items-center justify-center rounded-full bg-[color:var(--primary)] px-5 py-3.5 text-[14px] font-extrabold text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)] transition active:scale-[0.99]">
        рассказать о событии <span className="ml-2 text-[18px]">↗</span>
      </Link>
    </main>
  )
}
