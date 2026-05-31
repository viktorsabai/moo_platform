import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getRestaurantContext } from '@/lib/restaurant-context'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let ctx = null
  try {
    ctx = await getRestaurantContext()
  } catch {
    redirect('/profile')
  }
  const ok = Boolean(
    ctx?.userId &&
      (ctx.platformRole === 'SUPERADMIN' ||
        ctx.memberRole === 'OWNER' ||
        ctx.memberRole === 'ADMIN')
  )
  if (!ok || !ctx) {
    redirect('/profile')
  }
  const cookieStore = await cookies()
  const existingCookie = (cookieStore.get('ufo_restaurant')?.value ?? '').trim()
  const ctxRid = String(ctx.restaurantId ?? '').trim()
  if (ctxRid && existingCookie !== ctxRid) {
    // Keep the owner cookie aligned with the effective admin context. Client-side
    // venue init can rewrite the consumer cookie after navigation, so repair it here.
    redirect(`/api/restaurant/switch?venue=${encodeURIComponent(ctxRid)}&redirect=/admin`)
  }
  return <>{children}</>
}
