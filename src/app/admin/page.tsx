import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getRestaurantContext, requireRestaurantAdmin } from '@/lib/restaurant-context'
import { AdminDashboardSections } from '@/app/admin/AdminDashboardSections'
import { AdminOwnerInbox } from '@/components/admin/AdminOwnerInbox'
import { countHotGuestsFromActivity, inboxPendingTotal } from '@/lib/admin-dashboard-metrics'
import { Card } from '@/components/ui/Card'

const ARCHIVE_CATEGORY_SLUG = '__archive'

function AdminNoAccess() {
  return (
    <main className="ui-container ui-screen !pb-20">
      <Card variant="surfaceStrong" className="p-5">
        <div className="text-[14px] font-semibold text-[color:var(--text)]">нет доступа</div>
        <div className="mt-1 text-[13px] font-medium text-[color:var(--muted)]">у этого аккаунта нет прав на управление заведением</div>
        <p className="mt-3 text-[12px] text-[color:var(--muted)]">
          Если вы владелец: создайте заведение в приложении (Профиль → Создать заведение) или попросите добавить вас в команду заведения.
        </p>
        <Link href="/profile" prefetch={false} scroll={false} className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-full bg-[color:var(--primary)] px-6 text-[14px] font-semibold text-white transition active:opacity-90">
          в профиль
        </Link>
      </Card>
    </main>
  )
}

