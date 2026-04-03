import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import type { OsmFeature, SpatialContext } from '../spatial/route'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_MESSAGE_LENGTH = 2000
const MAX_FEATURES = 50
const ESRI_TIMEOUT_MS = 7000
const GEMINI_TIMEOUT_MS = 55000

// ─── Terrain conflict detection ───────────────────────────────────────────────

// Haversine distance in meters between two [lng, lat] points
function haversineMeters(a: [number, number], b: [number, number]): number {
  const R = 6371000
  const dLat = (b[1] - a[1]) * Math.PI / 180
  const dLng = (b[0] - a[0]) * Math.PI / 180
  const lat1 = a[1] * Math.PI / 180
  const lat2 = b[1] * Math.PI / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(h))
}

// Check a proposed [lng, lat] coordinate against OSM features.
// Returns a conflict warning string if within threshold, or null if clear.
function checkTerrainConflict(coord: [number, number], osmFeatures: OsmFeature[]): string | null {
  const WATER_WARN_M = 20
  const BUILDING_WARN_M = 30

  for (const f of osmFeatures) {
    const dist = haversineMeters(coord, f.point)
    if (f.kind === 'water' && dist < WATER_WARN_M) {
      return `Within ${dist.toFixed(0)}m of a mapped water body — may be wet or inaccessible ground. Verify on satellite.`
    }
    if (f.kind === 'wetland' && dist < WATER_WARN_M) {
      return `Within ${dist.toFixed(0)}m of a mapped wetland — likely poor stand access. Verify on satellite.`
    }
    if (f.kind === 'building' && dist < BUILDING_WARN_M) {
      return `Within ${dist.toFixed(0)}m of a mapped structure — human pressure zone. Stand not recommended here.`
    }
  }
  return null
}

// Build a compact OSM summary paragraph for Tony's prompt
function buildOsmSummary(features: OsmFeature[]): string {
  if (features.length === 0) return ''

  const counts: Record<OsmFeature['kind'], number> = { water: 0, wetland: 0, building: 0, forest: 0, road: 0 }
  for (const f of features) counts[f.kind]++

  const parts: string[] = []
  if (counts.water > 0) {
    const waterFeats = features.filter(f => f.kind === 'water').slice(0, 3)
    const waterPts = waterFeats.map(f => `lat ${f.point[1].toFixed(4)}, lng ${f.point[0].toFixed(4)}`).join('; ')
    parts.push(`${counts.water} water feature(s) mapped by OpenStreetMap near: ${waterPts}`)
  }
  if (counts.wetland > 0) {
    const wetFeats = features.filter(f => f.kind === 'wetland').slice(0, 2)
    const wetPts = wetFeats.map(f => `lat ${f.point[1].toFixed(4)}, lng ${f.point[0].toFixed(4)}`).join('; ')
    parts.push(`${counts.wetland} wetland(s) near: ${wetPts}`)
  }
  if (counts.building > 0) {
    const bldFeats = features.filter(f => f.kind === 'building').slice(0, 3)
    const bldPts = bldFeats.map(f => `lat ${f.point[1].toFixed(4)}, lng ${f.point[0].toFixed(4)}`).join('; ')
    parts.push(`${counts.building} structure(s) near: ${bldPts} — high human pressure, avoid stand placement within 100m`)
  }
  if (counts.forest > 0) {
    parts.push(`${counts.forest} mapped forest/woodland polygon(s) — verified timber cover for bedding analysis`)
  }
  if (counts.road > 0) {
    const roadFeats = features.filter(f => f.kind === 'road').slice(0, 2)
    const roadPts = roadFeats.map(f => `lat ${f.point[1].toFixed(4)}, lng ${f.point[0].toFixed(4)}`).join('; ')
    parts.push(`${counts.road} road/track segment(s) near: ${roadPts} — use as access route reference, avoid stand placement downwind of road`)
  }

  return `VERIFIED LAND COVER (OpenStreetMap):\n${parts.map(p => `- ${p}`).join('\n')}`
}

// In-memory rate limiter: 5 requests per minute per IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 60_000

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT_MAX) return false
  entry.count++
  return true
}

type Bounds = { north: number; south: number; east: number; west: number }

function isValidBounds(b: unknown): b is Bounds {
  if (!b || typeof b !== 'object') return false
  const { north, south, east, west } = b as Bounds
  return [north, south, east, west].every(v => typeof v === 'number' && isFinite(v))
    && north > south
    && east !== west
    && north <= 90 && south >= -90
    && east <= 180 && west >= -180
}

