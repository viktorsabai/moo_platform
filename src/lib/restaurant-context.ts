import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { cookies, headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { allowAutoDefaultOwner } from '@/lib/platform-tenant'

const DEFAULT_SINGLE_TENANT_RESTAURANT_ID = 'cmoibd1en000cx2i9pt9gp2hr'
const HAS_EXPLICIT_SINGLE_TENANT_ENV = Boolean(String(process.env.UFO_SINGLE_RESTAURANT_ID || '').trim())
const SINGLE_TENANT_RESTAURANT_ID =
  String(process.env.UFO_SINGLE_RESTAURANT_ID || DEFAULT_SINGLE_TENANT_RESTAURANT_ID).trim()
const FORCE_SINGLE_TENANT = String(process.env.UFO_FORCE_SINGLE_TENANT || '1').trim() !== '0'

function parseTelegramIds(value: string): string[] {
  return String(value || '')
    .split(',')
    .map((v) => v.trim().replace(/^['"]+|['"]+$/g, ''))
    .filter(Boolean)
}

const SUPERADMIN_TELEGRAM_IDS_LIST = parseTelegramIds(
  process.env.UFO_SUPERADMIN_TELEGRAM_ID || process.env.SUPERADMIN_TELEGRAM_IDS || ''
)

export type RestaurantContext = {
  userId: string
  restaurantId: string
  platformRole: 'NONE' | 'SUPERADMIN'
  memberRole?: 'OWNER' | 'ADMIN' | 'STAFF'
}

export async function resolveSingleTenantRestaurantId(): Promise<string | null> {
  if (!FORCE_SINGLE_TENANT) return null
  if (SINGLE_TENANT_RESTAURANT_ID && HAS_EXPLICIT_SINGLE_TENANT_ENV) {
    // In single-restaurant production mode trust explicit env pin.
    // Avoid extra DB roundtrips on every request (prevents connection spikes).
    return SINGLE_TENANT_RESTAURANT_ID
  }
  if (SINGLE_TENANT_RESTAURANT_ID) {
    const exists = await prisma.restaurant.findUnique({
      where: { id: SINGLE_TENANT_RESTAURANT_ID },
      select: { id: true },
    })
    if (exists?.id) return exists.id
  }
  const fallback = await prisma.restaurant.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  if (fallback?.id) return fallback.id
  return null
}

export async function getRestaurantContext(): Promise<RestaurantContext | null> {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) {
    // #region agent log
    try {
      const fs = require('fs')
      require('fs').appendFileSync(require('path').join(process.cwd(), '.cursor', 'debug.log'), JSON.stringify({ location: 'restaurant-context:noUserId', message: 'no userId', data: { hasSession: !!session }, timestamp: Date.now(), hypothesisId: 'F' }) + '\n')
    } catch {}
    // #endregion
    return null
  }

  let platformRole = String((session?.user as any)?.platformRole || 'NONE') as RestaurantContext['platformRole']
  const sessionMemberRole = (session?.user as any)?.memberRole as RestaurantContext['memberRole'] | undefined
  const sessionRestaurantId = String((session as any)?.restaurantId || (session?.user as any)?.restaurantId || 'default')
  const forcedRestaurantId = await resolveSingleTenantRestaurantId()

  // Normalize elevated role from DB to avoid stale Telegram webview sessions.
  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, platformRole: true },
    })
    const dbPlatformRole = String(dbUser?.platformRole || '').trim()
    const dbLegacyRole = String(dbUser?.role || '').trim()
    if (dbPlatformRole === 'SUPERADMIN' || dbLegacyRole === 'SUPERADMIN') {
      platformRole = 'SUPERADMIN'
    }
  } catch {
    // keep session role fallback
  }

  // Cookie: consumer multi-tenant uses it freely; single-tenant still pins guests to UFO_SINGLE_RESTAURANT_ID,
  // but OWNER/ADMIN/SUPERADMIN must keep ufo_restaurant after /api/restaurant/switch — otherwise admin/layout
  // sees ctx.restaurantId !== cookie and redirects, breaking ЛК in Telegram.
  let restaurantId = sessionRestaurantId
  const overriddenRaw = cookies().get('ufo_restaurant')?.value
  const overridden = typeof overriddenRaw === 'string' ? overriddenRaw.trim() : ''

  const isSuperAdmin = platformRole === 'SUPERADMIN'
  const sessionElevated = sessionMemberRole === 'OWNER' || sessionMemberRole === 'ADMIN'

  let adminCookieVenue: string | null = null
  if (overridden) {
    const member = await prisma.restaurantMember.findUnique({
      where: { restaurantId_userId: { restaurantId: overridden, userId } },
      select: { id: true, role: true },
    })
    const exists = await prisma.restaurant.findUnique({ where: { id: overridden }, select: { id: true } })
    const memberCanManage = member?.role === 'OWNER' || member?.role === 'ADMIN'
    if (exists?.id && (isSuperAdmin || memberCanManage)) {
      adminCookieVenue = overridden
    }
    if (!forcedRestaurantId && exists?.id && (isSuperAdmin || member?.id)) {
      restaurantId = overridden
    }
  }

  if (forcedRestaurantId) {
    const elevated = isSuperAdmin || sessionElevated
    if (elevated && adminCookieVenue) {
      restaurantId = adminCookieVenue
    } else {
      restaurantId = forcedRestaurantId
    }
  }

  // Always compute memberRole for the effective restaurantId (supports SUPERADMIN context switch).
  let m = await prisma.restaurantMember.findUnique({
    where: { restaurantId_userId: { restaurantId, userId } },
    select: { role: true },
  })
  let memberRole = (m?.role as RestaurantContext['memberRole']) ?? undefined

  // Emergency fallback for single-restaurant MVP:
  // if DB membership is temporarily missing/unavailable, trust elevated session role
  // so owner cabinet does not lock out during launch-critical period.
  if (!memberRole && forcedRestaurantId && (platformRole === 'SUPERADMIN' || sessionMemberRole === 'OWNER' || sessionMemberRole === 'ADMIN')) {
    memberRole = (platformRole === 'SUPERADMIN' ? 'OWNER' : sessionMemberRole) as RestaurantContext['memberRole']
  }

  if (!memberRole && platformRole === 'SUPERADMIN') {
    memberRole = 'OWNER'
  }

  // Self-heal a signed owner/admin session whose membership row is missing after
  // DB switches or legacy migrations. Without this, owner pages fall into
  // "create venue" even though the session still has a valid owner role.
  if (!memberRole && platformRole !== 'SUPERADMIN' && (sessionMemberRole === 'OWNER' || sessionMemberRole === 'ADMIN')) {
    const exists = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { id: true } })
    if (exists?.id) {
      const repaired = await prisma.restaurantMember.upsert({
        where: { restaurantId_userId: { restaurantId, userId } },
        create: { restaurantId, userId, role: sessionMemberRole },
        update: { role: sessionMemberRole },
        select: { role: true },
      })
      memberRole = repaired.role as RestaurantContext['memberRole']
    }
  }

  // Пустой RestaurantMember после смены БД: первый вход супер-админа / ID из UFO_BOOTSTRAP_OWNER_TELEGRAM_IDS → OWNER.
  if (!memberRole && forcedRestaurantId === restaurantId && userId) {
    const memberCount = await prisma.restaurantMember.count({ where: { restaurantId } })
    if (memberCount === 0) {
      const u = await prisma.user.findUnique({ where: { id: userId }, select: { telegramId: true } })
      const tg = String(u?.telegramId || '').trim()
      if (tg) {
        const bootstrap = new Set<string>([
          ...String(process.env.UFO_BOOTSTRAP_OWNER_TELEGRAM_IDS || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          ...SUPERADMIN_TELEGRAM_IDS_LIST,
        ])
        if (bootstrap.has(tg)) {
          try {
            const created = await prisma.restaurantMember.create({
              data: { restaurantId, userId, role: 'OWNER' },
              select: { role: true },
            })
            memberRole = created.role as RestaurantContext['memberRole']
          } catch {
            // гонка или повтор — перечитаем
            const again = await prisma.restaurantMember.findUnique({
              where: { restaurantId_userId: { restaurantId, userId } },
              select: { role: true },
            })
            memberRole = (again?.role as RestaurantContext['memberRole']) ?? memberRole
          }
        }
      }
    }
  }

  // If no role in current venue but user has OWNER/ADMIN elsewhere, use that venue so they can access the cabinet
  if (!memberRole && platformRole !== 'SUPERADMIN') {
    // Не перетирать точку из manage-куки другим заведением по orderBy — иначе ctx.restaurantId ≠ cookie,
    // admin/layout крутит редиректы на /api/restaurant/switch, в Telegram WebView часто «чёрный экран».
    const pinnedByAdminCookie =
      Boolean(adminCookieVenue) &&
      restaurantId === adminCookieVenue &&
      (isSuperAdmin || sessionElevated)
    const adminMembership = pinnedByAdminCookie
      ? null
      : await prisma.restaurantMember.findFirst({
          where: { userId, role: { in: ['OWNER', 'ADMIN'] } },
          orderBy: { restaurantId: 'asc' },
          select: { restaurantId: true, role: true },
        })
    if (adminMembership) {
      restaurantId = adminMembership.restaurantId
      memberRole = adminMembership.role as RestaurantContext['memberRole']
    } else if (restaurantId === 'default' && allowAutoDefaultOwner()) {
      // Demo only: first user on empty default becomes OWNER (see UFO_ALLOW_AUTO_DEFAULT_OWNER)
      const defaultMemberCount = await prisma.restaurantMember.count({
        where: { restaurantId: 'default' },
      })
      if (defaultMemberCount === 0) {
        const created = await prisma.restaurantMember.create({
          data: { restaurantId: 'default', userId, role: 'OWNER' },
          select: { role: true },
        })
        memberRole = created.role as RestaurantContext['memberRole']
      }
    }
  }

  // #region agent log
  try {
    const fs = require('fs')
    require('fs').appendFileSync(require('path').join(process.cwd(), '.cursor', 'debug.log'), JSON.stringify({ location: 'restaurant-context:ctxResult', data: { userId, restaurantId, platformRole, memberRole }, timestamp: Date.now(), hypothesisId: 'A' }) + '\n')
  } catch {}
  // #endregion
  return { userId, restaurantId, platformRole, memberRole }
}

