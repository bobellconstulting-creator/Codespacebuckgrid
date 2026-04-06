// Shared spatial logic — used by /api/spatial and /api/chat server-side
import { fetchSoilData, summarizeSoilForTony, type SoilMapUnit } from './soil-sda'
import { fetchNlcdGrid, summarizeNlcdForTony, type NlcdSample } from './nlcd'
import { fetchWindRose, type WindRoseSummary } from './wind-rose'
import { fetchDeerPressure, type DeerPressureSummary } from './deer-pressure'

export type Bounds = { north: number; south: number; east: number; west: number }

export interface OsmFeature {
  kind: 'water' | 'building' | 'forest' | 'road' | 'wetland' | 'farmland' | 'scrub'
  name?: string
  point: [number, number]
  bbox?: [number, number, number, number]
}

export interface ElevationSample {
  lat: number
  lng: number
  elevationM: number
}

export interface NwiWetlandSummary {
  types: string[]
  totalAcres: number
  hasForestWetland: boolean
  hasEmergentMarsh: boolean
}

export interface TerrainDerivatives {
  avgSlopeDegrees: number
  dominantAspect: string
  slopeCategory: string
  slopeDescription: string
}

export interface SpatialContext {
  osmFeatures: OsmFeature[]
  elevationSummary: string
  elevationSamples: ElevationSample[]
  highGroundPoints: Array<{ lat: number; lng: number; elevationM: number }>
  lowGroundPoints: Array<{ lat: number; lng: number; elevationM: number }>
  windDirection?: string
  fetchedAt: number
  // Phase 3 enrichments
  soilUnits?: SoilMapUnit[]
  soilSummary?: string
  landCoverSamples?: NlcdSample[]
  landCoverSummary?: string
  // Phase 4 enrichments
  nwiWetlands?: NwiWetlandSummary
  neighboringCrops?: string[]
  terrainDerivatives?: TerrainDerivatives
  // Phase 5 enrichments
  windRose?: WindRoseSummary
  deerPressure?: DeerPressureSummary
}

// Re-export new types so route.ts can use them without direct imports
export type { WindRoseSummary, DeerPressureSummary }

export function isValidBounds(b: unknown): b is Bounds {
  if (!b || typeof b !== 'object') return false
  const { north, south, east, west } = b as Bounds
  return [north, south, east, west].every(v => typeof v === 'number' && isFinite(v))
    && north > south && east !== west
    && north <= 90 && south >= -90
    && east <= 180 && west >= -180
}

export function boundsAreaDegreesSq(b: Bounds): number {
  return (b.north - b.south) * Math.abs(b.east - b.west)
}

const OSM_QUERIES: Array<{ tag: string; kind: OsmFeature['kind'] }> = [
  { tag: '["natural"="water"]',         kind: 'water'    },
  { tag: '["waterway"~"river|stream|ditch|drain|canal"]', kind: 'water' },
  { tag: '["landuse"="reservoir"]',     kind: 'water'    },
  { tag: '["natural"="wetland"]',       kind: 'wetland'  },
  { tag: '["landuse"="wetland"]',       kind: 'wetland'  },
  { tag: '["building"]',                kind: 'building' },
  { tag: '["natural"="wood"]',          kind: 'forest'   },
  { tag: '["landuse"="forest"]',        kind: 'forest'   },
  { tag: '["highway"~"primary|secondary|residential|unclassified|track"]', kind: 'road' },
  { tag: '["landuse"="farmland"]',      kind: 'farmland' },
  { tag: '["landuse"="meadow"]',        kind: 'farmland' },
  { tag: '["landuse"="orchard"]',       kind: 'farmland' },
  { tag: '["natural"="scrub"]',         kind: 'scrub'    },
  { tag: '["natural"="heath"]',         kind: 'scrub'    },
]

function nodeCentroid(nodes: Array<{ lat: number; lon: number }>): [number, number] {
  const latSum = nodes.reduce((s, n) => s + n.lat, 0)
  const lonSum = nodes.reduce((s, n) => s + n.lon, 0)
  return [lonSum / nodes.length, latSum / nodes.length]
}