export default async function AdminHomePage() {
  let ctx: Awaited<ReturnType<typeof getRestaurantContext>> = null
  try {
    ctx = await getRestaurantContext()
  } catch {
    return <AdminNoAccess />
  }

  const platformRole = ctx?.platformRole
  const memberRole = ctx?.memberRole
  const ok = Boolean(ctx?.userId && (platformRole === 'SUPERADMIN' || memberRole === 'OWNER' || memberRole === 'ADMIN'))

  if (!ok) {
    return <AdminNoAccess />
  }

  let admin: NonNullable<typeof ctx>
  try {
    admin = requireRestaurantAdmin(ctx)
  } catch {
    return <AdminNoAccess />
  }

  type RestaurantRow = { id: string; name: string; slug: string } | null
  type SettingsRow = { deliveryFee: number; freeDeliveryFrom: number; openTime: string; closeTime: string; menuEnabled: boolean; storeEnabled: boolean; subscriptionEnabled: boolean; isOpenOverride?: boolean | null } | null
  type TeamMemberRow = { id: string; role: string; user?: { name: string | null; telegramUsername: string | null } }
  type DashboardCountsRow = {
    teamCount: number
    storeCount: number
    activeStoreCount: number
    menuCategoriesCount: number
    dishesCount: number
    availableDishesCount: number
    storeCategoriesCount: number
    bannersCount: number
    subscriptionPlansCount: number
    subscriptionsCount: number
    activeOrdersCount: number
    pendingOrdersCount: number
    pendingSubscriptionsCount: number
    ordersToday: number
    ordersWeek: number
    revenueToday: number
    revenueWeek: number
    newServiceLeadsCount: number
    activeCampaignsCount: number
    visitsCount: number
    newVisitsCount: number
    newVisitorsCount: number
    visitorsCount: number
    cartEventsCount: number
  }
  type ActivityEventRow = {
    id: string
    type: string
    path: string | null
    createdAt: Date
    userName: string | null
    telegramUsername: string | null
    telegramId: string | null
  }

  const settled = await Promise.allSettled([
    prisma.restaurant.findUnique({
      where: { id: admin.restaurantId },
      select: { id: true, name: true, slug: true },
    }),
    prisma.appSettings.findUnique({
      where: { restaurantId: admin.restaurantId },
      select: {
        deliveryFee: true,
        freeDeliveryFrom: true,
        isOpenOverride: true,
        openTime: true,
        closeTime: true,
        menuEnabled: true,
        storeEnabled: true,
        subscriptionEnabled: true,
      },
    }),
    prisma.$queryRawUnsafe<DashboardCountsRow[]>(
      `SELECT
         (SELECT COUNT(*)::int FROM "RestaurantMember" WHERE "restaurantId" = $1) AS "teamCount",
         (SELECT COUNT(*)::int FROM "StoreProduct" WHERE "restaurantId" = $1) AS "storeCount",
         (SELECT COUNT(*)::int FROM "StoreProduct" WHERE "restaurantId" = $1 AND "isActive" = true) AS "activeStoreCount",
         (SELECT COUNT(*)::int FROM "Category" WHERE "restaurantId" = $1 AND "slug" <> $2) AS "menuCategoriesCount",
         (SELECT COUNT(*)::int FROM "Dish" WHERE "restaurantId" = $1) AS "dishesCount",
         (SELECT COUNT(*)::int FROM "Dish" WHERE "restaurantId" = $1 AND "isAvailable" = true) AS "availableDishesCount",
         (SELECT COUNT(*)::int FROM "StoreCategory" WHERE "restaurantId" = $1) AS "storeCategoriesCount",
         (SELECT COUNT(*)::int FROM "HomeBanner" WHERE "restaurantId" = $1) AS "bannersCount",
         (SELECT COUNT(*)::int FROM "SubscriptionPlanTemplate" WHERE "restaurantId" = $1) AS "subscriptionPlansCount",
         (SELECT COUNT(*)::int FROM "Subscription" WHERE "restaurantId" = $1) AS "subscriptionsCount",
         (SELECT COUNT(*)::int FROM "Order" WHERE "restaurantId" = $1 AND "status" IN ('PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY')) AS "activeOrdersCount",
         (SELECT COUNT(*)::int FROM "Order" WHERE "restaurantId" = $1 AND "status" = 'PENDING') AS "pendingOrdersCount",
         (SELECT COUNT(*)::int FROM "Subscription" WHERE "restaurantId" = $1 AND "status" = 'PENDING') AS "pendingSubscriptionsCount",
         (SELECT COUNT(*)::int FROM "Order" WHERE "restaurantId" = $1 AND "createdAt" >= date_trunc('day', now())) AS "ordersToday",
         (SELECT COUNT(*)::int FROM "Order" WHERE "restaurantId" = $1 AND "createdAt" >= now() - INTERVAL '7 days') AS "ordersWeek",
         (SELECT COALESCE(SUM("totalAmount"), 0)::float FROM "Order" WHERE "restaurantId" = $1 AND "createdAt" >= date_trunc('day', now())) AS "revenueToday",
         (SELECT COALESCE(SUM("totalAmount"), 0)::float FROM "Order" WHERE "restaurantId" = $1 AND "createdAt" >= now() - INTERVAL '7 days') AS "revenueWeek",
         (SELECT COUNT(*)::int FROM "ServiceLead" WHERE "restaurantId" = $1 AND "status" = 'NEW') AS "newServiceLeadsCount",
         (SELECT COUNT(*)::int FROM "Campaign" WHERE "restaurantId" = $1 AND "status" = 'ACTIVE' AND "visibility" = 'PUBLIC') AS "activeCampaignsCount",
         (SELECT COUNT(*) FILTER (WHERE "type" = 'VIEW_PAGE')::int FROM "UserActivityEvent" WHERE "restaurantId" = $1 AND "createdAt" >= now() - INTERVAL '7 days') AS "visitsCount",
         (SELECT COUNT(*) FILTER (WHERE "type" = 'VIEW_PAGE')::int FROM "UserActivityEvent" WHERE "restaurantId" = $1 AND "createdAt" >= now() - INTERVAL '24 hours') AS "newVisitsCount",
         (SELECT COUNT(DISTINCT COALESCE("userId", "telegramId"))::int FROM "UserActivityEvent" WHERE "restaurantId" = $1 AND "createdAt" >= now() - INTERVAL '24 hours' AND "type" = 'VIEW_PAGE' AND COALESCE("userId", "telegramId") IS NOT NULL) AS "newVisitorsCount",
         (SELECT COUNT(DISTINCT COALESCE("userId", "telegramId")) FILTER (WHERE COALESCE("userId", "telegramId") IS NOT NULL)::int FROM "UserActivityEvent" WHERE "restaurantId" = $1 AND "createdAt" >= now() - INTERVAL '7 days') AS "visitorsCount",
         (SELECT COUNT(*) FILTER (WHERE "type" IN ('CART_WITH_ITEMS', 'ADD_TO_CART', 'START_CHECKOUT'))::int FROM "UserActivityEvent" WHERE "restaurantId" = $1 AND "createdAt" >= now() - INTERVAL '7 days') AS "cartEventsCount"`,
      admin.restaurantId,
      ARCHIVE_CATEGORY_SLUG
    ),
    prisma.restaurantMember.findMany({
      where: { restaurantId: admin.restaurantId },
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true,
        role: true,
        user: { select: { name: true, telegramUsername: true } },
      },
    }),
    prisma.$queryRawUnsafe<Array<{ n: number }>>(
      `SELECT COUNT(*)::int AS n
       FROM "SubscriptionRequestLead"
       WHERE "restaurantId" = $1 AND "status" = 'NEW'`,
      admin.restaurantId
    ),
    prisma.$queryRawUnsafe<ActivityEventRow[]>(
      `SELECT
         e."id",
         e."type",
         e."path",
         e."createdAt",
         u."name" AS "userName",
         u."telegramUsername" AS "telegramUsername",
         e."telegramId"
       FROM "UserActivityEvent" e
       LEFT JOIN "User" u ON u."id" = e."userId"
       WHERE e."restaurantId" = $1
       ORDER BY e."createdAt" DESC
       LIMIT 5`,
      admin.restaurantId
    ),
  ])

  const restaurant: RestaurantRow = settled[0].status === 'fulfilled' ? settled[0].value : null
  const settings: SettingsRow = settled[1].status === 'fulfilled' ? settled[1].value : null
  const counts = settled[2].status === 'fulfilled'
    ? (settled[2].value?.[0] ?? null)
    : null
  const teamCount = Number(counts?.teamCount ?? 0)
  const storeCount = Number(counts?.storeCount ?? 0)
  const activeStoreCount = Number(counts?.activeStoreCount ?? storeCount)
  const stats = {
    ordersToday: Number(counts?.ordersToday ?? 0),
    revenueToday: Number(counts?.revenueToday ?? 0),
    ordersWeek: Number(counts?.ordersWeek ?? 0),
    revenueWeek: Number(counts?.revenueWeek ?? 0),
  }
  const menuCategoriesCount = Number(counts?.menuCategoriesCount ?? 0)
  const dishesCount = Number(counts?.dishesCount ?? 0)
  const availableDishesCount = Number(counts?.availableDishesCount ?? dishesCount)
  const storeCategoriesCount = Number(counts?.storeCategoriesCount ?? 0)
  const bannersCount = Number(counts?.bannersCount ?? 0)
  const subscriptionPlansCount = Number(counts?.subscriptionPlansCount ?? 0)
  const subscriptionsCount = Number(counts?.subscriptionsCount ?? 0)
  const teamMembers: TeamMemberRow[] = settled[3].status === 'fulfilled' ? settled[3].value : []
  const activeOrdersCount = Number(counts?.activeOrdersCount ?? 0)
  const pendingOrdersCount = Number(counts?.pendingOrdersCount ?? 0)
  const pendingSubscriptionsCount = Number(counts?.pendingSubscriptionsCount ?? 0)
  const newLeadsCount = settled[4].status === 'fulfilled'
    ? Number((settled[4].value?.[0] as any)?.n ?? 0)
    : 0
  const newServiceLeadsCount = Number(counts?.newServiceLeadsCount ?? 0)
  const activeCampaignsCount = Number(counts?.activeCampaignsCount ?? 0)
  const activityStats = {
    views: Number(counts?.visitsCount ?? 0),
    newViews: Number(counts?.newVisitsCount ?? 0),
    newVisitors: Number(counts?.newVisitorsCount ?? 0),
    visitors: Number(counts?.visitorsCount ?? 0),
    carts: Number(counts?.cartEventsCount ?? 0),
  }
  const recentActivityEvents = settled[5].status === 'fulfilled' ? settled[5].value : []
  const hotGuestsCount = countHotGuestsFromActivity(recentActivityEvents)
  const inboxTotal = inboxPendingTotal({
    pendingOrders: pendingOrdersCount,
    pendingSubscriptions: pendingSubscriptionsCount,
    newServiceLeads: newServiceLeadsCount,
    newSubscriptionRequestLeads: newLeadsCount,
  })

  // Never block owner cabinet on a transient DB read failure for restaurant row.
  // We already have trusted context with restaurantId, so render degraded dashboard instead of hard error screen.
  const safeRestaurant = restaurant ?? {
    id: admin.restaurantId,
    name: 'заведение',
    slug: 'venue',
  }

  const settingsDefaults = {
    openTime: '10:00',
    closeTime: '22:00',
    deliveryFee: 100,
    freeDeliveryFrom: 500,
    menuEnabled: false,
    storeEnabled: true,
    subscriptionEnabled: false,
    isOpenOverride: null as boolean | null,
  }
  const resolvedSettings = settings
    ? {
        openTime: String(settings.openTime ?? settingsDefaults.openTime),
        closeTime: String(settings.closeTime ?? settingsDefaults.closeTime),
        deliveryFee: Number(settings.deliveryFee ?? settingsDefaults.deliveryFee),
        freeDeliveryFrom: Number(settings.freeDeliveryFrom ?? settingsDefaults.freeDeliveryFrom),
        menuEnabled: Boolean(settings.menuEnabled),
        storeEnabled: Boolean(settings.storeEnabled ?? true),
        subscriptionEnabled: Boolean(settings.subscriptionEnabled),
        isOpenOverride:
          typeof settings.isOpenOverride === 'boolean' ? settings.isOpenOverride : null,
      }
    : settingsDefaults

  const computeIsOpenNow = () => {
    if (typeof resolvedSettings.isOpenOverride === 'boolean') return resolvedSettings.isOpenOverride
    const now = new Date()
    const [oh, om] = String(resolvedSettings.openTime).split(':').map((x) => Number(x))
    const [ch, cm] = String(resolvedSettings.closeTime).split(':').map((x) => Number(x))
    if (!Number.isFinite(oh) || !Number.isFinite(om) || !Number.isFinite(ch) || !Number.isFinite(cm)) return true
    const mins = now.getHours() * 60 + now.getMinutes()
    const open = oh * 60 + om
    const close = ch * 60 + cm
    return open <= close ? mins >= open && mins < close : mins >= open || mins < close
  }

  const dashboardData = {
    restaurantId: safeRestaurant.id ?? null,
    restaurantName: safeRestaurant.name ?? '—',
    settings: resolvedSettings,
    isOpenNow: computeIsOpenNow(),
    menuCategoriesCount: menuCategoriesCount ?? 0,
    dishesCount: dishesCount ?? 0,
    menuItemsCount: availableDishesCount + activeStoreCount,
    storeCategoriesCount: storeCategoriesCount ?? 0,
    storeProductsCount: storeCount ?? 0,
    bannersCount: bannersCount ?? 0,
    subscriptionPlansCount: subscriptionPlansCount ?? 0,
    subscriptionsCount: subscriptionsCount ?? 0,
    teamMembers: (teamMembers ?? []).map((m) => ({
      id: String(m?.id ?? ''),
      role: String(m?.role ?? 'STAFF'),
      name: String((m as any)?.user?.name ?? (m as any)?.user?.telegramUsername ?? '—'),
    })),
    stats: {
      ordersToday: Number(stats?.ordersToday ?? 0),
      ordersWeek: Number(stats?.ordersWeek ?? 0),
      revenueToday: Number(stats?.revenueToday ?? 0),
      revenueWeek: Number(stats?.revenueWeek ?? 0),
    },
    activeOrdersCount,
    pendingOrdersCount,
    pendingSubscriptionsCount,
    inboxPendingTotal: inboxTotal,
    hotGuestsCount,
    activeCampaignsCount,
    newSubscriptionRequestLeads: newLeadsCount,
    newServiceLeadsCount,
    visitsCount: Number(activityStats.views ?? 0),
    newVisitsCount: Number(activityStats.newViews ?? 0),
    newVisitorsCount: Number(activityStats.newVisitors ?? 0),
    visitorsCount: Number(activityStats.visitors ?? 0),
    cartEventsCount: Number(activityStats.carts ?? 0),
    recentActivityEvents: recentActivityEvents.map((event) => ({
      id: event.id,
      type: event.type,
      path: event.path,
      userName: event.userName,
      telegramUsername: event.telegramUsername,
      telegramId: event.telegramId,
      createdAt: event.createdAt.toISOString(),
    })),
  }

  const isOpenNow = computeIsOpenNow()

  const sectionsBase = [
    {
      group: 'venue' as const,
      id: 'venue',
      title: 'Профиль и режим',
      hint: isOpenNow ? 'принимаем заказы' : 'на паузе или вне часов',
      href: '/admin/venue',
      summary: 'Название, часы, пауза, доставка.',
      linkLabel: 'Настройки заведения',
      icon: 'venue' as const,
    },
    {
      group: 'venue' as const,
      id: 'notifications',
      title: 'Telegram',
      hint: 'бот · уведомления · QR',
      href: '/admin/qr',
      summary: 'Подключение бота и кто получает алерты.',
      linkLabel: 'Бот и QR',
      icon: 'platform' as const,
    },
    {
      group: 'venue' as const,
      id: 'team',
      title: 'Команда',
      hint: teamCount > 1 ? `${teamCount} участников` : 'сотрудники',
      href: '/admin/team',
      summary: 'Роли и Telegram — без привязки уведомления в чат не придут.',
      linkLabel: 'Управление командой',
      icon: 'team' as const,
    },
    {
      group: 'showcase' as const,
      id: 'banners',
      title: 'Главная',
      hint:
        activeCampaignsCount > 0
          ? `${activeCampaignsCount} активных акций`
          : bannersCount > 0
            ? `${bannersCount} баннеров`
            : 'баннеры и промокоды',
      href: '/admin/banners',
      summary: 'Баннеры на главной и публичные промокампании.',
      linkLabel: 'Перейти к деталям',
      icon: 'banners' as const,
      badgeCount: activeCampaignsCount,
      badgeLabel: `активных акций: ${activeCampaignsCount}`,
      badgeTone: 'info' as const,
    },
    {
      group: 'showcase' as const,
      id: 'store',
      title: 'Меню и товары',
      hint: availableDishesCount > 0 || activeStoreCount > 0
        ? [availableDishesCount > 0 && `${availableDishesCount} блюд`, activeStoreCount > 0 && `${activeStoreCount} товаров`].filter(Boolean).join(' · ')
        : 'товары и блюда',
      href: '/admin/store',
      summary: 'Готовые блюда и товары магазина. Категории, позиции, варианты.',
      linkLabel: 'Перейти к деталям',
      icon: 'store' as const,
    },
    {
      group: 'operations' as const,
      id: 'orders',
      title: 'Заказы',
      hint:
        pendingOrdersCount > 0
          ? `${pendingOrdersCount} новых · ${activeOrdersCount} в работе`
          : activeOrdersCount > 0
            ? `${activeOrdersCount} активных`
            : 'новые и в работе',
      href: '/admin/orders',
      summary: 'Список заказов, статусы и выручка.',
      linkLabel: 'Перейти к деталям',
      icon: 'orders' as const,
    },
    {
      group: 'subscriptions' as const,
      id: 'subscribers',
      title: 'Подписчики',
      hint: pendingSubscriptionsCount > 0
        ? `${pendingSubscriptionsCount} на подтверждении`
        : subscriptionsCount > 0
          ? `${subscriptionsCount} подписок`
          : 'CRM и сводка на кухню',
      href: '/admin/subscriptions/clients',
      summary: 'Клиенты с подписками: подтверждения, доставки, заказ на кухню.',
      linkLabel: 'Открыть подписчиков',
      icon: 'subscriptions' as const,
    },
    {
      group: 'subscriptions' as const,
      id: 'subscription-plans',
      title: 'Планы подписки',
      hint: settings?.subscriptionEnabled
        ? `${subscriptionPlansCount} шаблонов`
        : 'выключены в каталоге',
      href: '/admin/subscriptions',
      summary: 'Конструктор планов и экономика рационов.',
      linkLabel: 'Конструктор планов',
      icon: 'subscriptions' as const,
    },
    {
      group: 'subscriptions' as const,
      id: 'subscription-leads',
      title: 'Запросы «хочу подписку»',
      hint: newLeadsCount > 0 ? `${newLeadsCount} новых` : 'до оформления плана',
      href: '/admin/subscription-leads',
      summary:
        'До оформления плана: гость нажал «хочу подписку». Отличается от «Подписчиков», где уже есть заявка PENDING или ACTIVE.',
      linkLabel: 'Открыть запросы',
      icon: 'leads' as const,
    },
    {
      group: 'requests' as const,
      id: 'leads',
      title: 'Кейтеринг и события',
      hint: newServiceLeadsCount > 0 ? `${newServiceLeadsCount} новых` : 'заявки и запросы',
      href: '/admin/leads',
      summary: 'Входящие заявки с главной: кейтеринг, банкеты, корпоративы и особые запросы.',
      linkLabel: 'Перейти к заявкам',
      icon: 'leads' as const,
    },
    {
      group: 'analytics' as const,
      id: 'visits',
      title: 'Посещаемость',
      hint: Number(activityStats.newViews ?? 0) > 0
        ? `${Number(activityStats.newViews ?? 0)} новых за 24ч`
        : Number(activityStats.views ?? 0) > 0
          ? `${Number(activityStats.views ?? 0)} просмотров за 7 дней`
        : 'просмотры, корзины, пользователи',
      href: '/admin/visits',
      summary: 'Кто заходил, какие страницы смотрели и где появлялись корзины.',
      linkLabel: 'Открыть аналитику',
      icon: 'analytics' as const,
      badgeCount: Number(activityStats.newViews ?? 0),
      badgeLabel: `новых посещений за 24 часа: ${Number(activityStats.newViews ?? 0)}`,
      badgeTone: 'info' as const,
    },
  ]

  const sections = sectionsBase

  return (
    <main className="ui-container ui-screen !pb-20 min-w-0 max-w-full overflow-x-hidden">
      <AdminOwnerInbox
        subscriptionRequestLeads={newLeadsCount}
        restaurantName={dashboardData.restaurantName}
      />
      <AdminDashboardSections sections={sections} dashboardData={dashboardData} />
    </main>
  )
}

