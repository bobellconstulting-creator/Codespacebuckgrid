import { NextRequest, NextResponse } from 'next/server'
import { compassLabel } from '@/components/buckgrid/wind/windCall'

// GET /api/wind?lat=..&lng=..
// Current wind at the property from Open-Meteo — free, no key, no LLM tokens.
// Held server-side: per-instance memory cache + CDN s-maxage so a property
// being hammered by one group chat costs one upstream call every 10 minutes.

const TTL_MS = 10 * 60 * 1000
const cache = new Map<string, { exp: number; body: WindBody }>()

type WindBody = { speedMph: number; directionDeg: number; compass: string }

export async function GET(req: NextRequest) {
  const lat = parseFloat(req.nextUrl.searchParams.get('lat') ?? '')
  const lng = parseFloat(req.nextUrl.searchParams.get('lng') ?? '')
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: 'lat/lng required' }, { status: 400 })
  }

  // ~3-mile buckets — wind doesn't change across a property line
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`
  const hit = cache.get(key)
  if (hit && hit.exp > Date.now()) {
    return windResponse(hit.body)
  }

  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 8000)
    let res: Response
    try {
      res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
          `&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=mph`,
        { signal: ctrl.signal }
      )
    } finally {
      clearTimeout(timer)
    }
    if (!res.ok) throw new Error(`upstream ${res.status}`)
    const data = await res.json()
    const speed = Number(data?.current?.wind_speed_10m)
    const dir = Number(data?.current?.wind_direction_10m)
    if (!Number.isFinite(speed) || !Number.isFinite(dir)) throw new Error('bad upstream payload')

    const body: WindBody = {
      speedMph: Math.round(speed),
      directionDeg: Math.round(dir),
      compass: compassLabel(dir),
    }
    cache.set(key, { exp: Date.now() + TTL_MS, body })
    return windResponse(body)
  } catch {
    return NextResponse.json({ error: 'wind unavailable' }, { status: 502 })
  }
}

function windResponse(body: WindBody) {
  return NextResponse.json(body, {
    headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200' },
  })
}
