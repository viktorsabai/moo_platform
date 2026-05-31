import 'next-auth'

declare module 'next-auth' {
  type PlatformRole = 'NONE' | 'SUPERADMIN'
  type RestaurantRole = 'OWNER' | 'ADMIN' | 'STAFF'
  type LegacyUserRole = 'CUSTOMER' | 'ADMIN' | 'OWNER' | 'SUPERADMIN'

  interface Session {
    restaurantId?: string
    user: {
      id: string
      email: string
      name?: string | null
      telegramId?: string
      image?: string | null
      // new multi-tenant roles
      platformRole?: PlatformRole
      memberRole?: RestaurantRole
      // legacy (kept during migration)
      role?: LegacyUserRole
    }
  }

  interface User {
    id: string
    email: string
    name?: string | null
    telegramId?: string
    image?: string | null
    platformRole?: PlatformRole
    memberRole?: RestaurantRole
    restaurantId?: string
    role?: LegacyUserRole
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    telegramId?: string
    restaurantId?: string
    platformRole?: 'NONE' | 'SUPERADMIN'
    memberRole?: 'OWNER' | 'ADMIN' | 'STAFF'
    role?: 'CUSTOMER' | 'ADMIN' | 'OWNER' | 'SUPERADMIN'
  }
}