function getSeasonalGuidance(season: string): string {
  const s = season.toLowerCase()
  if (s.includes('spring')) {
    return `SEASON: Spring — food plot prep is your #1 priority right now.
Priority order: food_plot > water > bedding > trail > stand
Focus: south-facing slopes, field edges, openings with sun exposure. Recommend planting species and timing. Bedding and stand improvements are secondary — they can wait until late summer.`
  }
  if (s.includes('summer')) {
    return `SEASON: Summer — mineral sites and water are critical. Velvet antler growth phase.
Priority order: water > food_plot > bedding > stand > trail
Focus: water sources, mineral lick sites, dense shade cover. Bucks are patternable near water and food. Recommend water developments and food sources that mature by early fall.`
  }
  if (s.includes('early fall')) {
    return `SEASON: Early Fall — pre-rut prep. Stand placement is becoming critical.
Priority order: stand > trail > food_plot > bedding > water
Focus: transition zones between bedding and feeding areas. Bucks are on early patterns — food and timber edges. Recommend stand sites 80-100 yards downwind of timber edges with clean entry/exit routes.`
  }
  if (s.includes('rut')) {
    return `SEASON: Rut — peak buck movement. Stand placement is everything right now.
Priority order: stand > trail > bedding > water > food_plot
Focus: pinch points, saddles, funnels, doe bedding edges, creek crossings. Bucks abandon food patterns during rut — they follow does. Food plots are nearly irrelevant. Recommend stands at terrain funnels with minimal human scent intrusion. Entry/exit trails that avoid bedding areas are critical.`
  }
  return `SEASON: Late Season — thermal cover and emergency food are survival factors.
Priority order: food_plot > bedding > water > trail > stand
Focus: dense thermal cover (conifers, south-facing slopes protected from wind), standing grain or late food sources. Deer need to conserve energy. Recommend bedding improvements adjacent to reliable food. Stands near food with short entry routes (minimal energy/disturbance).`
}

// Builds the spatial intelligence block injected into Tony's prompt
function buildSpatialContextBlock(ctx: SpatialContext): string {
  const lines: string[] = ['=== SPATIAL INTELLIGENCE (verified data — trust this over visual inference) ===']

  // OSM land cover
  const osmSummary = buildOsmSummary(ctx.osmFeatures)
  if (osmSummary) lines.push(osmSummary)

  // Elevation summary
  if (ctx.elevationSummary) lines.push(`\nTERRAIN ANALYSIS (USGS elevation):\n${ctx.elevationSummary}`)

  // High ground explicit callout for stand placement
  if (ctx.highGroundPoints.length > 0) {
    const pts = ctx.highGroundPoints.slice(0, 2).map(
      p => `lat ${p.lat.toFixed(5)}, lng ${p.lng.toFixed(5)} (${p.elevationM.toFixed(0)}m)`
    ).join(' | ')
    lines.push(`High-ground stand candidates: ${pts}`)
  }

  // Low ground drainage warning
  if (ctx.lowGroundPoints.length > 0) {
    const pts = ctx.lowGroundPoints.slice(0, 2).map(
      p => `lat ${p.lat.toFixed(5)}, lng ${p.lng.toFixed(5)} (${p.elevationM.toFixed(0)}m)`
    ).join(' | ')
    lines.push(`Low drainage zones (avoid stands): ${pts}`)
  }

  lines.push('=== END SPATIAL INTELLIGENCE ===')
  return lines.join('\n')
}