/** restaurantId для consumer (banners, dishes, menu, store). Учитывает cookie для гостей и logged-in. */
export async function getConsumerRestaurantResolution(): Promise<{
  restaurantId: string
  source: 'header' | 'cookie' | 'session' | 'default'
  headerRestaurantId?: string
  cookieRestaurantId?: string
  sessionRestaurantId?: string
}> {
  const forcedRestaurantId = await resolveSingleTenantRestaurantId()

  const headerRestaurantId = (() => {
    try {
      const h = headers()
      return String(h.get('x-ufo-restaurant') || '').trim()
    } catch {
      return ''
    }
  })()

  const overriddenRaw = cookies().get('ufo_restaurant')?.value
  const overridden = typeof overriddenRaw === 'string' ? overriddenRaw.trim() : ''

  async function resolveExistingRestaurantId(id: string): Promise<string | null> {
    if (!id) return null
    const row = await prisma.restaurant.findUnique({ where: { id }, select: { id: true } })
    return row?.id ?? null
  }

  // Single-tenant pin: дефолт остаётся forced, но реальный id из WebApp (шапка / cookie) важен для акций и данных,
  // если в БД заведение не совпадает с UFO_SINGLE_RESTAURANT_ID.
  if (forcedRestaurantId) {
    if (headerRestaurantId) {
      const hid = await resolveExistingRestaurantId(headerRestaurantId)
      if (hid) {
        return {
          restaurantId: hid,
          source: 'header',
          headerRestaurantId: hid,
          cookieRestaurantId: overridden || undefined,
          sessionRestaurantId: undefined,
        }
      }
    }
    if (overridden) {
      const cid = await resolveExistingRestaurantId(overridden)
      if (cid) {
        return {
          restaurantId: cid,
          source: 'cookie',
          headerRestaurantId: headerRestaurantId || undefined,
          cookieRestaurantId: cid,
          sessionRestaurantId: undefined,
        }
      }
    }
    return {
      restaurantId: forcedRestaurantId,
      source: 'default',
      headerRestaurantId: undefined,
      cookieRestaurantId: undefined,
      sessionRestaurantId: undefined,
    }
  }

  const ctx = await getRestaurantContext()
  // Header wins when it maps to a real restaurant. If the client still sends
  // `default` or a stale id before venue init, do NOT short-circuit to literal
  // `default` — fall through (cookie / session).
  // For logged-in users, session restaurant must beat cookie: cookie is set for
  // mini-app venue context and can be stale vs NextAuth membership (ЛК/профиль).
  let result = 'default'
  let source: 'header' | 'cookie' | 'session' | 'default' = 'default'
  if (headerRestaurantId) {
    const headerRow = await prisma.restaurant.findUnique({
      where: { id: headerRestaurantId },
      select: { id: true },
    })
    if (headerRow?.id) {
      result = headerRestaurantId
      source = 'header'
    }
  }
  if (source !== 'header' && ctx?.userId) {
    const sid = String(ctx.restaurantId || '').trim()
    if (sid) {
      const sessionRow = await prisma.restaurant.findUnique({
        where: { id: sid },
        select: { id: true },
      })
      if (sessionRow?.id) {
        result = sid
        source = 'session'
      }
    }
  }
  if (source !== 'header' && source !== 'session' && overridden) {
    const cookieRow = await prisma.restaurant.findUnique({
      where: { id: overridden },
      select: { id: true },
    })
    if (cookieRow?.id) {
      result = overridden
      source = 'cookie'
    }
  }
  // #region agent log
  try{require('fs').appendFileSync(require('path').join(process.cwd(),'.cursor','debug.log'),JSON.stringify({location:'restaurant-context:getConsumerRestaurantId',message:'result',data:{hasCtxUserId:!!ctx?.userId,ctxRestaurantId:ctx?.restaurantId,cookieValue:overridden??null,result},timestamp:Date.now(),hypothesisId:'H2'})+'\n')}catch{}
  // #endregion
  return {
    restaurantId: result,
    source,
    headerRestaurantId: headerRestaurantId || undefined,
    cookieRestaurantId: overridden || undefined,
    sessionRestaurantId: ctx?.restaurantId,
  }
}

