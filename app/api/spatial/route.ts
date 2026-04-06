import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { fetchSpatialData, isValidBounds, boundsAreaDegreesSq } from '../../../lib/spatial'

export type { OsmFeature, ElevationSample, SpatialContext } from '../../../lib/spatial'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { bounds } = body

    if (!isValidBounds(bounds)) {
      return NextResponse.json({ error: 'Valid bounds required' }, { status: 400 })
    }

    if (boundsAreaDegreesSq(bounds) > 0.25) {
      return NextResponse.json({ error: 'Bounds too large — zoom in closer to your property' }, { status: 400 })
    }

    const result = await fetchSpatialData(bounds)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[spatial] error:', err)
    return NextResponse.json({ error: 'Spatial data fetch failed' }, { status: 500 })
  }
}
