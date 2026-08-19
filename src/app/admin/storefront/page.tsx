'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { OwnerWorkspaceHeader } from '@/components/admin/OwnerWorkspaceHeader'

type Dish = { id: string; name: string; isAvailable?: boolean; image?: string | null; price?: number; category?: { name?: string } | null }
type Banner = { id: string; title?: string | null; isActive?: boolean; showOnHome?: boolean; href?: string | null }

type Settings = { menuEnabled: boolean; storeEnabled: boolean; subscriptionEnabled: boolean; isOpenOverride?: boolean | null; openTime?: string | null; closeTime?: string | null }

export default function StorefrontWorkspacePage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [dishes, setDishes] = useState<Dish[]>([])
  const [banners, setBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch('/api/admin/settings', { cache: 'no-store', credentials: 'include' }).then((res) => res.json()),
      fetch('/api/admin/menu/dishes', { cache: 'no-store', credentials: 'include' }).then((res) => res.json()),
      fetch('/api/admin/banners', { cache: 'no-store', credentials: 'include' }).then((res) => res.json()),
    ]).then(([settingsData, dishesData, bannersData]) => {
      if (cancelled) return
      if (!settingsData?.ok) throw new Error(settingsData?.error || 'не удалось загрузить настройки витрины')
      setSettings({
        menuEnabled: Boolean(settingsData.settings?.menuEnabled),
        storeEnabled: Boolean(settingsData.settings?.storeEnabled),
        subscriptionEnabled: Boolean(settingsData.settings?.subscriptionEnabled),
        isOpenOverride: settingsData.settings?.isOpenOverride,
        openTime: settingsData.settings?.openTime,
        closeTime: settingsData.settings?.closeTime,
      })
      setDishes(Array.isArray(dishesData?.dishes) ? dishesData.dishes : [])
      setBanners(Array.isArray(bannersData?.banners) ? bannersData.banners : Array.isArray(bannersData) ? bannersData : [])
    }).catch((err) => {
      if (!cancelled) setError(err instanceof Error ? err.message : 'не удалось загрузить витрину')
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  const unavailableDishes = useMemo(() => dishes.filter((dish) => dish.isAvailable === false), [dishes])
  const missingImages = useMemo(() => dishes.filter((dish) => !String(dish.image || '').trim()), [dishes])
  const activeBanners = useMemo(() => banners.filter((banner) => banner.isActive !== false), [banners])
  const healthItems = [
    { label: 'меню доступно гостям', value: settings?.menuEnabled ? 'включено' : 'выключено', ok: Boolean(settings?.menuEnabled), href: '/admin/settings' },
    { label: 'позиции в меню', value: `${dishes.length} всего · ${unavailableDishes.length} скрыто`, ok: dishes.length > 0 && unavailableDishes.length < dishes.length, href: '/admin/store' },
    { label: 'изображения блюд', value: missingImages.length > 0 ? `${missingImages.length} без фото` : 'все заполнены', ok: missingImages.length === 0, href: '/admin/store' },
    { label: 'главная витрина', value: `${activeBanners.length} активных баннеров`, ok: activeBanners.length > 0, href: '/admin/banners' },
  ]

  return (
    <main className="ui-container ui-screen min-w-0 max-w-full overflow-x-hidden !pb-20">
      <OwnerWorkspaceHeader title="гостевая витрина" subtitle="Управляйте тем, что гость видит, выбирает и может заказать. Сначала состояние витрины, затем контент и редкие настройки." primaryHref="/menu" primaryLabel="открыть гостевой вид" />

      {error ? <div className="rounded-[22px] border border-rose-200 bg-rose-50 p-4 text-[13px] font-semibold text-rose-900">{error}</div> : null}
      {loading ? <div className="rounded-[24px] border border-[color:var(--stroke)] bg-[color:var(--surface)] p-5 text-[13px] font-semibold text-[color:var(--muted)]">проверяем состояние витрины…</div> : null}

      {!loading && !error ? <>
        <section className="rounded-[28px] border border-[color:var(--stroke)] bg-[color:var(--surface)] p-5 shadow-[var(--shadow-soft)]">
          <div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[color:var(--muted)]">состояние для гостя</p><h2 className="mt-1 text-[21px] font-black tracking-[-0.03em] text-[color:var(--text)]">{settings?.menuEnabled ? 'витрина принимает заказы' : 'витрина сейчас скрыта'}</h2><p className="mt-1 text-[13px] font-medium leading-relaxed text-[color:var(--muted)]">{settings?.menuEnabled ? 'Меню доступно в Telegram Mini App. Проверьте контент глазами гостя перед публикацией изменений.' : 'Включите меню после того, как добавите хотя бы одну доступную позицию и способ оплаты.'}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${settings?.menuEnabled ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>{settings?.menuEnabled ? 'live' : 'hidden'}</span></div><div className="mt-4 flex flex-wrap gap-2 border-t border-black/[0.06] pt-4"><Link href="/menu" prefetch={false} className="rounded-full bg-[color:var(--primary)] px-4 py-2.5 text-[11px] font-extrabold text-white">посмотреть глазами гостя</Link><Link href="/admin/store" prefetch={false} className="rounded-full border border-[color:var(--stroke)] px-4 py-2.5 text-[11px] font-extrabold text-[color:var(--text)]">редактировать меню</Link></div>
        </section>

        <section className="mt-4"><div className="mb-2 px-1"><h2 className="text-[16px] font-black tracking-[-0.02em] text-[color:var(--text)]">здоровье витрины</h2><p className="mt-1 text-[12px] font-medium text-[color:var(--muted)]">Каждый сигнал ведёт в конкретное место, где его можно исправить.</p></div><div className="grid gap-2 sm:grid-cols-2">{healthItems.map((item) => <Link key={item.label} href={item.href} prefetch={false} className="flex items-center justify-between gap-3 rounded-[22px] border border-[color:var(--stroke)] bg-[color:var(--surface)] p-4"><span><span className="block text-[13px] font-extrabold text-[color:var(--text)]">{item.label}</span><span className="mt-1 block text-[12px] font-medium text-[color:var(--muted)]">{item.value}</span></span><span className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.ok ? 'bg-emerald-500' : 'bg-amber-400'}`} aria-label={item.ok ? 'готово' : 'нужно проверить'} /></Link>)}</div></section>

        <section className="mt-4 grid gap-3 sm:grid-cols-3"><Link href="/admin/store" prefetch={false} className="rounded-[24px] border border-[color:var(--stroke)] bg-[color:var(--surface)] p-4"><p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[color:var(--muted)]">контент</p><p className="mt-2 text-[23px] font-black text-[color:var(--text)]">{dishes.length}</p><p className="mt-1 text-[12px] font-bold text-[color:var(--muted)]">блюд в редакторе</p><span className="mt-4 block text-[11px] font-extrabold text-[color:var(--primary)]">открыть каталог ›</span></Link><Link href="/admin/banners" prefetch={false} className="rounded-[24px] border border-[color:var(--stroke)] bg-[color:var(--surface)] p-4"><p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[color:var(--muted)]">главная</p><p className="mt-2 text-[23px] font-black text-[color:var(--text)]">{activeBanners.length}</p><p className="mt-1 text-[12px] font-bold text-[color:var(--muted)]">активных surface cards</p><span className="mt-4 block text-[11px] font-extrabold text-[color:var(--primary)]">управлять главной ›</span></Link><Link href="/admin/settings" prefetch={false} className="rounded-[24px] border border-[color:var(--stroke)] bg-[color:var(--surface)] p-4"><p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[color:var(--muted)]">advanced</p><p className="mt-2 text-[23px] font-black text-[color:var(--text)]">{settings?.storeEnabled ? 'live' : 'off'}</p><p className="mt-1 text-[12px] font-bold text-[color:var(--muted)]">магазин и системные настройки</p><span className="mt-4 block text-[11px] font-extrabold text-[color:var(--primary)]">открыть настройки ›</span></Link></section>
      </> : null}
    </main>
  )
}