function buildTonyPrompt(message: string, bounds: Bounds, zoom: number, features: any[], season: string, propertyName: string, spatialContext?: SpatialContext): string {
  const featureDesc = features.length > 0
    ? `\n\nThe user has already drawn ${features.length} feature(s) on the map:\n${features.slice(0, MAX_FEATURES).map((f, i) => {
        const type = f.properties?.layerType ?? f.type ?? 'unknown'
        const geomType = f.geometry?.type ?? 'unknown'
        const label = f.properties?.label ?? ''
        return `  ${i + 1}. ${type} (${geomType})${label ? ` — "${label}"` : ''}`
      }).join('\n')}\nReact specifically to what they've drawn — validate, improve, or redirect as needed.`
    : '\n\nThe user has not drawn any features yet — give your initial read of the property.'

  const seasonGuidance = season ? getSeasonalGuidance(season) : ''
  const propertyLine = propertyName ? `Property name: "${propertyName}"` : ''

  return `You are Tony — a blunt, 25-year whitetail habitat consultant. You've walked thousands of properties. You see what others miss. You give specific, no-BS field advice tied to exactly what you see in this satellite image. No generic tips. No hedging.
${propertyLine}

${seasonGuidance}

WHAT YOU SEE — satellite image coordinates:
- Latitude range: ${bounds.south.toFixed(5)}° to ${bounds.north.toFixed(5)}° (${((bounds.north - bounds.south) * 111000).toFixed(0)} meters N–S)
- Longitude range: ${bounds.west.toFixed(5)}° to ${bounds.east.toFixed(5)}° (${((bounds.east - bounds.west) * 111000 * Math.cos((bounds.north + bounds.south) / 2 * Math.PI / 180)).toFixed(0)} meters E–W)
- Zoom: ${zoom} | Image: 640×480px
- Pixel→coord: x=0 → lng ${bounds.west.toFixed(5)}, x=640 → lng ${bounds.east.toFixed(5)}, y=0 → lat ${bounds.north.toFixed(5)}, y=480 → lat ${bounds.south.toFixed(5)}
${featureDesc}

${spatialContext ? buildSpatialContextBlock(spatialContext) + '\n\n' : ''}SCAN THE IMAGE. Identify and note:
1. CANOPY STRUCTURE — Dense timber (bedding), open canopy (food/staging), timber edge transitions
2. TOPOGRAPHY — Ridgelines, saddles, creek bottoms, drainages, flat benches, south-facing slopes
3. WATER — Creek lines, ponds, wet areas, drainage channels
4. OPENINGS — Fields, clearings, powerlines, logged areas, old ag fields
5. FUNNELS — Pinch points between cover types, creek crossings, terrain narrows
6. HUMAN SIGN — Roads, buildings, property lines that create pressure/avoidance zones

User says: "${message}"

CRITICAL: Respond ONLY with raw valid JSON — no markdown, no code fences, no explanation outside the JSON. Exact format:
{
  "reply": "Your detailed expert analysis. Reference specific terrain you see. Be direct.",
  "features": [
    {
      "type": "food_plot",
      "label": "3-acre soybean plot — SE field",
      "why": "Southern exposure, timber wind block on north, 80 yards from creek bedding",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[lng, lat], [lng, lat], [lng, lat], [lng, lat], [lng, lat]]]
      }
    }
  ]
}

Feature types: "food_plot", "bedding", "trail", "stand", "water"
All coordinates MUST be within: lng ${bounds.west.toFixed(5)} to ${bounds.east.toFixed(5)}, lat ${bounds.south.toFixed(5)} to ${bounds.north.toFixed(5)}
Return 2-5 features ranked by seasonal priority. Only place features where terrain clearly supports them. Polygon rings must close (first = last coordinate).`
}

function extractJsonFromText(text: string): string {
  // Try stripping markdown fences first
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) return fenceMatch[1].trim()
  // Try extracting a raw JSON object
  const objMatch = text.match(/\{[\s\S]*\}/)
  if (objMatch) return objMatch[0]
  return text.trim()
}