function buildOverpassQuery(bounds: Bounds): string {
  const bbox = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`
  const lines: string[] = ['[out:json][timeout:15];', '(']
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

  const nodeById = new Map<number, { lat: number; lon: number }>()
  for (const el of json.elements) {
    if (el.type === 'node') nodeById.set(el.id, { lat: el.lat, lon: el.lon })
  }

  const features: OsmFeature[] = []
  for (const el of json.elements) {
    if (el.type !== 'way' && el.type !== 'node') continue
    let kind: OsmFeature['kind'] | null = null
    const tags = el.tags ?? {}
    if (tags.natural === 'water' || tags.waterway || tags.landuse === 'reservoir') kind = 'water'
    else if (tags.natural === 'wetland' || tags.landuse === 'wetland') kind = 'wetland'
    else if (tags.building) kind = 'building'
    else if (tags.natural === 'wood' || tags.landuse === 'forest') kind = 'forest'
    else if (tags.highway) kind = 'road'
    else if (tags.landuse === 'farmland' || tags.landuse === 'meadow' || tags.landuse === 'orchard') kind = 'farmland'
    else if (tags.natural === 'scrub' || tags.natural === 'heath') kind = 'scrub'
    if (!kind) continue

    let point: [number, number]
    let bbox: [number, number, number, number] | undefined
    if (el.type === 'node') {
      point = [el.lon, el.lat]
    } else {
      const nodes = (el.nodes ?? []).map((id: number) => nodeById.get(id)).filter(Boolean) as Array<{ lat: number; lon: number }>
      if (nodes.length === 0) continue
      point = nodeCentroid(nodes)
      const lats = nodes.map(n => n.lat)
      const lons = nodes.map(n => n.lon)
      bbox = [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)]
    }
    features.push({ kind, name: tags.name, point, bbox })
  }

  const priority = (f: OsmFeature) => (f.kind === 'water' || f.kind === 'building' || f.kind === 'wetland') ? 0 : 1
  features.sort((a, b) => priority(a) - priority(b))
  return features.slice(0, 200)
}

const GRID_N = 16   // 256 points — LiDAR-derived 10m resolution via USGS EPQS
const GRID_N_FALLBACK = 8  // Open-Meteo fallback if EPQS times out

async function fetchElevationGrid(bounds: Bounds): Promise<ElevationSample[]> {
  // Primary: USGS EPQS 3DEP (LiDAR-derived, ~10m, US only, free)
  const epqs = await fetchElevationGridEPQS(bounds).catch(() => null)
  if (epqs && epqs.length >= 50) return epqs
  // Fallback: Open-Meteo batch API (30m, global)
  return fetchElevationGridOpenMeteo(bounds, GRID_N_FALLBACK)
}

async function fetchElevationGridEPQS(bounds: Bounds): Promise<ElevationSample[]> {
  const { north, south, east, west } = bounds
  const latStep = (north - south) / (GRID_N - 1)
  const lngStep = (east - west) / (GRID_N - 1)
  const points: Array<{ lat: number; lng: number }> = []
  for (let r = 0; r < GRID_N; r++) {
    for (let c = 0; c < GRID_N; c++) {
      points.push({ lat: south + r * latStep, lng: west + c * lngStep })
    }
  }
  const CONCURRENCY = 25
  const results: ElevationSample[] = []
  for (let i = 0; i < points.length; i += CONCURRENCY) {
    const batch = points.slice(i, i + CONCURRENCY)
    const settled = await Promise.allSettled(
      batch.map(async pt => {
        const url = `https://epqs.nationalmap.gov/v1/json?x=${pt.lng.toFixed(6)}&y=${pt.lat.toFixed(6)}&units=Meters&wkid=4326&includeDate=false`
        const res = await fetch(url, { signal: AbortSignal.timeout(6_000) })
        if (!res.ok) return null
        const json = await res.json()
        const elev = Number(json.value)
        if (!isFinite(elev) || elev < -500 || elev > 9000) return null
        return { lat: pt.lat, lng: pt.lng, elevationM: elev }
      })
    )
    for (const r of settled) {
      if (r.status === 'fulfilled' && r.value) results.push(r.value)
    }
  }
  return results
}

