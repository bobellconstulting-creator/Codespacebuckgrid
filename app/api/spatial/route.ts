import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ─── Types ───────────────────────────────────────────────────────────────────

type Bounds = { north: number; south: number; east: number; west: number }

export interface OsmFeature {
  kind: 'water' | 'building' | 'forest' | 'road' | 'wetland'
  name?: string
  // Centroid or representative point [lng, lat] — used for distance checks
  point: [number, number]
  // Simplified bounding box [west, south, east, north]
  bbox?: [number, number, number, number]
}

export interface ElevationSample {
  lat: number
  lng: number
  elevationM: number
}

export interface SpatialContext {
  osmFeatures: OsmFeature[]
  elevationSummary: string      // Human-readable paragraph for Tony's prompt
  elevationSamples: ElevationSample[]
  highGroundPoints: Array<{ lat: number; lng: number; elevationM: number }>
  lowGroundPoints: Array<{ lat: number; lng: number; elevationM: number }>
  fetchedAt: number
}

// ─── Bounds validation ───────────────────────────────────────────────────────

function isValidBounds(b: unknown): b is Bounds {
  if (!b || typeof b !== 'object') return false
  const { north, south, east, west } = b as Bounds
  return [north, south, east, west].every(v => typeof v === 'number' && isFinite(v))
    && north > south && east !== west
    && north <= 90 && south >= -90
    && east <= 180 && west >= -180
}

// Reject obviously oversized areas — Overpass and elevation grid would be huge
function boundsAreaDegreesSq(b: Bounds): number {
  return (b.north - b.south) * Math.abs(b.east - b.west)
}

// ─── Overpass (OSM land cover) ───────────────────────────────────────────────

// Maps OSM tags to our feature kinds
const OSM_QUERIES: Array<{ tag: string; kind: OsmFeature['kind'] }> = [
  { tag: '["natural"="water"]',         kind: 'water'    },
  { tag: '["waterway"~"river|stream|ditch"]', kind: 'water' },
  { tag: '["landuse"="reservoir"]',     kind: 'water'    },
  { tag: '["natural"="wetland"]',       kind: 'wetland'  },
  { tag: '["landuse"="wetland"]',       kind: 'wetland'  },
  { tag: '["building"]',                kind: 'building' },
  { tag: '["natural"="wood"]',          kind: 'forest'   },
  { tag: '["landuse"="forest"]',        kind: 'forest'   },
  { tag: '["highway"~"primary|secondary|residential|unclassified|track"]', kind: 'road' },
]

// Centroid of a set of [lat, lng] node coordinates
function nodeCentroid(nodes: Array<{ lat: number; lon: number }>): [number, number] {
  const latSum = nodes.reduce((s, n) => s + n.lat, 0)
  const lonSum = nodes.reduce((s, n) => s + n.lon, 0)
  return [lonSum / nodes.length, latSum / nodes.length]
}

