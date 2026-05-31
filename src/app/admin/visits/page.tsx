import Link from 'next/link'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getRestaurantContext, requireRestaurantAdmin } from '@/lib/restaurant-context'
import { countGuestsByFocus, normalizeGuestListFocus, type GuestListFocus } from '@/lib/guest-crm'
import { Card } from '@/components/ui/Card'
import { VisitsClient, type SerializedDaily, type SerializedGuest } from './VisitsClient'

type ActivitySummary = {
  views: number
  visitors: number
  carts: number
  checkouts: number
  favorites: number
  /** Открытий меню (VIEW_PAGE) за последние 24 ч — срез «сейчас». */
  menuViews24h: number
  /** Уникальных гостей с хотя бы одним VIEW_PAGE за 24 ч (согласовано с menuViews24h). */
  menuGuests24h: number
  /** Первое событие у гостя в этом заведении — внутри выбранного периода (since → сейчас). */
  firstTimeGuests: number
}

type DailyActivityRow = {
  day: Date
  views: number
  carts: number
  checkouts: number
}

type ActivityEventRow = {
  id: string
  type: string
  path: string | null
  metadata: any
  createdAt: Date
  userId: string | null
  userName: string | null
  telegramUsername: string | null
  telegramId: string | null
}

type GuestInsight = {
  key: string
  name: string
  telegramId: string | null
  userId: string | null
  lastAt: Date
  isFresh: boolean
  events: ActivityEventRow[]
  views: number
  dishViews: number
  cartAdds: number
  favorites: number
  checkoutStarts: number
  orders: number
  leads: number
  paths: string[]
  interests: string[]
  status: string
  statusTone: 'hot' | 'warm' | 'neutral' | 'done'
}

const FRESH_MS = 24 * 60 * 60 * 1000

function normalizeDays(value: unknown) {
  const n = Number(value)
  return n === 1 || n === 7 || n === 30 ? n : 7
}

function normalizeType(value: unknown) {
  const type = String(value || 'all').toUpperCase()
  return [
    'VIEW_PAGE',
    'VIEW_DISH',
    'ADD_TO_CART',
    'CART_WITH_ITEMS',
    'START_CHECKOUT',
    'ADD_FAVORITE',
    'SUBMIT_ORDER',
    'SUBMIT_LEAD',
  ].includes(type) ? type : 'ALL'
}

function guestGroupKey(event: ActivityEventRow): string {
  const tg = String(event.telegramId || '').trim()
  if (tg) return `tg:${tg}`
  const uid = String(event.userId || '').trim()
  if (uid) return `uid:${uid}`
  const handle = String(event.telegramUsername || event.userName || '')
    .trim()
    .toLowerCase()
  if (handle) return `h:${handle}`
  return 'anon'
}

function actorName(event: ActivityEventRow) {
  // Не брать metadata.name — в меню туда попадало имя блюда (VIEW_DISH / корзина), из‑за чего весь
  // анонимный пул `anon` отображался как «Азу из курицы» по последнему событию.
  const fromMetadata = [
    event.metadata?.userName,
    event.metadata?.username,
    event.metadata?.telegramUsername,
    event.metadata?.first_name,
  ].find((value) => typeof value === 'string' && String(value).trim())
  if (fromMetadata) return String(fromMetadata).trim()
  return event.userName || event.telegramUsername || (event.telegramId ? `tg ${event.telegramId}` : 'гость')
}

function metadataName(event: ActivityEventRow) {
  const base = event.metadata?.dishName || event.metadata?.productName || event.metadata?.name
  const baseName = typeof base === 'string' ? base.trim() : ''
  const optionLabels = Array.isArray(event.metadata?.optionLabels)
    ? event.metadata.optionLabels.map((v: unknown) => String(v || '').trim()).filter(Boolean)
    : Array.isArray(event.metadata?.modifierLabels)
      ? event.metadata.modifierLabels.map((v: unknown) => String(v || '').trim()).filter(Boolean)
      : []
  if (baseName && optionLabels.length > 0) return `${baseName} (${optionLabels[0]})`
  return baseName
}