async function fetchElevationGridOpenMeteo(bounds: Bounds, gridN: number): Promise<ElevationSample[]> {
  const { north, south, east, west } = bounds
  const latStep = (north - south) / (gridN - 1)
  const lngStep = (east - west) / (gridN - 1)
  const points: Array<{ lat: number; lng: number }> = []
  for (let r = 0; r < gridN; r++) {
    for (let c = 0; c < gridN; c++) {
      points.push({ lat: south + r * latStep, lng: west + c * lngStep })
    }
  }
  try {
    const lats = points.map(p => p.lat.toFixed(6)).join(',')
    const lngs = points.map(p => p.lng.toFixed(6)).join(',')
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`
    const res = await fetch(url, { signal: AbortSignal.timeout(5_000) })
    if (!res.ok) return []
    const json = await res.json()
    const elevations: unknown[] = Array.isArray(json.elevation) ? json.elevation : []
    return points.map((p, i) => {
      const raw = elevations[i]
      if (typeof raw !== 'number' || !isFinite(raw) || raw < -500 || raw > 9000) return null
      return { lat: p.lat, lng: p.lng, elevationM: raw }
    }).filter((s): s is ElevationSample => s !== null)
  } catch {
    return []
  }
}

function degreesToCompass(deg: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  return dirs[Math.round(deg / 22.5) % 16]
}

async function fetchPrevailingWind(bounds: Bounds): Promise<string | undefined> {
  try {
    const centerLat = ((bounds.north + bounds.south) / 2).toFixed(4)
    const centerLng = ((bounds.east + bounds.west) / 2).toFixed(4)
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${centerLat}&longitude=${centerLng}&hourly=winddirection_10m&past_days=7&forecast_days=0&timezone=auto`
    const res = await fetch(url, { signal: AbortSignal.timeout(4_000) })
    if (!res.ok) return undefined
    const json = await res.json()
    const dirs: unknown[] = Array.isArray(json.hourly?.winddirection_10m) ? json.hourly.winddirection_10m : []
    if (dirs.length === 0) return undefined
    const validDirs = dirs.filter((d): d is number => typeof d === 'number' && isFinite(d))
    if (validDirs.length === 0) return undefined
    const sinSum = validDirs.reduce((s, d) => s + Math.sin(d * Math.PI / 180), 0)
    const cosSum = validDirs.reduce((s, d) => s + Math.cos(d * Math.PI / 180), 0)
    const avgDeg = ((Math.atan2(sinSum, cosSum) * 180 / Math.PI) + 360) % 360
    return `${degreesToCompass(avgDeg)} (${avgDeg.toFixed(0)}°)`
  } catch {
    return undefined
  }
}

// ─── NWI Wetlands (USFWS ArcGIS REST — free, no key) ─────────────────────────
async function fetchNwiWetlands(bounds: Bounds): Promise<NwiWetlandSummary | undefined> {
  const bbox = `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`
  const url = 'https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/rest/services/Wetlands/MapServer/0/query?' +
    `geometry=${encodeURIComponent(bbox)}&geometryType=esriGeometryEnvelope&inSR=4326` +
    '&spatialRel=esriSpatialRelIntersects&outFields=WETLAND_TYPE,ACRES' +
    '&returnGeometry=false&resultRecordCount=50&f=json'
  const res = await fetch(url, { signal: AbortSignal.timeout(8_000) })
  if (!res.ok) return undefined
  const json = await res.json()
  if (!Array.isArray(json.features) || json.features.length === 0) return undefined
  const types = [...new Set<string>(
    json.features.map((f: Record<string, Record<string, unknown>>) => String(f.attributes?.WETLAND_TYPE ?? '')).filter(Boolean)
  )]
  const totalAcres = json.features.reduce((sum: number, f: Record<string, Record<string, unknown>>) => {
    const a = Number(f.attributes?.ACRES)
    return sum + (isFinite(a) ? a : 0)
  }, 0)
  return {
    types,
    totalAcres: Math.round(totalAcres * 10) / 10,
    hasForestWetland: types.some(t => t.toLowerCase().includes('forest') || t.toLowerCase().includes('shrub')),
    hasEmergentMarsh: types.some(t => t.toLowerCase().includes('emergent') || t.toLowerCase().includes('marsh')),
  }
}

