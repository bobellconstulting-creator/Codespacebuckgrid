import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_MESSAGE_LENGTH = 2000
const MAX_FEATURES = 50
const ESRI_TIMEOUT_MS = 7000
const GEMINI_TIMEOUT_MS = 55000

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

function buildTonyPrompt(message: string, bounds: Bounds, zoom: number, features: any[], season: string, propertyName: string): string {
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

  return `You are Tony, a 25-year whitetail habitat consultant with deep field experience in food plot placement, bedding area design, trail systems, and stand placement. You speak plainly and give specific, no-BS advice tied to what you actually see.
${propertyLine}

${seasonGuidance}

The satellite image covers exactly:
- Latitude: ${bounds.south.toFixed(5)}° to ${bounds.north.toFixed(5)}° (south to north)
- Longitude: ${bounds.west.toFixed(5)}° to ${bounds.east.toFixed(5)}° (west to east)
- Zoom level: ${zoom}

The image is 640×480 pixels. Pixel x=0 is lng=${bounds.west.toFixed(5)}°, x=640 is lng=${bounds.east.toFixed(5)}°. Pixel y=0 is lat=${bounds.north.toFixed(5)}°, y=480 is lat=${bounds.south.toFixed(5)}°. Use this to estimate real coordinates for any feature you recommend.
${featureDesc}

User says: "${message}"

Analyze the terrain. Look for:
- Timber edges, canopy breaks, thickets (bedding / staging)
- Open fields, clearings, powerlines (food plot candidates)
- Creek bottoms, drainages, ponds, water access
- Ridge lines, saddles, pinch points, creek crossings (deer travel)
- Terrain features that funnel movement
- Timber type differences (hardwood mast vs screening cover vs bedding)

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

    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Server configuration error', reply: 'Tony needs a fresh API key — contact support to get Tony back online.' }, { status: 500 })
    }

    const body = await req.json()
    const { message, bounds, zoom, features = [], season = '', propertyName = '' } = body

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
      const tonyPrompt = buildTonyPrompt(trimmedMsg, bounds, zoom ?? 14, safeFeatures, typeof season === 'string' ? season : '', typeof propertyName === 'string' ? propertyName : '')
      const orPromise = fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://codespacebuckgrid.vercel.app',
          'X-Title': 'BuckGrid Pro',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.0-flash-001',
          messages: [{
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:image/png;base64,${imgBase64}` } },
              { type: 'text', text: tonyPrompt }
            ]
          }],
          max_tokens: 2048,
        })
      })
      const result = await Promise.race([
        orPromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('TonyTimeout')), GEMINI_TIMEOUT_MS)
        )
      ])
      if (!result.ok) {
        const errBody = await result.text()
        throw new Error(`OpenRouter ${result.status}: ${errBody}`)
      }
      const orJson = await result.json()
      rawText = orJson.choices?.[0]?.message?.content?.trim() ?? ''
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

    // Filter annotations to valid geometry within bounds
    const annotations = tonyFeatures
      .filter(f => f.geometry?.type && Array.isArray(f.geometry?.coordinates))
      .filter(f => {
        const { type, coordinates } = f.geometry
        if (type === 'Point') return isCoordInBounds(coordinates, bounds)
        if (type === 'LineString') return coordinates.some((c: number[]) => isCoordInBounds(c, bounds))
        if (type === 'Polygon') return coordinates[0]?.some((c: number[]) => isCoordInBounds(c, bounds))
        return false
      })
      .map(f => ({
        type: f.type ?? 'stand',
        label: f.label ?? '',
        why: f.why ?? '',
        geojson: {
          type: 'Feature',
          geometry: f.geometry,
          properties: { type: f.type, label: f.label, why: f.why }
        }
      }))

    return NextResponse.json({ reply, annotations })
  } catch (err) {
    console.error('[chat] error:', err)
    return NextResponse.json({ error: 'Server error', reply: 'Tony is unavailable right now. Try again.' }, { status: 500 })
  }
}
