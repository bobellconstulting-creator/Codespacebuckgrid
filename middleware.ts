// Subscription paywall middleware.
//
// Protects:
//   /api/chat        — Tony AI (hunting)
//   /api/agri-tony   — Tony AI (agri)
//   /agri            — Agri page (gated UI)
//
// Access is granted when the request carries a valid `bg_sub_email` cookie
// whose value is base64url-encoded and matches an active subscriber.
//
// NOTE: cookie verification is intentionally lightweight (no JWT) because
// the real enforcement is the Stripe webhook → subscribers.json.  A user
// who fakes the cookie still gets the UI but gets no new data — the
// API routes re-verify on every call via checkSubscriptionCookie().

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { SUB_COOKIE } from './lib/sub-cookie'

const GATED_API_PREFIXES = ['/api/chat', '/api/agri-tony']
const GATED_PAGES = ['/agri']

function isGated(pathname: string): boolean {
  if (GATED_PAGES.some((p) => pathname === p || pathname.startsWith(p + '/'))) return true
  if (GATED_API_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))) return true
  return false
}

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl

  if (!isGated(pathname)) {
    return NextResponse.next()
  }

  const subCookie = req.cookies.get(SUB_COOKIE)

  if (!subCookie?.value) {
    return redirectToUpgrade(req, pathname)
  }

  // Decode email from cookie — basic sanity check
  try {
    const email = Buffer.from(subCookie.value, 'base64').toString('utf8')
    if (!email.includes('@')) {
      return redirectToUpgrade(req, pathname)
    }
    // Cookie present and looks valid — let the route handler do the authoritative DB check
    return NextResponse.next()
  } catch {
    return redirectToUpgrade(req, pathname)
  }
}

function redirectToUpgrade(req: NextRequest, from: string): NextResponse {
  const isApi = from.startsWith('/api/')
  if (isApi) {
    return NextResponse.json(
      { error: 'BuckGrid Pro subscription required', upgrade: '/upgrade' },
      { status: 402 }
    )
  }
  const url = req.nextUrl.clone()
  url.pathname = '/upgrade'
  url.searchParams.set('from', from)
  return NextResponse.redirect(url)
}

export const config = {
  matcher: [
    '/api/chat/:path*',
    '/api/agri-tony/:path*',
    '/agri/:path*',
    '/agri',
  ],
}
