/**
 * GET  /api/referral/codes — list all codes + hit counts
 * POST /api/referral/codes — create a new referral code
 *
 * Body for POST: { name: string }
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import {
  getAllCodes,
  createCode,
  getAllHits,
} from '../../../../lib/referral-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Simple shared secret guard for the admin API.
// Set REFERRAL_ADMIN_SECRET in Vercel env. Omit to disable auth (dev only).
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.REFERRAL_ADMIN_SECRET
  if (!secret) return true // dev mode — no secret configured
  const header = req.headers.get('x-admin-secret')
  return header === secret
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const codes = getAllCodes()
  const hits = getAllHits()

  // Build hit count map
  const hitCounts: Record<string, number> = {}
  for (const hit of hits) {
    hitCounts[hit.code] = (hitCounts[hit.code] ?? 0) + 1
  }

  const data = codes.map((c) => ({
    ...c,
    hits: hitCounts[c.code] ?? 0,
  }))

  return NextResponse.json({ success: true, data })
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  let body: { name?: string }

  try {
    body = (await req.json()) as { name?: string }
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const { name } = body

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json(
      { success: false, error: 'name is required' },
      { status: 400 }
    )
  }

  if (name.trim().length > 64) {
    return NextResponse.json(
      { success: false, error: 'name must be 64 chars or fewer' },
      { status: 400 }
    )
  }

  const code = createCode(name.trim())

  return NextResponse.json({ success: true, data: code }, { status: 201 })
}
