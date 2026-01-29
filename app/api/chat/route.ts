import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ActiveFeature = {
  type: string
  toolId: string
  color: string
  pointCount: number
  centroid: [number, number] | null
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number } | null
}

type SpatialContext = {
  boundaryPolygon: object | null
  propertyAcres: number
  activeFeatures: ActiveFeature[]
}

type ChatRequestBody = {
  message: string
  imageDataUrl?: string
  spatialContext?: SpatialContext
  userName?: string
}

const SYSTEM_PROMPT = `You are Tony, the BuckGrid Habitat Specialist. You have eyes on the map. You talk like a porch buddy — blunt, warm, a little rough around the edges. The guy leaning on a truck tailgate who's forgotten more about deer than most people will ever learn. Short sentences. No corporate fluff. Max 3 sentences.

You receive a SpatialContext object with every message containing:
- boundaryPolygon: The locked property boundary as GeoJSON (your PRIMARY focus area)
- propertyAcres: Total locked acreage
- activeFeatures: Every drawn shape on the map — type (CORN, CLOVER, HINGE, EGYPTIAN, SOYBEANS, MILO, BRASSICAS, SWITCHGRASS, STAND, FOCUS), centroid coordinates, and bounding box

ANALYSIS RULES:
1. BOUNDARY ENFORCEMENT: The locked border is king. Everything inside it is your primary focus. Any feature whose centroid falls outside the boundary polygon is "Perimeter Context" — acknowledge it but do not treat it as part of the core layout. Flag it: "That [feature] is outside your wire — treat it as perimeter context, not your main plan."
2. SPATIAL RELATIONSHIPS: When a Bedding Area (HINGE) is drawn near a Food Plot (CORN, CLOVER, SOYBEANS, BRASSICAS), evaluate thermal flow and travel distance. Deer need 50-150 yards between bed and feed with screening in between. If it's too close or too far, say so.
3. TIMBER FINGERS & TERRAIN: If a food plot is drawn in the open with no timber connection or screening corridor, call it out. Plots need to be tucked into terrain features, not sitting naked in a field.
4. STAND PLACEMENT: Stands should be downwind of expected travel routes between bedding and food. If a STAND is drawn upwind of a HINGE or food plot with no terrain break, flag it.
5. SCREENING: Egyptian Wheat and Switchgrass should be on entry corridors, perimeters, and between human access routes and deer movement. If screening is missing where it matters, say so.

When the user asks for your vision or layout (e.g. "Tony, what would you do here?"), respond with valid JSON containing TWO fields:
1. "reply" — your spoken response (string, max 3 sentences, porch-buddy tone)
2. "map_update" — an array of GeoJSON Feature objects to render on the map. Each feature:
   - "type": "Feature"
   - "geometry": GeoJSON Polygon or LineString using real coordinates within the boundary
   - "properties": { "label": string, "zone": "forage" | "screening" }

Zone colors (applied by frontend):
- "forage" (Clover/Alfalfa): Green #2D5A1E — bottoms/fertile low ground
- "screening" (Egyptian Wheat): Red #ef4444 — ridges/perimeters/entry corridors

If NOT asked for a layout, respond with: { "reply": "your text here" }

Always respond with valid JSON only. No markdown, no code fences.`

export async function POST(req: NextRequest) {
  try {
    const key = process.env.OPENROUTER_KEY
    if (!key) {
      console.error('[Tony API] OPENROUTER_KEY is not set in .env.local')
      return NextResponse.json({ error: 'Missing OPENROUTER_KEY — add it to .env.local' }, { status: 500 })
    }

    const body = (await req.json()) as ChatRequestBody
    const message = body.message?.trim() || ''
    const imageDataUrl = body.imageDataUrl
    const spatialContext = body.spatialContext
    const userName = body.userName

    if (!message) return NextResponse.json({ error: 'Message required' }, { status: 400 })

    // Build user content with structured SpatialContext
    let textContent = ''
    if (userName) textContent += `[User: ${userName}]\n`
    textContent += message

    if (spatialContext) {
      textContent += `\n\n[SPATIAL CONTEXT]\n`
      textContent += `Property: ${spatialContext.propertyAcres} acres locked\n`
      textContent += `Boundary: ${spatialContext.boundaryPolygon ? 'LOCKED' : 'NOT SET'}\n`

      if (spatialContext.boundaryPolygon) {
        textContent += `Boundary GeoJSON: ${JSON.stringify(spatialContext.boundaryPolygon)}\n`
      }

      if (spatialContext.activeFeatures.length > 0) {
        textContent += `\nActive Features (${spatialContext.activeFeatures.length}):\n`
        for (const f of spatialContext.activeFeatures) {
          const loc = f.centroid ? `centroid [${f.centroid[0].toFixed(5)}, ${f.centroid[1].toFixed(5)}]` : 'no coords'
          const box = f.bounds ? `span [${f.bounds.minLat.toFixed(5)}-${f.bounds.maxLat.toFixed(5)} lat, ${f.bounds.minLng.toFixed(5)}-${f.bounds.maxLng.toFixed(5)} lng]` : ''
          textContent += `  - ${f.type} (${f.toolId}): ${f.pointCount} pts, ${loc}${box ? ', ' + box : ''}\n`
        }
      } else {
        textContent += `Active Features: NONE — map is empty\n`
      }
    }

    // Log SpatialContext to terminal
    console.log(`[Tony API] === SPATIAL CONTEXT ===`)
    console.log(`[Tony API] User: ${userName || 'anonymous'} | Message: "${message.slice(0, 80)}"`)
    if (spatialContext) {
      console.log(`[Tony API] Acres: ${spatialContext.propertyAcres} | Boundary: ${spatialContext.boundaryPolygon ? 'LOCKED' : 'NONE'} | Features: ${spatialContext.activeFeatures.length}`)
      if (spatialContext.activeFeatures.length > 0) {
        for (const f of spatialContext.activeFeatures) {
          console.log(`[Tony API]   -> ${f.type} @ [${f.centroid?.[0]?.toFixed(4)}, ${f.centroid?.[1]?.toFixed(4)}] (${f.pointCount} pts)`)
        }
      }
    } else {
      console.log(`[Tony API] SpatialContext: NOT PROVIDED`)
    }
    console.log(`[Tony API] Image: ${imageDataUrl ? 'YES' : 'NO'}`)
    console.log(`[Tony API] ========================`)

    const userContent: any[] = [{ type: 'text', text: textContent }]
    if (imageDataUrl) {
      userContent.push({ type: 'image_url', image_url: { url: imageDataUrl } })
    }

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent }
        ]
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error(`[Tony API] OpenRouter returned ${res.status}: ${errText}`)
      return NextResponse.json({ reply: `Tony is offline (API ${res.status}). Check your OPENROUTER_KEY.`, map_update: null })
    }

    const data = await res.json()
    const raw = data?.choices?.[0]?.message?.content

    if (!raw) {
      console.error('[Tony API] No content in response:', JSON.stringify(data).slice(0, 300))
      return NextResponse.json({ reply: 'No reply from Tony. Model may be unavailable.', map_update: null })
    }

    console.log(`[Tony API] Raw response: ${raw.slice(0, 200)}`)

    // Parse Tony's JSON response
    let parsed: { reply: string; map_update?: any[] }
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = { reply: raw }
    }

    return NextResponse.json({
      reply: parsed.reply || raw,
      map_update: parsed.map_update || null
    })
  } catch (err: any) {
    console.error('[Tony API] Server error:', err?.message || err)
    return NextResponse.json({ error: 'Server error', detail: err?.message }, { status: 500 })
  }
}
