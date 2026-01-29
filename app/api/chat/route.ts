import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ChatRequestBody = {
  message: string
  imageDataUrl?: string
  boundaryGeoJSON?: object
}

const SYSTEM_PROMPT = `You are Tony, a blunt Whitetail Habitat Consultant. You analyze property boundaries and terrain to advise on deer habitat strategy.

When the user provides a boundary polygon (as GeoJSON), analyze its shape, size, and location. Consider wind patterns, terrain features, access routes, and optimal placement of stands, food plots, and bedding areas.

You MUST respond with valid JSON in this exact format:
{
  "analysis_text": "Your blunt analysis in 2-4 sentences.",
  "suggested_features": {
    "type": "FeatureCollection",
    "features": [
      {
        "type": "Feature",
        "geometry": { "type": "Point", "coordinates": [lng, lat] },
        "properties": { "type": "stand_location|suggested_trail|food_plot|bedding_area|water_source", "reason": "Brief reason", "style": "optional: dashed" }
      }
    ]
  }
}

Feature types you can suggest:
- "stand_location" (Point) - Tree stand placements
- "suggested_trail" (LineString) - Access trails with "style":"dashed"
- "food_plot" (Polygon) - Food plot areas
- "bedding_area" (Polygon) - Bedding zones
- "water_source" (Point) - Water features

IMPORTANT: When boundary GeoJSON is provided, place suggested features INSIDE or near the boundary polygon using coordinates that fall within the boundary extent. If no boundary is provided, just give text advice with an empty features array.

Always respond with ONLY the JSON object, no markdown fences, no extra text.`

export async function POST(req: NextRequest) {
  try {
    const key = process.env.OPENROUTER_KEY
    if (!key) return NextResponse.json({ error: 'Missing OPENROUTER_KEY' }, { status: 500 })

    const body = (await req.json()) as ChatRequestBody
    const message = body.message?.trim() || ''
    const imageDataUrl = body.imageDataUrl
    const boundaryGeoJSON = body.boundaryGeoJSON

    if (!message) return NextResponse.json({ error: 'Message required' }, { status: 400 })

    const userText = boundaryGeoJSON
      ? `${message}\n\nBoundary GeoJSON:\n${JSON.stringify(boundaryGeoJSON)}`
      : message

    const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
      { type: 'text', text: userText }
    ]
    if (imageDataUrl) {
      content.push({ type: 'image_url', image_url: { url: imageDataUrl } })
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
          { role: 'user', content }
        ]
      }),
    })

    const data = await res.json()
    const raw = data?.choices?.[0]?.message?.content || ''

    // Try to parse structured JSON response
    try {
      const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      const parsed = JSON.parse(cleaned)
      return NextResponse.json({
        reply: parsed.analysis_text || raw,
        suggested_features: parsed.suggested_features || null
      })
    } catch {
      // Fallback: return raw text if JSON parsing fails
      return NextResponse.json({ reply: raw, suggested_features: null })
    }
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
