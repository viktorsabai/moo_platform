import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getRestaurantContext, requireRestaurantAdmin } from '@/lib/restaurant-context'
import { parsePaymentMethodsJson } from '@/lib/payment-methods'
import { AdminOwnerInbox } from '@/components/admin/AdminOwnerInbox'
import { countHotGuestsFromActivity, inboxPendingTotal } from '@/lib/admin-dashboard-metrics'
import { AdminKitchenToday } from '@/components/admin/AdminKitchenToday'
import { AdminOpenToggle } from '@/components/admin/AdminOpenToggle'
import { Screen, Card, Btn } from '@/components/kit'

const ARCHIVE_CATEGORY_SLUG = '__archive'

function AdminNoAccess() {
  return (
    <Screen title="кабинет" className="!pb-20">
      <Card>
        <div className="text-[14px] font-semibold text-[color:var(--text)]">нет доступа</div>
        <div className="mt-1 text-[13px] font-medium text-[color:var(--muted)]">у этого аккаунта нет прав на управление заведением</div>
        <p className="mt-3 text-[12px] text-[color:var(--muted)]">
          Если вы владелец: создайте заведение в приложении (Профиль → Создать заведение) или попросите добавить вас в команду заведения.
        </p>
        <Link href="/profile" prefetch={false} scroll={false}>
          <Btn full className="mt-4">в профиль</Btn>
        </Link>
      </Card>
    </Screen>
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
  type SettingsRow = { deliveryFee: number; freeDeliveryFrom: number; openTime: string; closeTime: string; menuEnabled: boolean; storeEnabled: boolean; subscriptionEnabled: boolean; isOpenOverride?: boolean | null; paymentMethodsJson?: unknown } | null
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
        paymentMethodsJson: true,
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
    prisma.$queryRawUnsafe<Array<{ zones: number; orders: number }>>(
      `SELECT
         (SELECT COUNT(*)::int FROM "DeliveryZone" WHERE "restaurantId" = $1 AND "isActive" = true) AS "zones",
         (SELECT COUNT(*)::int FROM "Order" WHERE "restaurantId" = $1) AS "orders"`,
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
    menuEnabled: true,
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

  const methods = parsePaymentMethodsJson((settings as any)?.paymentMethodsJson)
  const hasQr = methods.some((m) => m.enabled && m.slug.startsWith('QR') && m.qrImageUrl)
  const extra = settled[6].status === 'fulfilled' ? settled[6].value?.[0] : null
  const zonesCount = Number(extra?.zones ?? 0)
  const ordersTotal = Number(extra?.orders ?? 0)
  const checklist = [
    { done: true, label: 'бот и заведение' },
    { done: availableDishesCount > 0, label: 'есть доступные блюда', href: '/admin/store' },
    { done: zonesCount > 0, label: 'зона доставки', href: '/admin/restaurant' },
    { done: hasQr, label: 'QR для оплаты', href: '/admin/qr' },
    { done: ordersTotal > 0, label: 'тестовый заказ', href: '/' },
  ]
  const doneCount = checklist.filter((c) => c.done).length
  const nextStep = checklist.find((c) => !c.done)
  const fmt = (n: number) => Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ')

  return (
    <Screen
      title={dashboardData.restaurantName}
      subtitle={
        <>
          {isOpenNow ? `открыто до ${resolvedSettings.closeTime}` : 'сейчас закрыто'}
          {' · '}
          <Link href="/admin/restaurant" prefetch={false} className="underline underline-offset-2">часы и пауза</Link>
        </>
      }
      right={<AdminOpenToggle initialOpen={isOpenNow} />}
      className="!pb-24 min-w-0 max-w-full overflow-x-hidden"
    >
      {doneCount < checklist.length && nextStep ? (
        <Card className="mb-4">
          <div className="flex items-baseline justify-between">
            <div className="text-[15px] font-semibold text-[color:var(--text)]">до первого заказа — {checklist.length - doneCount} шага</div>
            <div className="text-[12.5px] text-[color:var(--muted)]">{doneCount} из {checklist.length}</div>
          </div>
          <div className="mt-3 flex gap-1" aria-hidden>
            {checklist.map((c, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full ${c.done ? 'bg-[color:var(--ok)]' : 'bg-[color:var(--stroke)]'}`} />
            ))}
          </div>
          <ul className="mt-3 space-y-1 text-[13px] text-[color:var(--muted)]">
            {checklist.map((c) => (
              <li key={c.label}>{c.done ? '✓ ' : '○ '}{c.label}</li>
            ))}
          </ul>
          <Link href={nextStep.href ?? '/admin/restaurant'} prefetch={false}>
            <Btn full className="mt-3">{nextStep.label}</Btn>
          </Link>
        </Card>
      ) : null}

      <AdminOwnerInbox subscriptionRequestLeads={newLeadsCount} />

      <AdminKitchenToday />

      <p className="mt-4 text-center text-[12.5px] text-[color:var(--muted)]">
        сегодня: {stats.ordersToday} заказов · {fmt(stats.revenueToday)} ฿ · {activeOrdersCount} в работе
      </p>
    </Screen>
  )
}