// ─── CropScape CDL — sample nearby land use (USDA NASS, free, no key) ────────
async function fetchNeighboringCrops(bounds: Bounds): Promise<string[]> {
  const centerLat = (bounds.north + bounds.south) / 2
  const centerLng = (bounds.east + bounds.west) / 2
  const span = Math.max(bounds.north - bounds.south, Math.abs(bounds.east - bounds.west))
  const offset = Math.max(span * 0.8, 0.013) // ~1 mile minimum
  const pts: [number, number][] = [
    [centerLng, centerLat],
    [centerLng, centerLat + offset],
    [centerLng, centerLat - offset],
    [centerLng + offset, centerLat],
    [centerLng - offset, centerLat],
  ]
  const year = new Date().getFullYear() - 1
  const results: string[] = []
  for (const [lng, lat] of pts) {
    try {
      const url = `https://nassgeodata.gmu.edu/axis2/services/CDLService/GetCDLValue?year=${year}&x=${lng.toFixed(6)}&y=${lat.toFixed(6)}`
      const res = await fetch(url, { signal: AbortSignal.timeout(5_000) })
      if (!res.ok) continue
      const text = await res.text()
      const m = text.match(/<category_name>([^<]+)<\/category_name>/)
      if (m?.[1]) results.push(m[1])
    } catch { /* skip failed point */ }
  }
  const SKIP = new Set(['Background', 'Open Water', 'Cloud/Shadow', 'Developed/Open Space',
    'Developed/Low Intensity', 'Developed/Med Intensity', 'Developed/High Intensity'])
  return [...new Set(results)].filter(c => !SKIP.has(c))
}

// ─── Terrain derivatives from elevation grid (slope + aspect via Horn's method) ─
function computeTerrainDerivatives(samples: ElevationSample[], bounds: Bounds): TerrainDerivatives | undefined {
  if (samples.length < 9) return undefined
  const n = Math.round(Math.sqrt(samples.length))
  if (n < 3) return undefined
  const elevs = samples.slice(0, n * n).map(s => s.elevationM)
  if (elevs.length < n * n) return undefined

  const centerLat = (bounds.north + bounds.south) / 2
  const cellH = ((bounds.north - bounds.south) / (n - 1)) * 111000
  const cellW = ((bounds.east - bounds.west) / (n - 1)) * 111000 * Math.cos(centerLat * Math.PI / 180)
  if (cellH <= 0 || cellW <= 0) return undefined

  let slopeSum = 0, dxSum = 0, dySum = 0, count = 0
  for (let r = 1; r < n - 1; r++) {
    for (let c = 1; c < n - 1; c++) {
      const z = (dr: number, dc: number) => elevs[(r + dr) * n + (c + dc)] ?? 0
      const dzdx = ((z(-1,1) + 2*z(0,1) + z(1,1)) - (z(-1,-1) + 2*z(0,-1) + z(1,-1))) / (8 * cellW)
      const dzdy = ((z(-1,-1) + 2*z(-1,0) + z(-1,1)) - (z(1,-1) + 2*z(1,0) + z(1,1))) / (8 * cellH)
      slopeSum += Math.atan(Math.sqrt(dzdx*dzdx + dzdy*dzdy)) * 180 / Math.PI
      dxSum += dzdx; dySum += dzdy; count++
    }
  }
  if (count === 0) return undefined

  const avgSlope = slopeSum / count
  const aspectDeg = ((Math.atan2(dxSum / count, -(dySum / count)) * 180 / Math.PI) + 360) % 360
  const compassDirs = ['N','NE','E','SE','S','SW','W','NW']
  const dominantAspect = compassDirs[Math.round(aspectDeg / 45) % 8]

  let slopeCategory: string, slopeDescription: string
  if (avgSlope < 3) {
    slopeCategory = 'flat'
    slopeDescription = 'essentially flat — focus on vegetation edges and food proximity, terrain funnels absent'
  } else if (avgSlope < 8) {
    slopeCategory = 'gentle'
    slopeDescription = `gently sloping, predominant ${dominantAspect}-facing — ${dominantAspect.includes('S') || dominantAspect === 'SW' || dominantAspect === 'SE' ? 'south-facing slopes are prime winter bedding (thermal warmth)' : 'north-facing aspects stay cooler, deer use in summer heat'}`
  } else if (avgSlope < 15) {
    slopeCategory = 'moderate'
    slopeDescription = `moderately sloping ${dominantAspect}-facing — look for bench terrain (flat terraces cut into slope face); deer travel benches like highways. High-value stand terrain.`
  } else {
    slopeCategory = 'steep'
    slopeDescription = `steep ${dominantAspect}-facing terrain — saddles between adjacent ridges are top-5 stand sites. Look for low points between ridgetops where elevation drops 15+ feet.`
  }

  return {
    avgSlopeDegrees: Math.round(avgSlope * 10) / 10,
    dominantAspect,
    slopeCategory,
    slopeDescription,
  }
}

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
  const sorted = [...samples].sort((a, b) => b.elevationM - a.elevationM)
  const q = Math.max(1, Math.floor(sorted.length / 4))
  const highGroundPoints = sorted.slice(0, q)
  const lowGroundPoints = sorted.slice(-q)
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
      `Low ground: lat ${lowPt.lat.toFixed(5)}, lng ${lowPt.lng.toFixed(5)} at ${lowPt.elevationM.toFixed(0)}m — likely drainage, creek bottom, or wet area.`,
    )
  } else {
    lines.push('Minimal elevation change — terrain advantage limited. Focus on vegetation edges and food proximity for stand sites.')
  }
  return { summary: lines.join(' '), highGroundPoints, lowGroundPoints }
}