// Build a single Overpass QL query that fetches ways + nodes for all tag groups
function buildOverpassQuery(bounds: Bounds): string {
  const bbox = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`
  const lines: string[] = ['[out:json][timeout:25];', '(']
  for (const { tag } of OSM_QUERIES) {
    lines.push(`  way${tag}(${bbox});`)
    lines.push(`  node${tag}(${bbox});`)
  }
  lines.push(');', 'out body;', '>;', 'out skel qt;')
  return lines.join('\n')
}

async function fetchOsmFeatures(bounds: Bounds): Promise<OsmFeature[]> {
  const query = buildOverpassQuery(bounds)
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) throw new Error(`Overpass ${res.status}`)
  const json = await res.json()

  // Build a node lookup by id — Overpass returns referenced nodes after 'out body; >;'
  const nodeById = new Map<number, { lat: number; lon: number }>()
  for (const el of json.elements) {
    if (el.type === 'node') nodeById.set(el.id, { lat: el.lat, lon: el.lon })
  }

  const features: OsmFeature[] = []

  for (const el of json.elements) {
    if (el.type !== 'way' && el.type !== 'node') continue

    // Determine which kind applies — first matching tag group wins
    let kind: OsmFeature['kind'] | null = null
    const tags = el.tags ?? {}

    if (tags.natural === 'water' || tags.waterway || tags.landuse === 'reservoir') kind = 'water'
    else if (tags.natural === 'wetland' || tags.landuse === 'wetland') kind = 'wetland'
    else if (tags.building) kind = 'building'
    else if (tags.natural === 'wood' || tags.landuse === 'forest') kind = 'forest'
    else if (tags.highway) kind = 'road'

    if (!kind) continue

    let point: [number, number]
    let bbox: [number, number, number, number] | undefined

    if (el.type === 'node') {
      point = [el.lon, el.lat]
    } else {
      // way — resolve node refs
      const nodes = (el.nodes ?? [])
        .map((id: number) => nodeById.get(id))
        .filter(Boolean) as Array<{ lat: number; lon: number }>
      if (nodes.length === 0) continue
      point = nodeCentroid(nodes)
      const lats = nodes.map(n => n.lat)
      const lons = nodes.map(n => n.lon)
      bbox = [
        Math.min(...lons), Math.min(...lats),
        Math.max(...lons), Math.max(...lats),
      ]
    }

    features.push({
      kind,
      name: tags.name,
      point,
      bbox,
    })
  }

  // Cap to 200 features to keep payload manageable — keep water + buildings first
  const priority = (f: OsmFeature) => (f.kind === 'water' || f.kind === 'building' || f.kind === 'wetland') ? 0 : 1
  features.sort((a, b) => priority(a) - priority(b))
  return features.slice(0, 200)
}

// ─── USGS Elevation ───────────────────────────────────────────────────────────

// Sample elevation at a grid point using USGS Elevation Point Query Service.
// Returns elevation in meters, or null on failure.
async function fetchElevationPoint(lat: number, lng: number): Promise<number | null> {
  const url = `https://epqs.nationalmap.gov/v1/json?x=${lng}&y=${lat}&wkid=4326&includeDate=false`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) })
    if (!res.ok) return null
    const json = await res.json()
    // Response shape: { value: "123.45" } or { value: "-1000000" } for nodata
    const raw = parseFloat(json.value)
    if (!isFinite(raw) || raw < -500 || raw > 9000) return null
    // USGS returns feet — convert to meters
    return raw * 0.3048
  } catch {
    return null
  }
}

// Build a grid of sample points within bounds, limited to GRID_N x GRID_N
// to stay within the 8-second total budget per point.
// 4x4 = 16 points — manageable with Promise.all and individual 8s timeouts.
const GRID_N = 4

async function fetchElevationGrid(bounds: Bounds): Promise<ElevationSample[]> {
  const { north, south, east, west } = bounds
  const latStep = (north - south) / (GRID_N - 1)
  const lngStep = (east - west) / (GRID_N - 1)

  const points: Array<{ lat: number; lng: number }> = []
  for (let r = 0; r < GRID_N; r++) {
    for (let c = 0; c < GRID_N; c++) {
      points.push({
        lat: south + r * latStep,
        lng: west + c * lngStep,
      })
    }
  }

  // Fetch all points in parallel — individual timeouts already set per-request
  const results = await Promise.all(
    points.map(async ({ lat, lng }) => {
      const elevationM = await fetchElevationPoint(lat, lng)
      return elevationM !== null ? { lat, lng, elevationM } : null
    })
  )

  return results.filter((r): r is ElevationSample => r !== null)
}