function buildGuestInsights(events: ActivityEventRow[]): GuestInsight[] {
  const groups = new Map<string, ActivityEventRow[]>()
  for (const event of events) {
    const key = guestGroupKey(event)
    const list = groups.get(key) ?? []
    list.push(event)
    groups.set(key, list)
  }

  return [...groups.entries()].map(([key, list]) => {
    const sorted = [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    const latest = sorted[0]
    const name = actorName(latest)
    const types = new Set(sorted.map((event) => event.type))
    const interests = [...new Set(sorted.map(metadataName).filter(Boolean))].slice(0, 4)
    const paths = [...new Set(sorted.map((event) => event.path || '/').filter(Boolean))].slice(0, 4)
    const views = sorted.filter((event) => event.type === 'VIEW_PAGE').length
    const dishViews = sorted.filter((event) => event.type === 'VIEW_DISH').length
    const cartAdds = sorted.filter((event) => event.type === 'ADD_TO_CART' || event.type === 'CART_WITH_ITEMS').length
    const favorites = sorted.filter((event) => event.type === 'ADD_FAVORITE').length
    const checkoutStarts = sorted.filter((event) => event.type === 'START_CHECKOUT').length
    const orders = sorted.filter((event) => event.type === 'SUBMIT_ORDER').length
    const leads = sorted.filter((event) => event.type === 'SUBMIT_LEAD' || event.type === 'SUBSCRIPTION_LEAD').length
    const lastAt = new Date(latest.createdAt)
    const isFresh = Date.now() - lastAt.getTime() < FRESH_MS

    let status = 'наблюдает'
    let statusTone: GuestInsight['statusTone'] = 'neutral'

    if (orders > 0 || leads > 0) {
      status = orders > 0 ? 'конвертировался' : 'заявка'
      statusTone = 'done'
    } else if (checkoutStarts > 0) {
      status = 'чекаут'
      statusTone = 'hot'
    } else if (cartAdds > 0) {
      status = 'корзина'
      statusTone = 'hot'
    } else if (favorites > 0) {
      status = 'избранное'
      statusTone = 'warm'
    } else if (dishViews >= 3 || views >= 5 || types.has('VIEW_SUBSCRIPTION')) {
      status = 'прогрев'
      statusTone = 'warm'
    }

    const resolvedTg =
      sorted.map((e) => String(e.telegramId || '').trim()).find((id) => id.length > 0) || null
    const resolvedUserId =
      sorted.map((e) => String(e.userId || '').trim()).find((id) => id.length > 0) || null

    return {
      key,
      name,
      telegramId: resolvedTg,
      userId: resolvedUserId,
      lastAt,
      isFresh,
      events: sorted,
      views,
      dishViews,
      cartAdds,
      favorites,
      checkoutStarts,
      orders,
      leads,
      paths,
      interests,
      status,
      statusTone,
    }
  }).sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime())
}

function serializeGuest(g: GuestInsight): SerializedGuest {
  return {
    key: g.key,
    name: g.name,
    telegramId: g.telegramId,
    lastAt: g.lastAt.toISOString(),
    isFresh: g.isFresh,
    events: g.events.map((e) => ({
      id: e.id,
      type: e.type,
      path: e.path,
      metadata: e.metadata,
      createdAt: e.createdAt.toISOString(),
    })),
    views: g.views,
    dishViews: g.dishViews,
    cartAdds: g.cartAdds,
    favorites: g.favorites,
    checkoutStarts: g.checkoutStarts,
    orders: g.orders,
    interests: g.interests,
    statusTone: g.statusTone,
  }
}

