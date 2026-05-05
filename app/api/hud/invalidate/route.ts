import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Agents POST here after appending to FLEET-FEED.md to bust the graph cache.
// This module reference trick clears the cache in the graph route's module scope.
// Works because Next.js shares module instances within the same Node.js process.

// We use a global flag rather than importing the cache directly to avoid
// circular module issues. The graph route checks this flag on every request.
declare global {
  // eslint-disable-next-line no-var
  var __hudCacheInvalidated: number
}

export async function POST(): Promise<NextResponse> {
  // Set a global timestamp that the graph route can check
  global.__hudCacheInvalidated = Date.now()
  return NextResponse.json({ ok: true, invalidatedAt: global.__hudCacheInvalidated })
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ ok: true, hint: 'POST to invalidate the HUD graph cache' })
}