/** restaurantId для consumer (banners, dishes, menu, store). Учитывает cookie для гостей и logged-in. */
export async function getConsumerRestaurantId(): Promise<string> {
  const resolution = await getConsumerRestaurantResolution()
  const result = resolution.restaurantId
  return result
}

export function requireRestaurantContext(ctx: RestaurantContext | null) {
  if (!ctx?.userId || !ctx?.restaurantId) {
    const err = new Error('unauthorized')
    ;(err as any).statusCode = 401
    throw err
  }
  return ctx
}

export function requireRestaurantAdmin(ctx: RestaurantContext | null) {
  const c = requireRestaurantContext(ctx)
  const ok =
    c.platformRole === 'SUPERADMIN' ||
    c.memberRole === 'OWNER' ||
    c.memberRole === 'ADMIN'
  if (!ok) {
    // #region agent log
    try {
      const fs = require('fs')
      require('fs').appendFileSync(require('path').join(process.cwd(), '.cursor', 'debug.log'), JSON.stringify({ location: 'restaurant-context:forbidden', data: { platformRole: c.platformRole, memberRole: c.memberRole, restaurantId: c.restaurantId }, timestamp: Date.now(), hypothesisId: 'A' }) + '\n')
    } catch {}
    // #endregion
    const err = new Error('forbidden')
    ;(err as any).statusCode = 403
    throw err
  }
  return c
}