interface CacheEntry { data: SpatialContext; expiresAt: number }
const cache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 30 * 60 * 1000
const CACHE_MAX_SIZE = 100

function boundsKey(b: Bounds): string {
  return [b.north, b.south, b.east, b.west].map(v => v.toFixed(3)).join(',')
}

function pruneCache(): void {
  const now = Date.now()
  for (const [k, v] of cache) {
    if (now >= v.expiresAt) cache.delete(k)
  }
  if (cache.size > CACHE_MAX_SIZE) {
    const oldest = cache.keys().next().value
    if (oldest) cache.delete(oldest)
  }
}

export async function fetchSpatialData(bounds: Bounds): Promise<SpatialContext> {
  const key = boundsKey(bounds)
  const cached = cache.get(key)
  if (cached && Date.now() < cached.expiresAt) return cached.data

  const centerLat = (bounds.north + bounds.south) / 2
  const centerLng = (bounds.east + bounds.west) / 2

  // Fetch all data in parallel — all enrichments are optional, fail gracefully
  const [osmFeatures, elevationSamples, windDirection, soilUnits, landCoverSamples, nwiWetlands, neighboringCrops, windRose, deerPressure] = await Promise.all([
    fetchOsmFeatures(bounds).catch((): OsmFeature[] => []),
    fetchElevationGrid(bounds).catch((): ElevationSample[] => []),
    fetchPrevailingWind(bounds).catch((): undefined => undefined),
    fetchSoilData(bounds).catch((): SoilMapUnit[] => []),
    fetchNlcdGrid(bounds).catch((): NlcdSample[] => []),
    fetchNwiWetlands(bounds).catch((): undefined => undefined),
    fetchNeighboringCrops(bounds).catch((): string[] => []),
    fetchWindRose(centerLat, centerLng).catch((): WindRoseSummary | null => null),
    fetchDeerPressure(centerLat, centerLng).catch((): DeerPressureSummary | null => null),
  ])

  const { summary: elevationSummary, highGroundPoints, lowGroundPoints } = summarizeElevation(elevationSamples)
  const terrainDerivatives = computeTerrainDerivatives(elevationSamples, bounds)
  const soilSummary = soilUnits.length > 0 ? summarizeSoilForTony(soilUnits) : undefined
  const landCoverSummary = landCoverSamples.length > 0 ? summarizeNlcdForTony(landCoverSamples) : undefined

  const result: SpatialContext = {
    osmFeatures, elevationSummary, elevationSamples, highGroundPoints, lowGroundPoints,
    windDirection, fetchedAt: Date.now(),
    soilUnits: soilUnits.length > 0 ? soilUnits : undefined,
    soilSummary,
    landCoverSamples: landCoverSamples.length > 0 ? landCoverSamples : undefined,
    landCoverSummary,
    nwiWetlands: nwiWetlands ?? undefined,
    neighboringCrops: neighboringCrops.length > 0 ? neighboringCrops : undefined,
    terrainDerivatives,
    windRose: windRose ?? undefined,
    deerPressure: deerPressure ?? undefined,
  }
  pruneCache()
  cache.set(key, { data: result, expiresAt: Date.now() + CACHE_TTL_MS })
  return result
}
