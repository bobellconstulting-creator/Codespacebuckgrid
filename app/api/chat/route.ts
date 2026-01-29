import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ChatRequestBody = {
  message: string
  imageDataUrl?: string
  mapContext?: {
    bounds?: { north: number; south: number; east: number; west: number }
    drawnFeatures?: any[]
    focusArea?: any
  }
}

export async function POST(req: NextRequest) {
  try {
    const key = process.env.OPENROUTER_KEY
    if (!key) return NextResponse.json({ error: 'Missing OPENROUTER_KEY' }, { status: 500 })

    const body = (await req.json()) as ChatRequestBody
    const message = body.message?.trim() || ''
    const imageDataUrl = body.imageDataUrl
    const mapContext = body.mapContext

    if (!message) return NextResponse.json({ error: 'Message required' }, { status: 400 })

    // Build geospatial-aware system prompt
    const systemPrompt = `You are Tony, a veteran Whitetail Habitat Consultant specializing in property layout, bedding areas, food plots, and travel corridors.

${mapContext ? `CURRENT MAP CONTEXT:
- Visible Bounds: ${mapContext.bounds ? `N:${mapContext.bounds.north.toFixed(4)} S:${mapContext.bounds.south.toFixed(4)} E:${mapContext.bounds.east.toFixed(4)} W:${mapContext.bounds.west.toFixed(4)}` : 'unknown'}
- Drawn Features: ${mapContext.drawnFeatures?.length || 0} layers on map
- Focus Area: ${mapContext.focusArea ? 'user has highlighted a specific zone' : 'full property view'}

When you provide habitat advice, you MUST return STRUCTURED GEOSPATIAL DATA so the app can draw your recommendations on the map.` : ''}

RESPONSE FORMAT - YOU MUST RETURN VALID JSON:
{
  "reply": "Your 2-3 sentence advice here",
  "drawing": {
    "type": "FeatureCollection",
    "features": [
      {
        "type": "Feature",
        "properties": {
          "type": "bedding" | "food_plot" | "travel_corridor" | "staging_area" | "observation",
          "label": "North Ridge Bedding",
          "notes": "Optional detail"
        },
        "geometry": {
          "type": "Point" | "LineString" | "Polygon",
          "coordinates": [...] // [lng, lat] format for Point, [[lng,lat]...] for LineString/Polygon
        }
      }
    ]
  }
}

RULES:
- Keep "reply" under 3 sentences, direct and blunt
- If you recommend a location, ADD IT TO "features" array with proper GeoJSON coordinates
- Use actual lat/lng coordinates based on the map bounds provided
- If no geospatial recommendation, return empty features array but KEEP the JSON structure
- NEVER return plain text - ALWAYS return the JSON object above`

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
    const rawReply = data?.choices?.[0]?.message?.content || '{"reply":"No response.","drawing":{"type":"FeatureCollection","features":[]}}'
    
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

    return NextResponse.json(parsedResponse)
  } catch (err) {
    console.error('API error:', err)
    return NextResponse.json({ 
      reply: 'Server error', 
      drawing: { type: 'FeatureCollection', features: [] }
    }, { status: 500 })
  }
}