// Summarize elevation samples into a human-readable string for Tony's prompt
function summarizeElevation(samples: ElevationSample[]): {
  summary: string
  highGroundPoints: Array<{ lat: number; lng: number; elevationM: number }>
  lowGroundPoints: Array<{ lat: number; lng: number; elevationM: number }>
} {
  if (samples.length === 0) {
    return { summary: 'Elevation data unavailable for this area.', highGroundPoints: [], lowGroundPoints: [] }
  }

  const elevs = samples.map(s => s.elevationM)
  const minElev = Math.min(...elevs)
  const maxElev = Math.max(...elevs)
  const relief = maxElev - minElev

  // Sort samples by elevation
  const sorted = [...samples].sort((a, b) => b.elevationM - a.elevationM)
  // Top quartile = high ground, bottom quartile = low ground
  const q = Math.max(1, Math.floor(sorted.length / 4))
  const highGroundPoints = sorted.slice(0, q)
  const lowGroundPoints = sorted.slice(-q)

  // Relief classification
  let terrainType: string
  if (relief < 3) terrainType = 'very flat terrain (minimal relief)'
  else if (relief < 10) terrainType = 'gently rolling terrain'
  else if (relief < 30) terrainType = 'moderately hilly terrain'
  else terrainType = 'significant topographic relief'

  const highPt = highGroundPoints[0]
  const lowPt = lowGroundPoints[0]

  const lines: string[] = [
    `Terrain: ${terrainType}. Elevation range ${minElev.toFixed(0)}m to ${maxElev.toFixed(0)}m (${relief.toFixed(0)}m relief).`,
  ]

  if (relief >= 5) {
    lines.push(
      `High ground: lat ${highPt.lat.toFixed(5)}, lng ${highPt.lng.toFixed(5)} at ${highPt.elevationM.toFixed(0)}m — elevated stand/observation potential.`,
      `Low ground: lat ${lowPt.lat.toFixed(5)}, lng ${lowPt.lng.toFixed(5)} at ${lowPt.elevationM.toFixed(0)}m — likely drainage, creek bottom, or wet area. Avoid stand placement here.`,
    )
  } else {
    lines.push('Minimal elevation change — terrain advantage limited. Focus on vegetation edges and food proximity for stand sites.')
  }

  return {
    summary: lines.join(' '),
    highGroundPoints,
    lowGroundPoints,
  }
}

// ─── In-memory cache (per bounds key, 30-minute TTL) ─────────────────────────

interface CacheEntry {
  data: SpatialContext
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

function boundsKey(b: Bounds): string {
  // Round to ~1km precision for cache hits on nearly-identical views
  return [b.north, b.south, b.east, b.west].map(v => v.toFixed(3)).join(',')
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { bounds } = body

    if (!isValidBounds(bounds)) {
      return NextResponse.json({ error: 'Valid bounds required' }, { status: 400 })
    }

    // Reject very large areas — Overpass query would be expensive
    if (boundsAreaDegreesSq(bounds) > 0.25) {
      return NextResponse.json({ error: 'Bounds too large — zoom in closer to your property' }, { status: 400 })
    }

    // Cache check
    const key = boundsKey(bounds)
    const cached = cache.get(key)
    if (cached && Date.now() < cached.expiresAt) {
      return NextResponse.json(cached.data)
    }

    // Fetch OSM and elevation in parallel — each has its own timeout
    const [osmFeatures, elevationSamples] = await Promise.all([
      fetchOsmFeatures(bounds).catch((): OsmFeature[] => []),
      fetchElevationGrid(bounds).catch((): ElevationSample[] => []),
    ])

    const { summary: elevationSummary, highGroundPoints, lowGroundPoints } = summarizeElevation(elevationSamples)

    const result: SpatialContext = {
      osmFeatures,
      elevationSummary,
      elevationSamples,
      highGroundPoints,
      lowGroundPoints,
      fetchedAt: Date.now(),
    }

    // Store in cache
    cache.set(key, { data: result, expiresAt: Date.now() + CACHE_TTL_MS })

    return NextResponse.json(result)
  } catch (err) {
    console.error('[spatial] error:', err)
    return NextResponse.json({ error: 'Spatial data fetch failed' }, { status: 500 })
  }
}
