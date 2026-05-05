/**
 * POST /api/referral/track
 *
 * Body: { code: string; page?: string }
 *
 * Records a referral hit. Called client-side when a page loads and
 * a `buckgrid_ref` cookie is present.
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { recordHit } from '../../../../lib/referral-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface TrackBody {
  code: string
  page?: string
}

export async function POST(req: NextRequest) {
  let body: TrackBody

  try {
    body = (await req.json()) as TrackBody
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const { code, page } = body

  if (!code || typeof code !== 'string' || code.length > 64) {
    return NextResponse.json(
      { success: false, error: 'Missing or invalid code' },
      { status: 400 }
    )
  }

  const userAgent =
    req.headers.get('user-agent') ?? 'unknown'
  const forwardedFor =
    req.headers.get('x-forwarded-for') ?? undefined

  recordHit({
    code,
    timestamp: new Date().toISOString(),
    userAgent,
    page: page ?? req.headers.get('referer') ?? 'unknown',
    ip: forwardedFor,
  })

  return NextResponse.json({ success: true })
}
