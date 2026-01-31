import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import type { Feature, FeatureCollection, LineString, Polygon } from 'geojson'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const summarizeMapContext = (ctx?: MapContextPayload) => {
  if (!ctx) return 'No boundary or focus data provided. Ask user to lock a boundary if guidance requires property edges.'
  const lines: string[] = []
  if (ctx.bounds) {
    lines.push(`Visible bounds lat ${ctx.bounds.south.toFixed(4)}→${ctx.bounds.north.toFixed(4)}, lng ${ctx.bounds.west.toFixed(4)}→${ctx.bounds.east.toFixed(4)}, zoom ${ctx.zoom ?? 'n/a'}`)
  }
  if (ctx.boundary) {
    lines.push('PROPERTY BOUNDARY (HARD EDGE) GEOJSON:')
    lines.push(JSON.stringify(ctx.boundary))
  } else {
    lines.push('NO PROPERTY BOUNDARY LOCKED: warn user and avoid suggesting outside unknown limits.')
  }
  if (ctx.focusFeatures?.length) {
    const internal = ctx.focusFeatures.filter(f => !f.properties?.isExternal)
    const external = ctx.focusFeatures.filter(f => f.properties?.isExternal)
    if (internal.length) {
      lines.push(`INTERNAL FOCUS AREAS (${internal.length}): User highlighting zones INSIDE property`)
      lines.push(JSON.stringify(internal.slice(0, 2)))
    }
    if (external.length) {
      lines.push(`EXTERNAL FACTORS (${external.length}): User marked NEIGHBOR activity/pressure OUTSIDE boundary`)
      lines.push(JSON.stringify(external.slice(0, 2)))
      lines.push('CRITICAL: Use these external markers to inform your internal strategy (e.g., staging areas, funnels near boundary)')
    }
  }
  if (ctx.userDrawn?.features?.length) {
    lines.push(`USER DRAWN LAYERS (${ctx.userDrawn.features.length} features) preview:`)
    lines.push(JSON.stringify({ ...ctx.userDrawn, features: ctx.userDrawn.features.slice(0, 5) }))
  }
  return lines.join('\n')
}

const buildSystemPrompt = (mapContext?: MapContextPayload) => `You are Tony, a veteran Whitetail Habitat Consultant specializing in property layout, bedding areas, food plots, and travel corridors.

You receive aerial imagery plus rich geospatial context (boundary + focus markings). Use that intelligence to give blunt, tactical advice.

MAP CONTEXT INPUT:
${summarizeMapContext(mapContext)}

MANDATES:
1. PROPERTY HARD WALL: Your recommendations MUST remain inside the provided property boundary polygon. If any idea would cross onto a neighbor, adjust or warn the user explicitly.
2. RED FOCUS PRIORITY: If the user provided red focus tool GeoJSON, concentrate your guidance on those highlighted coordinates.
3. EXTERNAL RED MARKINGS: When the user marks an area OUTSIDE the property boundary with red (isExternal: true), treat it as an external factor:
   - Neighbor's bedding area, food source, or pressure point
   - Deer movement corridor from neighboring land
   - Plan YOUR INTERNAL habitat to intercept, funnel, or create staging near the boundary to capitalize on that external activity
4. **HONESTY PROTOCOL (CRITICAL):** You DO NOT have elevation data, LiDAR, or confirmed vegetation density unless the user explicitly states it. NEVER guess terrain features.
   - DO NOT assume "This is a low-lying basin" or "This hilltop" or "This timbered area" unless the user confirms it.
   - Instead, ASK: "I see the location, but I need confirmation: Is this area high ground or low? Is it currently timber, open field, or mixed brush?"
   - Only make recommendations AFTER the user provides terrain details. Guessing wrong destroys credibility.
5. RIDGE RULE: Avoid placing food plots on ridge tops or steep slopes. Prefer bottom ground, benches, gentle plateaus. But ASK about elevation if uncertain—do not assume.
6. ORGANIC SHAPES: Bedding pockets and plots must be irregular, organic forms (kidney, teardrop, crescent, amoeba) made of 6–10 vertices. NO rectangles or perfect ellipses.
7. CURVED TRAVEL CORRIDORS: Trails / travel corridors must bend naturally with at least 5 waypoints and gentle arcs (use LineStrings with 5+ coordinates).
8. PROPERTY NOTES: Every feature must include both a "title" (short name) and "reason" (why this placement works) inside the properties block.
9. JSON CONTRACT: Respond ONLY with valid JSON using the schema below. No prose outside the JSON.

RESPONSE SCHEMA (always include drawing, even if empty):
{
  "reply": "2-3 sentence, no fluff habitat advice.",
  "drawing": {
    "type": "FeatureCollection",
    "features": [
      {
        "type": "Feature",
        "properties": {
          "type": "bedding" | "food_plot" | "travel_corridor" | "staging_area" | "observation",
          "title": "North Bench Bedding",
          "reason": "Explain why this exact spot works"
        },
        "geometry": {
          "type": "Point" | "LineString" | "Polygon",
          "coordinates": [...] // GeoJSON [lng, lat]
        }
      }
    ]
  }
}

If you cannot confidently place a feature inside the boundary, return an empty features array and explain why in "reply".`

