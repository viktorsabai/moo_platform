'use client'

import Link from 'next/link'
import { formatPrice } from '@/lib/utils'
import type { DashboardData } from '@/app/admin/AdminSectionDashboards'
import { OwnerOperationsControls } from '@/components/admin/OwnerOperationsControls'

type Tone = 'neutral' | 'warning' | 'success' | 'accent'

function toneClasses(tone: Tone) {
  if (tone === 'warning') return 'border-amber-200 bg-amber-50/80'
  if (tone === 'success') return 'border-emerald-200 bg-emerald-50/70'
  if (tone === 'accent') return 'border-[color:var(--primary)]/20 bg-[color:var(--primary)]/[0.05]'
  return 'border-[color:var(--stroke)] bg-[color:var(--surface)]'
}

function DecisionCard({
  eyebrow,
  title,
  value,
  detail,
  action,
  href,
  tone = 'neutral',
}: {
  eyebrow: string
  title: string
  value: string
  detail: string
  action: string
  href: string
  tone?: Tone
}) {
  return (
    <article className={`rounded-[24px] border p-4 ${toneClasses(tone)}`}>
      <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[color:var(--muted)]">{eyebrow}</p>
      <div className="mt-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[17px] font-black tracking-[-0.025em] text-[color:var(--text)]">{title}</h2>
          <p className="mt-1 text-[25px] font-black leading-none tracking-[-0.04em] text-[color:var(--text)]">{value}</p>
        </div>
        <span className="mt-1 text-[18px] text-[color:var(--muted)]">›</span>
      </div>
      <p className="mt-2 min-h-[32px] text-[12px] font-medium leading-relaxed text-[color:var(--muted)]">{detail}</p>
      <Link href={href} prefetch={false} className="mt-3 inline-flex min-h-9 items-center rounded-full bg-[color:var(--primary)] px-3.5 py-2 text-[11px] font-extrabold text-white active:scale-[0.98]">{action}</Link>
    </article>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-[18px] bg-[color:var(--surface-strong)] px-3 py-3"><p className="text-[19px] font-black tabular-nums tracking-[-0.03em] text-[color:var(--text)]">{value}</p><p className="mt-1 text-[10px] font-bold text-[color:var(--muted)]">{label}</p></div>
}

export function OwnerCommandCenter({ data }: { data: DashboardData }) {
  const pendingOrders = Number(data.pendingOrdersCount ?? 0)
  const activeOrders = Number(data.activeOrdersCount ?? 0)
  const paymentReviews = Number(data.inboxPendingTotal ?? 0)
  const subscriptionRequests = Number(data.newSubscriptionRequestLeads ?? 0)
  const cateringLeads = Number(data.newServiceLeadsCount ?? 0)
  const campaignCount = Number(data.activeCampaignsCount ?? 0)
  const settings = data.settings
  const menuReady = Boolean(settings?.menuEnabled && data.dishesCount > 0)
  const storefrontReady = Boolean(settings?.storeEnabled)
  const subscriptionsReady = Boolean(settings?.subscriptionEnabled)

  const attentionCount = pendingOrders + paymentReviews + subscriptionRequests + cateringLeads
  const attentionTitle = attentionCount > 0 ? 'есть задачи для решения' : 'всё под контролем'
  const attentionDetail = attentionCount > 0
    ? 'Сначала обработайте входящие задачи, которые влияют на гостя или кухню.'
    : 'Срочных исключений нет. Можно проверить здоровье витрины или заняться ростом.'

  return (
    <section className="space-y-4">
      <header className="rounded-[28px] border border-[color:var(--stroke)] bg-[color:var(--surface)] p-5 shadow-[var(--shadow-soft)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[color:var(--muted)]">сегодня в заведении</p>
            <h1 className="mt-1 text-[28px] font-black tracking-[-0.055em] text-[color:var(--text)]">{attentionTitle}</h1>
            <p className="mt-2 max-w-[520px] text-[13px] font-medium leading-relaxed text-[color:var(--muted)]">{attentionDetail}</p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${data.isOpenNow ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>{data.isOpenNow ? 'открыто' : 'закрыто'}</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric label="новые заказы" value={pendingOrders} />
          <Metric label="в работе" value={activeOrders} />
          <Metric label="запросы" value={subscriptionRequests} />
          <Metric label="кейтеринг" value={cateringLeads} />
        </div>
        {attentionCount > 0 ? (
          <Link href={pendingOrders > 0 || paymentReviews > 0 ? '/admin/operations' : subscriptionRequests > 0 ? '/admin/subscription-leads' : '/admin/leads'} prefetch={false} className="mt-4 flex min-h-11 items-center justify-between rounded-[16px] bg-[color:var(--primary)] px-4 py-3 text-[12px] font-extrabold text-white">
            <span>{pendingOrders > 0 || paymentReviews > 0 ? 'разобрать операционную очередь' : subscriptionRequests > 0 ? 'обработать запросы на подписку' : 'ответить на заявки'}</span><span className="text-[18px]">›</span>
          </Link>
        ) : null}
      </header>

      <OwnerOperationsControls initial={settings} />

      <section>
        <div className="mb-2 flex items-end justify-between px-1">
          <div><p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[color:var(--muted)]">здоровье бизнеса</p><h2 className="mt-1 text-[19px] font-black tracking-[-0.03em] text-[color:var(--text)]">Что происходит сейчас</h2></div>
          <Link href="/admin/visits" prefetch={false} className="text-[11px] font-extrabold text-[color:var(--primary)]">вся аналитика ›</Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <DecisionCard eyebrow="операции" title="Заказы" value={pendingOrders > 0 ? `${pendingOrders} ждут` : `${activeOrders} активных`} detail={paymentReviews > 0 ? `${paymentReviews} операций требуют проверки оплаты.` : 'Новых блокирующих исключений нет.'} action={pendingOrders > 0 || paymentReviews > 0 ? 'разобрать сейчас' : 'открыть очередь'} href="/admin/operations" tone={pendingOrders > 0 || paymentReviews > 0 ? 'warning' : 'success'} />
          <DecisionCard eyebrow="гостевая витрина" title="Что видит гость" value={`${data.dishesCount} блюд`} detail={storefrontReady && menuReady ? 'Витрина опубликована, меню доступно для заказа.' : 'Проверьте публикацию витрины и доступность меню.'} action={storefrontReady && menuReady ? 'посмотреть глазами гостя' : 'исправить витрину'} href={storefrontReady && menuReady ? '/menu' : '/admin/storefront'} tone={storefrontReady && menuReady ? 'success' : 'warning'} />
          <DecisionCard eyebrow="подписки" title="Рационы и клиенты" value={`${data.subscriptionsCount} активных`} detail={subscriptionRequests > 0 ? `${subscriptionRequests} новых запросов ждут ответа.` : subscriptionsReady ? `${data.subscriptionPlansCount} планов доступны для работы.` : 'Приём новых подписок выключен.'} action={subscriptionRequests > 0 ? 'обработать запросы' : 'управлять подписками'} href={subscriptionRequests > 0 ? '/admin/subscription-leads' : '/admin/subscriptions'} tone={subscriptionRequests > 0 ? 'warning' : subscriptionsReady ? 'neutral' : 'warning'} />
          <DecisionCard eyebrow="рост" title="Продажи" value={`${campaignCount} кампаний`} detail={campaignCount > 0 ? 'Проверьте, какие кампании приводят заказы и выручку.' : 'Активных кампаний нет — можно запустить первую проверку спроса.'} action={campaignCount > 0 ? 'оценить результат' : 'создать кампанию'} href="/admin/campaigns" tone={campaignCount > 0 ? 'accent' : 'neutral'} />
        </div>
      </section>

      <section className="rounded-[24px] border border-[color:var(--stroke)] bg-[color:var(--surface)] p-4">
        <div className="flex items-end justify-between gap-3"><div><p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[color:var(--muted)]">business pulse</p><h2 className="mt-1 text-[18px] font-black tracking-[-0.03em] text-[color:var(--text)]">Экономика за сегодня</h2></div><span className="text-[11px] font-bold text-[color:var(--muted)]">7 дней рядом</span></div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4"><Metric label="заказы сегодня" value={data.stats.ordersToday} /><Metric label="выручка сегодня" value={formatPrice(Number(data.stats.revenueToday || 0))} /><Metric label="заказы · 7д" value={data.stats.ordersWeek} /><Metric label="выручка · 7д" value={formatPrice(Number(data.stats.revenueWeek || 0))} /></div>
        <Link href="/admin/visits" prefetch={false} className="mt-3 inline-flex text-[11px] font-extrabold text-[color:var(--primary)]">открыть детали экономики ›</Link>
      </section>

      <nav className="flex flex-wrap gap-2 px-1" aria-label="дополнительные настройки">
        <Link href="/admin/settings" prefetch={false} className="rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface)] px-3.5 py-2 text-[11px] font-extrabold text-[color:var(--text)]">настройки</Link>
        <Link href="/admin/notifications" prefetch={false} className="rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface)] px-3.5 py-2 text-[11px] font-extrabold text-[color:var(--text)]">уведомления</Link>
        <Link href="/admin/leads" prefetch={false} className="rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface)] px-3.5 py-2 text-[11px] font-extrabold text-[color:var(--text)]">кейтеринг</Link>
        <Link href="/menu" prefetch={false} className="rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface)] px-3.5 py-2 text-[11px] font-extrabold text-[color:var(--text)]">гостевой вид</Link>
      </nav>
    </section>
  )
}