export default async function AdminVisitsPage({
  searchParams,
}: {
  searchParams?: { days?: string; type?: string; focus?: string }
}) {
  let admin: NonNullable<Awaited<ReturnType<typeof getRestaurantContext>>>
  try {
    admin = requireRestaurantAdmin(await getRestaurantContext())
  } catch {
    return (
      <main className="ui-container ui-screen !pb-20">
        <Card variant="surfaceStrong" className="p-5">
          <div className="text-[14px] font-semibold text-[color:var(--text)]">нет доступа</div>
          <Link href="/profile" className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-full bg-[color:var(--primary)] px-6 text-[14px] font-semibold text-white">
            в профиль
          </Link>
        </Card>
      </main>
    )
  }

  const days = normalizeDays(searchParams?.days)
  const selectedType = normalizeType(searchParams?.type)
  const selectedFocus: GuestListFocus = normalizeGuestListFocus(searchParams?.focus)
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const rid = admin.restaurantId

  const [summaryResult, dailyResult, eventsResult] = await Promise.allSettled([
    prisma.$queryRaw<ActivitySummary[]>(Prisma.sql`
      SELECT
        COUNT(*) FILTER (WHERE e."type" = 'VIEW_PAGE')::int AS views,
        COUNT(DISTINCT COALESCE(e."userId", e."telegramId")) FILTER (WHERE COALESCE(e."userId", e."telegramId") IS NOT NULL)::int AS visitors,
        COUNT(*) FILTER (WHERE e."type" IN ('CART_WITH_ITEMS', 'ADD_TO_CART'))::int AS carts,
        COUNT(*) FILTER (WHERE e."type" = 'ADD_FAVORITE')::int AS favorites,
        COUNT(*) FILTER (WHERE e."type" = 'START_CHECKOUT')::int AS checkouts,
        COUNT(*) FILTER (WHERE e."type" = 'VIEW_PAGE' AND e."createdAt" >= NOW() - INTERVAL '24 hours')::int AS "menuViews24h",
        COUNT(DISTINCT COALESCE(e."userId", e."telegramId")) FILTER (
          WHERE e."type" = 'VIEW_PAGE'
            AND COALESCE(e."userId", e."telegramId") IS NOT NULL
            AND e."createdAt" >= NOW() - INTERVAL '24 hours'
        )::int AS "menuGuests24h",
        (
          SELECT COUNT(*)::int
          FROM (
            SELECT COALESCE(e2."userId", e2."telegramId") AS k
            FROM "UserActivityEvent" e2
            WHERE e2."restaurantId" = ${rid}
              AND COALESCE(e2."userId", e2."telegramId") IS NOT NULL
            GROUP BY k
            HAVING MIN(e2."createdAt") >= ${since}
          ) q
        ) AS "firstTimeGuests"
      FROM "UserActivityEvent" e
      WHERE e."restaurantId" = ${rid}
        AND e."createdAt" >= ${since}
    `),
    prisma.$queryRaw<DailyActivityRow[]>(Prisma.sql`
      SELECT
        date_trunc('day', e."createdAt") AS day,
        COUNT(*) FILTER (WHERE e."type" = 'VIEW_PAGE')::int AS views,
        COUNT(*) FILTER (WHERE e."type" IN ('CART_WITH_ITEMS', 'ADD_TO_CART'))::int AS carts,
        COUNT(*) FILTER (WHERE e."type" = 'START_CHECKOUT')::int AS checkouts
      FROM "UserActivityEvent" e
      WHERE e."restaurantId" = ${rid}
        AND e."createdAt" >= ${since}
      GROUP BY 1
      ORDER BY 1 ASC
    `),
    (async (): Promise<ActivityEventRow[]> => {
      const rows = await prisma.userActivityEvent.findMany({
        where: {
          restaurantId: rid,
          createdAt: { gte: since },
          ...(selectedType !== 'ALL' ? { type: selectedType } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 1500,
        select: {
          id: true,
          type: true,
          path: true,
          metadata: true,
          createdAt: true,
          userId: true,
          telegramId: true,
          user: { select: { name: true, telegramUsername: true } },
        },
      })
      return rows.map((e) => ({
        id: e.id,
        type: e.type,
        path: e.path,
        metadata: e.metadata,
        createdAt: e.createdAt,
        userId: e.userId,
        userName: e.user?.name ?? null,
        telegramUsername: e.user?.telegramUsername ?? null,
        telegramId: e.telegramId,
      }))
    })(),
  ])

  const summary =
    summaryResult.status === 'fulfilled'
      ? (summaryResult.value[0] ?? {
          views: 0,
          visitors: 0,
          carts: 0,
          checkouts: 0,
          favorites: 0,
          menuViews24h: 0,
          menuGuests24h: 0,
          firstTimeGuests: 0,
        })
      : {
          views: 0,
          visitors: 0,
          carts: 0,
          checkouts: 0,
          favorites: 0,
          menuViews24h: 0,
          menuGuests24h: 0,
          firstTimeGuests: 0,
        }
  const daily = dailyResult.status === 'fulfilled' ? dailyResult.value : []
  const events = eventsResult.status === 'fulfilled' ? eventsResult.value : []
  const missingSchema = summaryResult.status === 'rejected' || dailyResult.status === 'rejected' || eventsResult.status === 'rejected'
  let guestInsights = buildGuestInsights(events)
  const userIdsNeedingTg = [...new Set(guestInsights.filter((g) => !g.telegramId && g.userId).map((g) => g.userId as string))]
  if (userIdsNeedingTg.length > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: userIdsNeedingTg } },
      select: { id: true, telegramId: true },
    })
    const tgByUser = new Map(
      users.filter((u) => String(u.telegramId || '').trim()).map((u) => [u.id, String(u.telegramId).trim()] as const)
    )
    guestInsights = guestInsights.map((g) => {
      if (g.telegramId) return g
      const tid = g.userId ? tgByUser.get(g.userId) : undefined
      return tid ? { ...g, telegramId: tid } : g
    })
  }

  const hotGuests = guestInsights.filter((guest) => guest.statusTone === 'hot').length
  const nOpportunity = countGuestsByFocus(guestInsights, 'OPPORTUNITY')
  const nBrowsing = countGuestsByFocus(guestInsights, 'BROWSING')
  const nCartDrop = countGuestsByFocus(guestInsights, 'CART_DROP')
  const nCheckoutDrop = countGuestsByFocus(guestInsights, 'CHECKOUT_DROP')
  const nLoyal = countGuestsByFocus(guestInsights, 'LOYAL')

  const serializedGuests: SerializedGuest[] = guestInsights.map(serializeGuest)
  const serializedDaily: SerializedDaily[] = daily.map((row) => ({
    day: new Date(row.day).toISOString(),
    views: Number(row.views ?? 0),
    carts: Number(row.carts ?? 0),
    checkouts: Number(row.checkouts ?? 0),
  }))

  return (
    <VisitsClient
      days={days}
      selectedType={selectedType}
      selectedFocus={selectedFocus}
      summary={summary}
      daily={serializedDaily}
      guests={serializedGuests}
      counts={{
        opportunity: nOpportunity,
        browsing: nBrowsing,
        cartDrop: nCartDrop,
        checkoutDrop: nCheckoutDrop,
        loyal: nLoyal,
        hotGuests,
      }}
      missingSchema={missingSchema}
    />
  )
}