export type OwnerVenue = { id: string; name: string }

/** List business units (restaurants) the user can manage. For SUPERADMIN returns all; otherwise only where user is OWNER/ADMIN. */
export async function getOwnerVenues(userId: string, platformRole: string): Promise<OwnerVenue[]> {
  const forcedRestaurantId = await resolveSingleTenantRestaurantId()
  if (forcedRestaurantId) {
    const venue = await prisma.restaurant.findUnique({
      where: { id: forcedRestaurantId },
      select: { id: true, name: true },
    })
    if (!venue?.id) return []
    if (platformRole === 'SUPERADMIN') return [{ id: venue.id, name: venue.name || venue.id }]
    const member = await prisma.restaurantMember.findFirst({
      where: { userId, restaurantId: venue.id, role: { in: ['OWNER', 'ADMIN'] } },
      select: { id: true },
    })
    if (member?.id) return [{ id: venue.id, name: venue.name || venue.id }]
    // Закреплённый tenant (env / дефолтный id) может не совпадать с реальной строкой Restaurant,
    // где у пользователя OWNER/ADMIN — тогда шапка (cookie/header) показывает «USSR», а ЛК — пустой список.
    const adminMemberships = await prisma.restaurantMember.findMany({
      where: { userId, role: { in: ['OWNER', 'ADMIN'] } },
      orderBy: { restaurantId: 'asc' },
      select: { restaurant: { select: { id: true, name: true } } },
    })
    if (adminMemberships.length === 0) return []
    return adminMemberships.map((m) => ({
      id: m.restaurant.id,
      name: m.restaurant.name || m.restaurant.id,
    }))
  }

  if (platformRole === 'SUPERADMIN') {
    const list = await prisma.restaurant.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    })
    return list.map((r) => ({ id: r.id, name: r.name || r.id }))
  }
  let members = await prisma.restaurantMember.findMany({
    where: { userId, role: { in: ['OWNER', 'ADMIN'] } },
    orderBy: { restaurantId: 'asc' },
    select: { restaurant: { select: { id: true, name: true } } },
  })

  const hasDefault = members.some((m) => m.restaurant.id === 'default')
  if (!hasDefault && allowAutoDefaultOwner()) {
    const defaultMemberCount = await prisma.restaurantMember.count({
      where: { restaurantId: 'default' },
    })
    if (defaultMemberCount === 0) {
      await prisma.restaurantMember.create({
        data: { restaurantId: 'default', userId, role: 'OWNER' },
      })
      const def = await prisma.restaurant.findUnique({
        where: { id: 'default' },
        select: { id: true, name: true },
      })
      if (def) members = [{ restaurant: def }, ...members]
    }
  }

  return members.map((m) => ({
    id: m.restaurant.id,
    name: m.restaurant.name || m.restaurant.id,
  }))
}

