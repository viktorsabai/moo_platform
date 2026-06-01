import type { NextAuthOptions } from 'next-auth'
import type { JWT } from 'next-auth/jwt'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import { allowAutoDefaultOwner } from '@/lib/platform-tenant'
import { acceptPendingRestaurantInvites } from '@/lib/restaurant-invites'
import { fieldsFromTelegramWebAppUser } from '@/lib/telegram-user-fields'
import crypto from 'crypto'

function parseTelegramIds(value: string): string[] {
  return String(value || '')
    .split(',')
    .map((v) => v.trim().replace(/^['"]+|['"]+$/g, ''))
    .filter(Boolean)
}

const SUPERADMIN_TELEGRAM_IDS = parseTelegramIds(
  process.env.UFO_SUPERADMIN_TELEGRAM_ID || process.env.SUPERADMIN_TELEGRAM_IDS || '140222032'
)
const DEFAULT_SINGLE_TENANT_RESTAURANT_ID = 'cmoibd1en000cx2i9pt9gp2hr'
const HAS_EXPLICIT_SINGLE_TENANT_ENV = Boolean(String(process.env.UFO_SINGLE_RESTAURANT_ID || '').trim())
const SINGLE_TENANT_RESTAURANT_ID =
  String(process.env.UFO_SINGLE_RESTAURANT_ID || DEFAULT_SINGLE_TENANT_RESTAURANT_ID).trim()

async function resolvePrimaryRestaurantId(): Promise<string> {
  if (SINGLE_TENANT_RESTAURANT_ID && HAS_EXPLICIT_SINGLE_TENANT_ENV) {
    // Single source of truth for one-restaurant MVP.
    // Do not revalidate existence on every auth touch to reduce DB pressure.
    return SINGLE_TENANT_RESTAURANT_ID
  }
  if (SINGLE_TENANT_RESTAURANT_ID) {
    const pinned = await prisma.restaurant.findUnique({
      where: { id: SINGLE_TENANT_RESTAURANT_ID },
      select: { id: true },
    })
    if (pinned?.id) return pinned.id
  }
  const first = await prisma.restaurant.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  if (first?.id) return first.id
  // Avoid extra DB reads on hot auth path when env is not configured.
  return 'default'
}

function verifyTelegramInitData(initData: string, botToken: string): { tgUser: any; startParam: string } | null {
  if (!initData || !botToken) return null
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) return null
  const startParam = String(params.get('start_param') || '').trim()
  params.delete('hash')
  const dataCheckString = [...params.entries()].map(([k,v])=>`${k}=${v}`).sort().join('\n')
  const secret = crypto.createHmac('sha256','WebAppData').update(botToken).digest()
  const hmac = crypto.createHmac('sha256',secret).update(dataCheckString).digest('hex')
  if (hmac !== hash) return null
  try {
    const tgUser = JSON.parse(params.get('user') || '')
    return { tgUser, startParam }
  } catch {
    return null
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: 'telegram',
      name: 'telegram',
      credentials: { initData: { label: 'initData', type: 'text' } },
      async authorize(credentials) {
        const initData = String(credentials?.initData || '')
        const rawStartParam = (() => {
          try {
            return String(new URLSearchParams(initData).get('start_param') || '').trim()
          } catch {
            return ''
          }
        })()

        // Use per-restaurant bot token if we can resolve it by startParam.
        // (startParam itself is part of initData signature, so final verification still protects us.)
        const envToken = String(process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '')
        const integration = rawStartParam
          ? await prisma.botIntegration.findUnique({
              where: { startParam: rawStartParam },
              select: { restaurantId: true, botToken: true },
            })
          : null

        const verifyToken = String(integration?.botToken || envToken)
        const verified = verifyTelegramInitData(initData, verifyToken)
        const tgUser = verified?.tgUser
        const startParam = verified?.startParam || rawStartParam || ''
        if (!tgUser?.id) return null

        // ensure default tenant exists (migration-safe)
        await prisma.restaurant.upsert({
          where: { id: 'default' },
          create: { id: 'default', name: 'default', slug: 'default', isActive: true },
          update: {},
          select: { id: true },
        })

        let restaurantId = 'default'
        if (integration?.restaurantId) restaurantId = integration.restaurantId
        else if (startParam) {
          const bot = await prisma.botIntegration.findUnique({
            where: { startParam },
            select: { restaurantId: true },
          })
          if (bot?.restaurantId) restaurantId = bot.restaurantId
        }

        const tgFields = fieldsFromTelegramWebAppUser(tgUser)
        const email = `tg_${tgFields.telegramId}@telegram.local`
        const user = await prisma.user.upsert({
          where: { email },
          create: {
            name: tgFields.name,
            email,
            passwordHash: crypto.randomBytes(32).toString('hex'),
            telegramId: tgFields.telegramId,
            telegramUsername: tgFields.telegramUsername,
            telegramFirstName: tgFields.telegramFirstName,
            telegramLastName: tgFields.telegramLastName,
            telegramPhotoUrl: tgFields.telegramPhotoUrl,
          },
          update: {
            name: tgFields.name,
            telegramId: tgFields.telegramId,
            telegramUsername: tgFields.telegramUsername,
            telegramFirstName: tgFields.telegramFirstName,
            telegramLastName: tgFields.telegramLastName,
            telegramPhotoUrl: tgFields.telegramPhotoUrl,
          },
        })

        try {
          await acceptPendingRestaurantInvites({ userId: user.id, telegramId: tgFields.telegramId })
        } catch {
          // не блокируем вход из‑за приглашений
        }

        const isFixedSuperadmin = SUPERADMIN_TELEGRAM_IDS.includes(String(tgUser.id))
        if (isFixedSuperadmin && (user.platformRole !== 'SUPERADMIN' || user.role !== 'SUPERADMIN')) {
          await prisma.user.update({
            where: { id: user.id },
            data: { role: 'SUPERADMIN', platformRole: 'SUPERADMIN' },
          })
        }

        if (isFixedSuperadmin) {
          restaurantId = await resolvePrimaryRestaurantId()
          await prisma.restaurantMember.upsert({
            where: { restaurantId_userId: { restaurantId, userId: user.id } },
            create: { restaurantId, userId: user.id, role: 'OWNER' },
            update: { role: 'OWNER' },
            select: { id: true },
          })
        }

        // legacy -> new role surface
        const platformRole =
          isFixedSuperadmin
            ? 'SUPERADMIN'
            : (user.platformRole ?? (user.role === 'SUPERADMIN' ? 'SUPERADMIN' : 'NONE'))

        let memberRole: any = undefined
        try {
          const m = await prisma.restaurantMember.findUnique({
            where: { restaurantId_userId: { restaurantId, userId: user.id } },
            select: { role: true },
          })
          memberRole = m?.role ?? undefined
        } catch {
          memberRole = undefined
        }

        // migrate legacy per-user roles into default membership (only for default tenant)
        if (!memberRole && restaurantId === 'default' && (user.role === 'OWNER' || user.role === 'ADMIN')) {
          const created = await prisma.restaurantMember.upsert({
            where: { restaurantId_userId: { restaurantId: 'default', userId: user.id } },
            create: { restaurantId: 'default', userId: user.id, role: user.role },
            update: {},
            select: { role: true },
          })
          memberRole = created?.role
        }

        // если в текущем заведении (default или по startParam) нет роли — взять заведение, где пользователь OWNER/ADMIN (создал через «Завести свой ресторан»)
        if (!memberRole) {
          const adminMembership = await prisma.restaurantMember.findFirst({
            where: { userId: user.id, role: { in: ['OWNER', 'ADMIN'] } },
            orderBy: { restaurantId: 'asc' },
            select: { restaurantId: true, role: true },
          })
          if (adminMembership) {
            restaurantId = adminMembership.restaurantId
            memberRole = adminMembership.role
          } else if (restaurantId === 'default' && allowAutoDefaultOwner()) {
            const defaultMemberCount = await prisma.restaurantMember.count({
              where: { restaurantId: 'default' },
            })
            if (defaultMemberCount === 0) {
              const created = await prisma.restaurantMember.create({
                data: { restaurantId: 'default', userId: user.id, role: 'OWNER' },
                select: { role: true },
              })
              memberRole = created.role
            }
          }
        }

        return {
          id: user.id,
          email: user.email ?? email,
          name: user.name,
          telegramId: tgFields.telegramId,
          telegramUsername: tgFields.telegramUsername ?? undefined,
          restaurantId,
          platformRole,
          memberRole,
          role: user.role,
        }
      }
    }),
    CredentialsProvider({
      id: 'admin',
      name: 'admin',
      credentials: {
        login: { label: 'login', type: 'text' },
        password: { label: 'password', type: 'password' },
      },
      async authorize(credentials) {
        const login = String(credentials?.login ?? '').trim()
        const password = String(credentials?.password ?? '')

        const expectedLogin = String(process.env.ADMIN_LOGIN ?? '').trim()
        const expectedPassword = String(process.env.ADMIN_PASSWORD ?? '')

        // If not configured, disable provider
        if (!expectedLogin || !expectedPassword) return null

        const safeEq = (a: string, b: string) => {
          try {
            const aa = Buffer.from(a)
            const bb = Buffer.from(b)
            if (aa.length !== bb.length) return false
            return crypto.timingSafeEqual(aa, bb)
          } catch {
            return false
          }
        }

        if (!safeEq(login, expectedLogin) || !safeEq(password, expectedPassword)) return null

        const email = 'admin@local'
        const user = await prisma.user.upsert({
          where: { email },
          create: {
            email,
            name: 'superadmin',
            passwordHash: crypto.randomBytes(32).toString('hex'),
            role: 'SUPERADMIN',
            platformRole: 'SUPERADMIN',
          },
          update: { role: 'SUPERADMIN', platformRole: 'SUPERADMIN', name: 'superadmin' },
        })

        // ensure default tenant exists
        await prisma.restaurant.upsert({
          where: { id: 'default' },
          create: { id: 'default', name: 'default', slug: 'default', isActive: true },
          update: {},
          select: { id: true },
        })

        return {
          id: user.id,
          email: user.email ?? email,
          name: user.name,
          restaurantId: 'default',
          platformRole: 'SUPERADMIN',
          memberRole: 'OWNER',
          role: user.role,
        }
      },
    }),
    CredentialsProvider({
      id: 'owner',
      name: 'owner',
      credentials: {
        login: { label: 'login', type: 'text' },
        password: { label: 'password', type: 'password' },
      },
      async authorize(credentials) {
        const login = String(credentials?.login ?? '').trim()
        const password = String(credentials?.password ?? '')

        if (!login || !password) return null

        const isNumeric = /^\d+$/.test(login)
        const user = isNumeric
          ? await prisma.user.findFirst({
              where: { telegramId: login },
              select: { id: true, email: true, name: true, passwordHash: true, telegramId: true, role: true, platformRole: true },
            })
          : await prisma.user.findUnique({
              where: { email: login },
              select: { id: true, email: true, name: true, passwordHash: true, telegramId: true, role: true, platformRole: true },
            })

        if (!user?.passwordHash) return null
        const match = await bcrypt.compare(password, user.passwordHash)
        if (!match) return null

        await prisma.restaurant.upsert({
          where: { id: 'default' },
          create: { id: 'default', name: 'default', slug: 'default', isActive: true },
          update: {},
          select: { id: true },
        })

        let restaurantId = 'default'
        let memberRole: string | undefined
        try {
          // Prefer a venue where user is OWNER or ADMIN so they get access to the cabinet
          const m =
            (await prisma.restaurantMember.findFirst({
              where: { userId: user.id, role: { in: ['OWNER', 'ADMIN'] } },
              orderBy: { restaurantId: 'asc' },
              select: { restaurantId: true, role: true },
            })) ??
            (await prisma.restaurantMember.findFirst({
              where: { userId: user.id },
              orderBy: { restaurantId: 'asc' },
              select: { restaurantId: true, role: true },
            }))
          if (m) {
            restaurantId = m.restaurantId
            memberRole = m.role
          }
        } catch {
          // ignore
        }

        const platformRole = user.platformRole ?? (user.role === 'SUPERADMIN' ? 'SUPERADMIN' : 'NONE')

        return {
          id: user.id,
          email: user.email ?? `tg_${user.telegramId ?? ''}@telegram.local`,
          name: user.name,
          telegramId: user.telegramId ?? '',
          restaurantId,
          platformRole,
          memberRole: (memberRole as 'OWNER' | 'ADMIN' | 'STAFF') ?? undefined,
          role: user.role,
        }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  useSecureCookies: process.env.NODE_ENV === 'production',
  cookies:
    process.env.NODE_ENV === 'production'
      ? {
          sessionToken: {
            name: '__Secure-next-auth.session-token',
            options: {
              httpOnly: true,
              sameSite: 'none',
              path: '/',
              secure: true,
            },
          },
          callbackUrl: {
            name: '__Secure-next-auth.callback-url',
            options: {
              sameSite: 'none',
              path: '/',
              secure: true,
            },
          },
          csrfToken: {
            name: '__Host-next-auth.csrf-token',
            options: {
              httpOnly: true,
              sameSite: 'none',
              path: '/',
              secure: true,
            },
          },
        }
      : undefined,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const id = String((user as any).id)
        token.sub = id
        ;(token as any).id = id
        token.telegramId = (user as any).telegramId
        ;(token as any).telegramUsername = (user as any).telegramUsername
        ;(token as any).role = (user as any).role
        ;(token as any).restaurantId = (user as any).restaurantId
        ;(token as any).platformRole = (user as any).platformRole
        ;(token as any).memberRole = (user as any).memberRole
        token.name = (user as any).name
        token.email = (user as any).email
        token.picture = (user as any).image
      }

      if (token.sub && !(token as any).telegramUsername) {
        try {
          const u = await prisma.user.findUnique({
            where: { id: String(token.sub) },
            select: { telegramUsername: true, telegramId: true, telegramPhotoUrl: true },
          })
          if (u?.telegramUsername) (token as any).telegramUsername = u.telegramUsername
          if (u?.telegramId) token.telegramId = u.telegramId
          if (u?.telegramPhotoUrl) token.picture = u.telegramPhotoUrl
        } catch {
          // ignore
        }
      }

      // roles can change (manual assignment); refresh lazily
      if (token.sub && (!(token as any).platformRole || !(token as any).restaurantId)) {
        try {
          const u = await prisma.user.findUnique({
            where: { id: String(token.sub) },
            select: { role: true, platformRole: true },
          })
          if (u?.role) (token as any).role = u.role
          if (u?.platformRole) (token as any).platformRole = u.platformRole
        } catch {
          // ignore
        }
      }

      // ensure legacy SUPERADMIN always implies platform SUPERADMIN (avoid "stuck" NONE)
      if ((token as any).role === 'SUPERADMIN' && (token as any).platformRole !== 'SUPERADMIN') {
        ;(token as any).platformRole = 'SUPERADMIN'
      }

      // Refresh memberRole/restaurantId from DB on every session touch. This prevents stale JWTs
      // from showing owner UI after the active membership moved or disappeared.
      if (token.sub && (token as any).restaurantId) {
        try {
          const rid = String((token as any).restaurantId || 'default')
          const m = await prisma.restaurantMember.findUnique({
            where: { restaurantId_userId: { restaurantId: rid, userId: String(token.sub) } },
            select: { role: true },
          })
          if (m?.role) {
            ;(token as any).memberRole = m.role
          } else if ((token as any).platformRole !== 'SUPERADMIN') {
            const fallback = await prisma.restaurantMember.findFirst({
              where: { userId: String(token.sub), role: { in: ['OWNER', 'ADMIN'] } },
              orderBy: { restaurantId: 'asc' },
              select: { restaurantId: true, role: true },
            })
            if (fallback) {
              ;(token as any).restaurantId = fallback.restaurantId
              ;(token as any).memberRole = fallback.role
            } else {
              delete (token as any).memberRole
            }
          }
        } catch {
          // ignore
        }
      }

      // Global pipeline normalization for single-restaurant mode.
      // Keeps all admin/owner/consumer flows on one tenant with stable roles.
      const primaryRestaurantId = await resolvePrimaryRestaurantId().catch(() => 'default')
      if (primaryRestaurantId) {
        ;(token as any).restaurantId = primaryRestaurantId
      }

      // После подмены restaurantId на primary снова выровнять memberRole: иначе JWT остаётся с ролью
      // от предыдущего rid, а список заведений в ЛК (getOwnerVenues) и контекст расходятся с шапкой.
      if (token.sub && primaryRestaurantId) {
        try {
          const atPrimary = await prisma.restaurantMember.findUnique({
            where: {
              restaurantId_userId: { restaurantId: primaryRestaurantId, userId: String(token.sub) },
            },
            select: { role: true },
          })
          if (atPrimary?.role) {
            ;(token as any).memberRole = atPrimary.role
          } else if ((token as any).platformRole !== 'SUPERADMIN') {
            const fallback = await prisma.restaurantMember.findFirst({
              where: { userId: String(token.sub), role: { in: ['OWNER', 'ADMIN'] } },
              orderBy: { restaurantId: 'asc' },
              select: { restaurantId: true, role: true },
            })
            if (fallback) {
              ;(token as any).restaurantId = fallback.restaurantId
              ;(token as any).memberRole = fallback.role
            } else {
              delete (token as any).memberRole
            }
          }
        } catch {
          // ignore
        }
      }

      const tokenTelegramId = String((token as any).telegramId || '').trim()
      const isFixedSuperadminByToken = tokenTelegramId.length > 0 && SUPERADMIN_TELEGRAM_IDS.includes(tokenTelegramId)
      if (isFixedSuperadminByToken) {
        ;(token as any).platformRole = 'SUPERADMIN'
        ;(token as any).role = 'SUPERADMIN'
        ;(token as any).memberRole = 'OWNER'
      }
      return token as JWT
    },
    async session({ session, token }) {
      ;(session as any).restaurantId = (token as any).restaurantId
      if (session.user) {
        const id = (token as any).id ?? token.sub
        session.user.id = typeof id === 'string' ? id : String(id ?? '')
        session.user.telegramId = (token as any).telegramId
        ;(session.user as any).telegramUsername = (token as any).telegramUsername
        session.user.role = (token as any).role
        ;(session.user as any).platformRole = (token as any).platformRole
        ;(session.user as any).memberRole = (token as any).memberRole
        session.user.name = (token as any).name ?? session.user.name
        session.user.email = (token as any).email ?? session.user.email
        session.user.image = (token as any).picture ?? session.user.image
      }
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
}
