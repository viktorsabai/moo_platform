'use client'

import Link from 'next/link'
import { formatPrice } from '@/lib/utils'
import type { DashboardData } from '@/app/admin/AdminSectionDashboards'

function WorkspaceCard({ title, description, state, href, action, tone = 'neutral' }: { title: string; description: string; state: string; href: string; action: string; tone?: 'neutral' | 'accent' | 'warning' }) {
  const toneClass = tone === 'warning'
    ? 'border-amber-200 bg-amber-50/70'
    : tone === 'accent'
      ? 'border-[color:var(--primary)]/20 bg-[color:var(--primary)]/[0.05]'
      : 'border-[color:var(--stroke)] bg-[color:var(--surface)]'
  return (
    <Link href={href} prefetch={false} className={`group block rounded-[24px] border p-4 transition hover:-translate-y-0.5 active:translate-y-0 ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[16px] font-extrabold tracking-[-0.02em] text-[color:var(--text)]">{title}</h3>
          <p className="mt-1 text-[12px] font-medium leading-relaxed text-[color:var(--muted)]">{description}</p>
        </div>
        <span className="shrink-0 text-[20px] leading-none text-[color:var(--muted)] transition group-hover:translate-x-0.5">›</span>
      </div>
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-black/[0.06] pt-3">
        <span className="text-[12px] font-extrabold text-[color:var(--text)]">{state}</span>
        <span className="text-[11px] font-bold text-[color:var(--primary)]">{action}</span>
      </div>
    </Link>
  )
}

export function OwnerCommandCenter({ data }: { data: DashboardData }) {
  const pendingOrdersCount = Number(data.pendingOrdersCount ?? 0)
  const activeOrdersCount = Number(data.activeOrdersCount ?? 0)
  const newSubscriptionRequestLeads = Number(data.newSubscriptionRequestLeads ?? 0)
  const newServiceLeadsCount = Number(data.newServiceLeadsCount ?? 0)
  const pendingWork = [
    pendingOrdersCount > 0 ? { label: 'новые заказы', hint: `${data.pendingOrdersCount} ждут реакции`, href: '/admin/operations' } : null,
    newSubscriptionRequestLeads > 0 ? { label: 'запросы на подписку', hint: `${newSubscriptionRequestLeads} новых`, href: '/admin/subscription-leads' } : null,
    newServiceLeadsCount > 0 ? { label: 'заявки на кейтеринг', hint: `${newServiceLeadsCount} новых`, href: '/admin/leads' } : null,
    data.settings?.subscriptionEnabled === false ? { label: 'подписки выключены', hint: 'включите витрину, если готовы принимать заявки', href: '/admin/subscriptions' } : null,
  ].filter(Boolean) as { label: string; hint: string; href: string }[]

  const opportunities = [
    newServiceLeadsCount > 0 ? { title: 'Ответьте на заявки по кейтерингу', text: 'Быстрый ответ повышает шанс перевести запрос в заказ.', href: '/admin/leads', action: 'открыть pipeline' } : null,
    newSubscriptionRequestLeads > 0 && data.subscriptionPlansCount === 0 ? { title: 'У вас есть спрос на подписку', text: 'Соберите первый план из готового пресета и отправьте его на витрину.', href: '/admin/subscriptions', action: 'собрать план' } : null,
    data.bannersCount === 0 ? { title: 'Оформите первый экран витрины', text: 'Добавьте один понятный hero-баннер, чтобы объяснить гостю, что заказать.', href: '/admin/banners', action: 'настроить витрину' } : null,
  ].filter(Boolean).slice(0, 3) as { title: string; text: string; href: string; action: string }[]

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3 px-1">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[color:var(--muted)]">рабочий центр</p>
          <h1 className="mt-1 text-[28px] font-black tracking-[-0.05em] text-[color:var(--text)]">сегодня в заведении</h1>
        </div>
        <Link href="/menu" prefetch={false} className="rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface)] px-3 py-2 text-[11px] font-extrabold text-[color:var(--text)]">гостевой вид</Link>
      </div>

      <div className="rounded-[28px] border border-[color:var(--stroke)] bg-[color:var(--surface)] p-5 shadow-[var(--shadow-soft)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[color:var(--muted)]">{data.restaurantName}</p>
            <h2 className="mt-1 text-[21px] font-black tracking-[-0.03em] text-[color:var(--text)]">{pendingWork.length > 0 ? 'есть задачи для решения' : 'операционный день под контролем'}</h2>
            <p className="mt-1 max-w-[520px] text-[13px] font-medium leading-relaxed text-[color:var(--muted)]">{pendingWork.length > 0 ? 'Сначала разберите входящие задачи, затем переходите к развитию витрины и продаж.' : 'Заказы, витрина и входящие обращения сейчас не требуют срочной реакции.'}</p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${data.isOpenNow ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>{data.isOpenNow ? 'открыто' : 'закрыто'}</span>
        </div>
        {pendingWork.length > 0 ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {pendingWork.slice(0, 4).map((item) => <Link key={item.href + item.label} href={item.href} prefetch={false} className="flex items-center justify-between gap-3 rounded-[16px] bg-[color:var(--surface-strong)] px-3 py-3"><span><span className="block text-[13px] font-extrabold text-[color:var(--text)]">{item.label}</span><span className="mt-0.5 block text-[11px] font-medium text-[color:var(--muted)]">{item.hint}</span></span><span className="text-[18px] text-[color:var(--muted)]">›</span></Link>)}
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2 border-t border-[color:var(--stroke)] pt-4">
          <Link href="/admin/operations" prefetch={false} className="rounded-full bg-[color:var(--primary)] px-4 py-2.5 text-[12px] font-extrabold text-white">открыть операции</Link>
          <Link href="/admin/storefront" prefetch={false} className="rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface)] px-4 py-2.5 text-[12px] font-extrabold text-[color:var(--text)]">проверить витрину</Link>
        </div>
      </div>

      <div className="rounded-[28px] border border-[color:var(--stroke)] bg-[color:var(--surface)] p-4">
        <div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[color:var(--muted)]">business pulse</p><h2 className="mt-1 text-[18px] font-black tracking-[-0.03em] text-[color:var(--text)]">экономика за сегодня</h2></div><Link href="/admin/visits" prefetch={false} className="text-[11px] font-extrabold text-[color:var(--primary)]">аналитика ›</Link></div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[['заказы', data.stats.ordersToday], ['выручка', formatPrice(Number(data.stats.revenueToday || 0))], ['заказы · 7д', data.stats.ordersWeek], ['выручка · 7д', formatPrice(Number(data.stats.revenueWeek || 0))]].map(([label, value]) => <div key={String(label)} className="rounded-[18px] bg-[color:var(--surface-strong)] px-3 py-3"><div className="text-[18px] font-black tabular-nums text-[color:var(--text)]">{value}</div><div className="mt-1 text-[10px] font-bold text-[color:var(--muted)]">{label}</div></div>)}
        </div>
      </div>

      {opportunities.length > 0 ? <div><div className="mb-2 flex items-center justify-between px-1"><h2 className="text-[16px] font-black tracking-[-0.02em] text-[color:var(--text)]">что можно улучшить</h2><span className="text-[11px] font-bold text-[color:var(--muted)]">до 3 шагов</span></div><div className="grid gap-2 sm:grid-cols-3">{opportunities.map((item) => <Link key={item.href} href={item.href} prefetch={false} className="rounded-[22px] border border-[color:var(--stroke)] bg-[color:var(--surface)] p-4"><p className="text-[14px] font-extrabold text-[color:var(--text)]">{item.title}</p><p className="mt-1 text-[12px] font-medium leading-relaxed text-[color:var(--muted)]">{item.text}</p><span className="mt-3 block text-[11px] font-extrabold text-[color:var(--primary)]">{item.action} ›</span></Link>)}</div></div> : null}

      <div><div className="mb-2 px-1"><h2 className="text-[16px] font-black tracking-[-0.02em] text-[color:var(--text)]">рабочие пространства</h2><p className="mt-1 text-[12px] font-medium text-[color:var(--muted)]">Каждый раздел отвечает за одну задачу бизнеса.</p></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <WorkspaceCard title="Операции" description="Заказы, очередь, статусы и исключения." state={activeOrdersCount > 0 ? `${activeOrdersCount} в работе` : 'очередь пуста'} href="/admin/operations" action="открыть очередь" tone={pendingOrdersCount > 0 ? 'warning' : 'neutral'} />
        <WorkspaceCard title="Гостевая витрина" description="Меню, главная, доступность и preview глазами гостя." state={`${data.dishesCount} блюд · ${data.bannersCount} баннеров`} href="/admin/storefront" action="открыть витрину" tone="accent" />
        <WorkspaceCard title="Подписки" description="Запросы, планы, клиенты и ближайшие доставки." state={`${data.subscriptionPlansCount} планов · ${data.subscriptionsCount} активных`} href="/admin/subscriptions" action="управлять подписками" />
        <WorkspaceCard title="Рост" description="Кампании, attribution, промо и вклад в выручку." state={`${data.activeCampaignsCount} активных кампаний`} href="/admin/campaigns" action="открыть рост" />
        <WorkspaceCard title="Кейтеринг" description="Заявки на события, корпоративы и follow-up." state={`${newServiceLeadsCount} новых заявок`} href="/admin/leads" action="открыть pipeline" />
        <WorkspaceCard title="Команда и система" description="Роли, Telegram-уведомления и расширенные настройки." state={`${data.teamMembers.length} участников`} href="/admin/settings" action="настроить доступы" />
      </div></div>
    </section>
  )
}