type MapContextPayload = {
  bounds?: { north: number; south: number; east: number; west: number }
  center?: { lat: number; lng: number }
  zoom?: number
  boundary?: Feature<Polygon> | null
  focusFeatures?: Feature<LineString>[]
  userDrawn?: FeatureCollection
}

type ChatRequestBody = {
  message: string
  imageDataUrl?: string
  mapContext?: MapContextPayload
}

export async function POST(req: NextRequest) {
  try {
    const key = process.env.OPENROUTER_KEY
    if (!key) return NextResponse.json({ error: 'Missing OPENROUTER_KEY' }, { status: 500 })

    const body = (await req.json()) as ChatRequestBody & { sceneGraphLite?: any }
    const message = body.message?.trim() || ''
    const imageDataUrl = body.imageDataUrl
    const mapContext = body.mapContext
    const sceneGraphLite = body.sceneGraphLite

    // TEMP LOG: boundary acres, feature count, totalsByType keys
    if (sceneGraphLite) {
      // eslint-disable-next-line no-console
      console.log('[SceneGraphLite]', {
        boundaryAcres: sceneGraphLite.boundary?.acres,
        featureCount: Array.isArray(sceneGraphLite.features) ? sceneGraphLite.features.length : 0,
        totalsByTypeKeys: sceneGraphLite.totalsByType ? Object.keys(sceneGraphLite.totalsByType) : []
      })
    }

    if (!message) return NextResponse.json({ error: 'Message required' }, { status: 400 })

    // Optionally, use sceneGraphLite in prompt or for future logic
    // For now, just confirm Tony references feature types/counts/acres
    const systemPrompt = buildSystemPrompt(mapContext)

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: imageDataUrl 
              ? [{ type: 'text', text: message }, { type: 'image_url', image_url: { url: imageDataUrl } }]
              : [{ type: 'text', text: message }]
          }
        ],
        response_format: { type: 'json_object' }
      }),
    })

    const data = await res.json()
    const choiceContent = data?.choices?.[0]?.message?.content
    const rawReply = Array.isArray(choiceContent)
      ? choiceContent.map((chunk: { text?: string }) => chunk?.text ?? '').join('\n')
      : choiceContent || '{"reply":"No response.","drawing":{"type":"FeatureCollection","features":[]}}'
    
    // Parse the JSON response
    let parsedResponse
    try {
      parsedResponse = JSON.parse(rawReply)
    } catch {
      // Fallback if AI returns malformed JSON
      parsedResponse = {
        reply: rawReply,
        drawing: { type: 'FeatureCollection', features: [] }
      }
    }
    if (!parsedResponse.drawing || parsedResponse.drawing.type !== 'FeatureCollection' || !Array.isArray(parsedResponse.drawing.features)) {
      parsedResponse.drawing = { type: 'FeatureCollection', features: [] }
    }

    return NextResponse.json(parsedResponse)
  } catch (err) {
    console.error('API error:', err)
    return NextResponse.json({ 
      reply: 'Server error', 
      drawing: { type: 'FeatureCollection', features: [] }
    }, { status: 500 })
  }
}