function isCoordInBounds(coord: number[], bounds: Bounds): boolean {
  const [lng, lat] = coord
  return typeof lng === 'number' && typeof lat === 'number'
    && lng >= bounds.west && lng <= bounds.east
    && lat >= bounds.south && lat <= bounds.north
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? 'unknown'
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: 'Too many requests', reply: 'Slow down — Tony can only handle so many questions per minute. Try again shortly.' }, { status: 429 })
    }

    const apiKey = process.env.GOOGLE_AI_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Server configuration error', reply: 'Tony needs a fresh API key — contact support to get Tony back online.' }, { status: 500 })
    }

    const body = await req.json()
    const { message, bounds, zoom, features = [], season = '', propertyName = '', spatialContext } = body

    // Validate inputs
    const trimmedMsg = typeof message === 'string' ? message.trim().slice(0, MAX_MESSAGE_LENGTH) : ''
    if (!trimmedMsg) return NextResponse.json({ error: 'Message required' }, { status: 400 })
    if (!isValidBounds(bounds)) return NextResponse.json({ error: 'Valid map bounds required' }, { status: 400 })
    const safeFeatures = Array.isArray(features) ? features.slice(0, MAX_FEATURES) : []

    // Fetch satellite image — Esri World Imagery (free, no key, no CORS)
    const esriUrl = `https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/export` +
      `?bbox=${bounds.west},${bounds.south},${bounds.east},${bounds.north}` +
      `&bboxSR=4326&imageSR=4326&size=640,480&format=png&f=image`

    let imgBase64: string
    try {
      const imgRes = await fetch(esriUrl, { signal: AbortSignal.timeout(ESRI_TIMEOUT_MS) })
      if (!imgRes.ok) throw new Error(`Esri responded ${imgRes.status}`)
      imgBase64 = Buffer.from(await imgRes.arrayBuffer()).toString('base64')
    } catch (err: unknown) {
      const isTimeout = err instanceof Error && err.name === 'TimeoutError'
      return NextResponse.json({
        error: 'Map image unavailable',
        reply: isTimeout
          ? "Satellite image took too long to load. Move the map slightly and try again."
          : "Couldn't pull the satellite image. Check your connection and try again."
      }, { status: 500 })
    }

    let rawText: string
    try {
      const safeSpatialContext = spatialContext && typeof spatialContext === 'object' ? spatialContext as SpatialContext : undefined
      const tonyPrompt = buildTonyPrompt(trimmedMsg, bounds, zoom ?? 14, safeFeatures, typeof season === 'string' ? season : '', typeof propertyName === 'string' ? propertyName : '', safeSpatialContext)
      const geminiPromise = fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { inline_data: { mime_type: 'image/png', data: imgBase64 } },
                { text: tonyPrompt }
              ]
            }],
            generationConfig: { maxOutputTokens: 8192 },
          })
        }
      )
      const result = await Promise.race([
        geminiPromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('TonyTimeout')), GEMINI_TIMEOUT_MS)
        )
      ])
      if (!result.ok) {
        const errBody = await result.text()
        throw new Error(`Gemini ${result.status}: ${errBody}`)
      }
      const geminiJson = await result.json()
      rawText = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
    } catch (err: unknown) {
      const isTimeout = err instanceof Error && err.message === 'TonyTimeout'
      return NextResponse.json({
        error: 'AI timeout',
        reply: isTimeout
          ? "Tony's taking too long — probably a slow connection. Try again."
          : "Tony is unavailable right now. Try again in a moment."
      }, { status: 503 })
    }

    let reply = rawText
    let tonyFeatures: any[] = []

    try {
      const jsonStr = extractJsonFromText(rawText)
      const parsed = JSON.parse(jsonStr)
      if (parsed.reply) {
        reply = parsed.reply
        tonyFeatures = Array.isArray(parsed.features) ? parsed.features : []
      }
    } catch {
      reply = rawText || 'No response from Tony.'
    }

    // Resolve OSM features for conflict checking — use what the client sent, if valid
    const osmFeatures: OsmFeature[] = Array.isArray(spatialContext?.osmFeatures)
      ? (spatialContext as SpatialContext).osmFeatures
      : []

    // Filter annotations to valid geometry within bounds, then flag terrain conflicts
    const annotations = tonyFeatures
      .filter(f => f.geometry?.type && Array.isArray(f.geometry?.coordinates))
      .filter(f => {
        const { type, coordinates } = f.geometry
        if (type === 'Point') return isCoordInBounds(coordinates, bounds)
        if (type === 'LineString') return coordinates.some((c: number[]) => isCoordInBounds(c, bounds))
        if (type === 'Polygon') return coordinates[0]?.some((c: number[]) => isCoordInBounds(c, bounds))
        return false
      })
      .map(f => {
        // Terrain conflict check: only run on stand-type features where placement matters most
        let conflictWarning: string | undefined
        if (osmFeatures.length > 0 && (f.type === 'stand' || f.type === 'food_plot')) {
          const geom = f.geometry
          let checkCoord: [number, number] | null = null
          if (geom.type === 'Point') checkCoord = geom.coordinates as [number, number]
          else if (geom.type === 'Polygon') {
            // Use centroid of the first ring for a polygon check
            const ring = geom.coordinates[0] as [number, number][]
            if (ring.length > 0) {
              const lngSum = ring.reduce((s: number, c: [number, number]) => s + c[0], 0)
              const latSum = ring.reduce((s: number, c: [number, number]) => s + c[1], 0)
              checkCoord = [lngSum / ring.length, latSum / ring.length]
            }
          }
          if (checkCoord) {
            const warning = checkTerrainConflict(checkCoord, osmFeatures)
            if (warning) conflictWarning = warning
          }
        }

        return {
          type: f.type ?? 'stand',
          label: f.label ?? '',
          why: f.why ?? '',
          conflictWarning,
          geojson: {
            type: 'Feature',
            geometry: f.geometry,
            properties: { type: f.type, label: f.label, why: f.why, conflictWarning }
          }
        }
      })

    return NextResponse.json({ reply, annotations })
  } catch (err) {
    console.error('[chat] error:', err)
    return NextResponse.json({ error: 'Server error', reply: 'Tony is unavailable right now. Try again.' }, { status: 500 })
  }
}
