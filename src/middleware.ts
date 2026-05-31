import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl
  if (!pathname.startsWith('/admin')) {
    return NextResponse.next()
  }
  const hasCookie = request.cookies.has('ufo_restaurant')
  const venue = searchParams.get('venue')
  if (!hasCookie && venue) {
    const redirectUrl = new URL('/api/restaurant/switch', request.url)
    redirectUrl.searchParams.set('venue', venue)
    redirectUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(redirectUrl)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
}
