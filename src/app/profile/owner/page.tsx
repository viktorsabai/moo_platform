import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getOwnerVenues, getRestaurantContext } from '@/lib/restaurant-context'
import { prisma } from '@/lib/prisma'
import { OwnerEntryClient, type OwnerEntryVariant } from './OwnerEntryClient'

export default async function ProfileOwnerEntryPage() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) {
    redirect('/profile')
  }

  const platformRole = String((session?.user as any)?.platformRole ?? 'NONE')
  const memberRole = (session?.user as any)?.memberRole as string | undefined
  const cookieRestaurantId = String(cookies().get('ufo_restaurant')?.value || '').trim()
  const sessionRestaurantId = String(
    (session as any)?.restaurantId || (session?.user as any)?.restaurantId || ''
  ).trim()

  let venues: Awaited<ReturnType<typeof getOwnerVenues>> = []
  let currentRestaurantId: string | null = null
  try {
    venues = await getOwnerVenues(userId, platformRole)
  } catch {
    // One retry for transient DB/network hiccups.
    try {
      venues = await getOwnerVenues(userId, platformRole)
    } catch {
      venues = []
    }
  }

  // Hard fallback for SUPERADMIN: never hide platform venues behind empty state
  // if generic owner loader failed.
  if (platformRole === 'SUPERADMIN' && venues.length === 0) {
    try {
      const all = await prisma.restaurant.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      })
      venues = all.map((r) => ({ id: r.id, name: r.name || r.id }))
    } catch {
      // keep empty only if DB is truly unreachable
    }
  }

  // Header/menu often follow `ufo_restaurant` or JWT `restaurantId`, while `getOwnerVenues`
  // only used forced-tenant + DB memberships — recover OWNER/ADMIN by those hints.
  if (venues.length === 0) {
    const hintIds = [
      ...new Set(
        [cookieRestaurantId, sessionRestaurantId].filter((id) => id && id !== 'default')
      ),
    ]
    for (const rid of hintIds) {
      try {
        const m = await prisma.restaurantMember.findFirst({
          where: { userId, restaurantId: rid, role: { in: ['OWNER', 'ADMIN'] } },
          include: { restaurant: { select: { id: true, name: true } } },
        })
        if (m?.restaurant?.id) {
          venues = [{ id: m.restaurant.id, name: m.restaurant.name || m.restaurant.id }]
          break
        }
      } catch {
        // ignore hint
      }
    }
  }

  let ctx: Awaited<ReturnType<typeof getRestaurantContext>> = null
  try {
    ctx = await getRestaurantContext()
    currentRestaurantId = String(ctx?.restaurantId || '').trim() || null
  } catch {
    ctx = null
    currentRestaurantId = null
  }
  if (!currentRestaurantId || currentRestaurantId === 'default') {
    const preferred =
      cookieRestaurantId && cookieRestaurantId !== 'default'
        ? cookieRestaurantId
        : sessionRestaurantId
    if (preferred && preferred !== 'default') currentRestaurantId = preferred
  }

  // Self-heal fallback: if memberships list is unexpectedly empty, but effective
  // restaurant context is elevated, use that current venue instead of showing empty state.
  if (venues.length === 0 && ctx) {
    try {
      const elevatedCtx =
        ctx.platformRole === 'SUPERADMIN' ||
        ctx.memberRole === 'OWNER' ||
        ctx.memberRole === 'ADMIN'
      const fallbackRestaurantId = String(ctx.restaurantId || '').trim()
      currentRestaurantId = fallbackRestaurantId || currentRestaurantId
      if (elevatedCtx && fallbackRestaurantId) {
        const r = await prisma.restaurant.findUnique({
          where: { id: fallbackRestaurantId },
          select: { id: true, name: true },
        })
        if (r?.id) venues = [{ id: r.id, name: r.name || r.id }]
      }
    } catch {
      // ignore and keep empty venues
    }
  }

  const legacyRole = String((session?.user as any)?.role || '')
  const isElevated =
    platformRole === 'SUPERADMIN' ||
    legacyRole === 'SUPERADMIN' ||
    memberRole === 'OWNER' ||
    memberRole === 'ADMIN'
  // Single-tenant hard fallback: never show "create venue" for an elevated user
  // just because owner venues fetch was transiently empty.
  if (venues.length === 0 && isElevated && currentRestaurantId) {
    let fallbackName = 'кабинет заведения'
    try {
      const r = await prisma.restaurant.findUnique({
        where: { id: currentRestaurantId },
        select: { name: true },
      })
      if (String(r?.name || '').trim()) fallbackName = String(r?.name).trim()
    } catch {
      // keep label
    }
    venues = [{ id: currentRestaurantId, name: fallbackName }]
  }
  const hasVenues = venues.length > 0

  let variant: OwnerEntryVariant
  if (hasVenues) {
    variant = 'list'
  } else if (isElevated) {
    variant = 'empty'
  } else {
    variant = 'onboarding'
  }

  return (
    <main className="ui-container ui-screen !pb-20">
      <OwnerEntryClient variant={variant} venues={venues} singleTenant />
    </main>
  )
}
