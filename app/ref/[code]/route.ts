/**
 * GET /ref/[code] — Referral entry point
 *
 * Sets a 30-day `buckgrid_ref` cookie, logs the hit, and redirects to /.
 * Route handlers can write response cookies; Server Component pages cannot.
 *
 * Share links look like: https://codespacebuckgrid.vercel.app/ref/jake-smith
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getCode, recordHit } from '../../../lib/referral-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RouteContext {
  params: { code: string }
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { code } = params

  const userAgent = req.headers.get('user-agent') ?? 'unknown'
  const forwardedFor = req.headers.get('x-forwarded-for') ?? undefined
  const referer = req.headers.get('referer') ?? '/'

  const referralCode = getCode(code)

  if (referralCode) {
    recordHit({
      code,
      timestamp: new Date().toISOString(),
      userAgent,
      page: referer,
      ip: forwardedFor,
    })
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://codespacebuckgrid.vercel.app'

  const response = NextResponse.redirect(new URL('/', siteUrl), { status: 302 })

  if (referralCode) {
    // Set 30-day attribution cookie, readable by client JS for ShareBuckGrid
    response.cookies.set('buckgrid_ref', code, {
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
      sameSite: 'lax',
      httpOnly: false,
    })
  }

  return response
}
