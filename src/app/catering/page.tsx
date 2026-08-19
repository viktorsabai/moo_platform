'use client'

import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { useVenue } from '@/lib/venue-context'

const USE_CASES = [
  { label: 'офис', text: 'регулярные обеды и фуршеты для команды' },
  { label: 'событие', text: 'день рождения, презентация или частный ужин' },
  { label: 'банкет', text: 'меню, сервировка и доставка под формат' },
]

export default function CateringPage() {
  const { settings } = useVenue()
  const venueName = String((settings as any)?.restaurantName || 'ваше заведение').trim()

  return (
    <main className="ui-container ui-screen max-w-full overflow-x-hidden !pb-32">
      <PageHeader backHref="/" title="кейтеринг" subtitle="еда для событий и команд" />

      <section className="relative overflow-hidden rounded-[30px] bg-[color:var(--primary)] p-5 text-white shadow-[var(--shadow-soft)] sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full border border-white/15" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full border border-white/10" />
        <div className="relative max-w-[540px]">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/65">для больших поводов</div>
          <h1 className="mt-3 text-[30px] font-black leading-[1.02] tracking-[-0.04em] sm:text-[42px]">
            соберём еду,<br />которую хочется запомнить
          </h1>
          <p className="mt-4 max-w-[420px] text-[14px] leading-relaxed text-white/78">
            {venueName} поможет с меню для офиса, события или банкета. Расскажите о задаче — команда предложит формат, состав и расчёт.
          </p>
          <Link
            href="/requests/new?type=catering"
            prefetch={false}
            className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-white px-5 text-[14px] font-extrabold text-[color:var(--primary)] transition active:scale-[0.98]"
          >
            обсудить задачу →
          </Link>
        </div>
      </section>

      <section className="mt-4 grid gap-2 sm:grid-cols-3">
        {USE_CASES.map((item) => (
          <div key={item.label} className="ui-surface p-4 transition hover:-translate-y-0.5">
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--muted)]">{item.label}</div>
            <div className="mt-2 text-[14px] font-extrabold leading-snug">{item.text}</div>
          </div>
        ))}
      </section>

      <section className="ui-surface mt-4 p-5">
        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--muted)]">как это работает</div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {[
            ['01', 'расскажите задачу', 'Дата, формат, количество гостей и пожелания.'],
            ['02', 'получите предложение', 'Команда уточнит детали и соберёт понятный расчёт.'],
            ['03', 'подтвердите формат', 'Согласуем меню, время и доставку в Telegram.'],
          ].map(([number, title, text]) => (
            <div key={number}>
              <div className="text-[12px] font-black text-[color:var(--accent)]">{number}</div>
              <div className="mt-1 text-[15px] font-extrabold">{title}</div>
              <p className="ui-muted mt-1 text-[13px] leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <Link
        href="/requests/new?type=catering"
        prefetch={false}
        className="mt-4 flex min-h-12 w-full items-center justify-center rounded-full bg-[color:var(--primary)] px-5 text-[14px] font-extrabold text-white transition active:scale-[0.99]"
      >
        оставить заявку
      </Link>
    </main>
  )
}
